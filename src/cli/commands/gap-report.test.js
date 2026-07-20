"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { run } = require("./gap-report");

function makeWorkspace(gapClassifications = []) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gap-report-workspace-"));
  const inputPath = path.join(workspace, "gaps.json");
  fs.writeFileSync(inputPath, JSON.stringify(gapClassifications, null, 2));
  return { workspace, inputPath };
}

async function withWorkspace(gaps, fn) {
  const { workspace, inputPath } = makeWorkspace(gaps);
  try {
    await fn({ workspace, inputPath });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test("gap-report command: requires --input option", async () => {
  await withWorkspace([], async ({ workspace }) => {
    await assert.rejects(() => run({ workspace }), /--input/);
  });
});

test("gap-report command: requires --input file to exist", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gap-report-workspace-"));
  try {
    await assert.rejects(
      () => run({ workspace, input: path.join(workspace, "nonexistent.json") }),
      /Missing required JSON file/,
    );
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("gap-report command: validates gap classifications schema", async () => {
  await withWorkspace([{ keyword: "Test" }], async ({ workspace, inputPath }) => {
    await assert.rejects(() => run({ workspace, input: inputPath }), /type.*missing/i);
  });
});

test("gap-report command: processes valid gap classifications", async () => {
  const gaps = [
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "Limited production experience",
      recommendedAction: "Add deployment story",
    },
  ];

  await withWorkspace(gaps, async ({ workspace, inputPath }) => {
    await run({ workspace, input: inputPath });
    // If validation passed and no error thrown, command succeeded
  });
});

test("gap-report command: rejects a --roleId that does not match any tracked role", async () => {
  const gaps = [
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "Limited production experience",
      recommendedAction: "Add deployment story",
    },
  ];

  await withWorkspace(gaps, async ({ workspace, inputPath }) => {
    await assert.rejects(
      () => run({ workspace, input: inputPath, roleId: "no-such-role" }),
      /does not match any tracked role/,
    );
  });
});

test("gap-report command: sanitizes a path-traversal --roleId into a literal directory name, never escaping outputs/roles/", async () => {
  const gaps = [
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "Limited production experience",
      recommendedAction: "Add deployment story",
    },
  ];

  await withWorkspace(gaps, async ({ workspace, inputPath }) => {
    const roleId = "../../evil";
    const rolesPath = path.join(workspace, "roles.tracked.json");
    fs.writeFileSync(rolesPath, JSON.stringify([{ id: roleId, title: "X", company: "Y", status: "applied" }]));

    const result = await run({ workspace, input: inputPath, roleId });

    // The sanitized output must land inside workspace/outputs/roles/ — never
    // escape it — and the resolved path must not point outside outputs/roles/.
    const rolesDir = path.join(workspace, "outputs", "roles");
    assert.ok(
      path.resolve(result.outputPath).startsWith(path.resolve(rolesDir) + path.sep),
      `Expected sanitized output to stay under ${rolesDir}, got ${result.outputPath}`,
    );
    assert.ok(!fs.existsSync(path.resolve(workspace, "..", "..", "evil")));
  });
});

test("gap-report command: rejects a --roleId that sanitizes to nothing (e.g. all dots/separators)", async () => {
  const gaps = [
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "Limited production experience",
      recommendedAction: "Add deployment story",
    },
  ];

  await withWorkspace(gaps, async ({ workspace, inputPath }) => {
    const roleId = "..";
    const rolesPath = path.join(workspace, "roles.tracked.json");
    fs.writeFileSync(rolesPath, JSON.stringify([{ id: roleId, title: "X", company: "Y", status: "applied" }]));

    await assert.rejects(
      () => run({ workspace, input: inputPath, roleId }),
      /non-separator, non-leading-dot character/,
    );
  });
});

test("gap-report command: outputs markdown to role's output folder", async () => {
  const gaps = [
    {
      keyword: "TypeScript",
      type: "PresentationGap",
      rationale: "Used but not highlighted",
      recommendedAction: "Add to skills section",
    },
  ];

  await withWorkspace(gaps, async ({ workspace, inputPath }) => {
    // Create a roles.tracked.json with a sample role
    const rolesPath = path.join(workspace, "roles.tracked.json");
    const roleId = "test-role-123";
    fs.writeFileSync(
      rolesPath,
      JSON.stringify([
        {
          id: roleId,
          title: "Senior Engineer",
          company: "TechCorp",
          status: "applied",
        },
      ]),
    );

    // Create output directory
    const outputDir = path.join(workspace, "outputs", "roles", roleId);
    fs.mkdirSync(outputDir, { recursive: true });

    // Run with role-id
    await run({ workspace, input: inputPath, roleId });

    // Check that gap-report.md was written
    const reportPath = path.join(outputDir, "gap-report.md");
    assert.ok(fs.existsSync(reportPath), "Expected gap-report.md to be created");

    const content = fs.readFileSync(reportPath, "utf8");
    assert.ok(content.includes("TypeScript"), "Expected keyword in report");
    assert.ok(content.includes("PresentationGap"), "Expected gap type in report");
  });
});

test("gap-report command: uses default role folder when no role-id provided", async () => {
  const gaps = [
    {
      keyword: "Go",
      type: "TrueGap",
      rationale: "Not present",
      recommendedAction: "Consider learning",
    },
  ];

  await withWorkspace(gaps, async ({ workspace, inputPath }) => {
    // Create default output directory
    const outputDir = path.join(workspace, "outputs", "gap-report");
    fs.mkdirSync(outputDir, { recursive: true });

    // Run without role-id
    await run({ workspace, input: inputPath });

    // Check that gap-report.md was written to default location
    const reportPath = path.join(outputDir, "gap-report.md");
    assert.ok(fs.existsSync(reportPath), "Expected gap-report.md in default location");

    const content = fs.readFileSync(reportPath, "utf8");
    assert.ok(content.includes("Go"), "Expected keyword in report");
  });
});

test("gap-report command: renders human-readable markdown output", async () => {
  const gaps = [
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "Mentioned in one project, but no production deployment experience",
      recommendedAction: "Add a concrete Kubernetes deployment story to experience section",
    },
    {
      keyword: "TypeScript",
      type: "PresentationGap",
      rationale: "Used extensively but not explicitly called out in summary",
      recommendedAction: "Add TypeScript to the top-level skills section",
    },
  ];

  await withWorkspace(gaps, async ({ workspace, inputPath }) => {
    const outputDir = path.join(workspace, "outputs", "gap-report");
    fs.mkdirSync(outputDir, { recursive: true });

    await run({ workspace, input: inputPath });

    const reportPath = path.join(outputDir, "gap-report.md");
    const content = fs.readFileSync(reportPath, "utf8");

    // Check markdown structure
    assert.ok(content.includes("# Gap Report"), "Expected heading");
    assert.ok(content.includes("Kubernetes"), "Expected first keyword");
    assert.ok(content.includes("TypeScript"), "Expected second keyword");
    assert.ok(content.includes("WeakEvidence"), "Expected gap type");
    assert.ok(content.includes("PresentationGap"), "Expected gap type");
  });
});

test("gap-report command: prints success message to console", async () => {
  const gaps = [
    {
      keyword: "Test",
      type: "PresentationGap",
      rationale: "Test",
      recommendedAction: "Test",
    },
  ];

  await withWorkspace(gaps, async ({ workspace, inputPath }) => {
    let capturedLogs = [];
    const originalLog = console.log;
    console.log = (msg) => {
      capturedLogs.push(msg);
    };

    try {
      const outputDir = path.join(workspace, "outputs", "gap-report");
      fs.mkdirSync(outputDir, { recursive: true });

      await run({ workspace, input: inputPath });

      assert.ok(
        capturedLogs.some((msg) => msg.includes("gap-report.md") && msg.includes("written")),
        "Expected success message",
      );
    } finally {
      console.log = originalLog;
    }
  });
});

test("gap-report command: rejects input that is not a JSON array", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "gap-report-workspace-"));
  const inputPath = path.join(workspace, "gaps.json");
  fs.writeFileSync(inputPath, JSON.stringify({ gaps: [] }));

  try {
    await assert.rejects(() => run({ workspace, input: inputPath }), /array/i);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("gap-report command: handles empty gaps array", async () => {
  await withWorkspace([], async ({ workspace, inputPath }) => {
    const outputDir = path.join(workspace, "outputs", "gap-report");
    fs.mkdirSync(outputDir, { recursive: true });

    // Should not throw for empty array
    await run({ workspace, input: inputPath });

    const reportPath = path.join(outputDir, "gap-report.md");
    assert.ok(fs.existsSync(reportPath), "Expected report created even with empty gaps");
  });
});

test("gap-report command: handles all four gap types", async () => {
  const gaps = [
    {
      keyword: "TypeScript",
      type: "PresentationGap",
      rationale: "Not highlighted",
      recommendedAction: "Add to skills",
    },
    {
      keyword: "Docker",
      type: "WeakEvidence",
      rationale: "Limited mention",
      recommendedAction: "Strengthen evidence",
    },
    {
      keyword: "Python",
      type: "AdjacentSkill",
      rationale: "JavaScript background transfers",
      recommendedAction: "Mention connection",
    },
    {
      keyword: "Rust",
      type: "TrueGap",
      rationale: "Completely missing",
      recommendedAction: "Consider learning",
    },
  ];

  await withWorkspace(gaps, async ({ workspace, inputPath }) => {
    const outputDir = path.join(workspace, "outputs", "gap-report");
    fs.mkdirSync(outputDir, { recursive: true });

    await run({ workspace, input: inputPath });

    const reportPath = path.join(outputDir, "gap-report.md");
    const content = fs.readFileSync(reportPath, "utf8");

    assert.ok(content.includes("PresentationGap"), "Expected PresentationGap");
    assert.ok(content.includes("WeakEvidence"), "Expected WeakEvidence");
    assert.ok(content.includes("AdjacentSkill"), "Expected AdjacentSkill");
    assert.ok(content.includes("TrueGap"), "Expected TrueGap");
  });
});
