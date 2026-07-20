"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readDocxText } = require("../helpers/read-docx-text");
const command = require("../../src/cli/commands/render-resume");

function fictionalConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Acme Corp",
    candidate: {
      name: "Sample Candidate",
      contact: [{ text: "Remote, US" }],
    },
    summary: { text: "Fictional summary for the render-resume CLI test." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Fictional Engineer",
            company: "Northwind Widgets",
            dates: "2022 - Present",
            bullets: ["Did a fictional thing worth mentioning."],
          },
        ],
      },
    ],
    skills: [["Languages", "JavaScript"]],
    ...overrides,
  };
}

function makeWorkspace(config = fictionalConfig()) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "render-resume-workspace-"));
  const configPath = path.join(workspace, "resume-config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { workspace, configPath };
}

async function withWorkspace(config, fn) {
  const { workspace, configPath } = makeWorkspace(config);
  try {
    await fn({ workspace, configPath });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test("render-resume command writes a docx to outputs/resumes/<Company>/<file>.docx (golden render seam)", async () => {
  await withWorkspace(fictionalConfig(), async ({ workspace, configPath }) => {
    await command.run({ workspace, config: configPath });

    const expectedPath = path.join(workspace, "outputs", "resumes", "Acme Corp", "sample-candidate-acme-corp.docx");
    assert.ok(fs.existsSync(expectedPath), `expected rendered file at ${expectedPath}`);

    const text = readDocxText(expectedPath);
    assert.match(text, /Sample Candidate/);
    assert.match(text, /Fictional summary for the render-resume CLI test\./);
    assert.match(text, /Senior Fictional Engineer/);
  });
});

test("render-resume command honors an explicit outputFileName", async () => {
  await withWorkspace(fictionalConfig({ outputFileName: "custom-name.docx" }), async ({ workspace, configPath }) => {
    await command.run({ workspace, config: configPath });

    const expectedPath = path.join(workspace, "outputs", "resumes", "Acme Corp", "custom-name.docx");
    assert.ok(fs.existsSync(expectedPath));
  });
});

test("render-resume command throws a clear error for an invalid config", async () => {
  await withWorkspace({ company: "Acme Corp" }, async ({ workspace, configPath }) => {
    await assert.rejects(() => command.run({ workspace, config: configPath }), /Invalid resume config/);
  });
});

test("render-resume command requires --config", async () => {
  await withWorkspace(fictionalConfig(), async ({ workspace }) => {
    await assert.rejects(() => command.run({ workspace }), /--config/);
  });
});

test("render-resume command rejects a path-traversal-attempt company value instead of writing outside outputs/resumes/", async () => {
  await withWorkspace(fictionalConfig({ company: "../../../../tmp/escaped" }), async ({ workspace, configPath }) => {
    await command.run({ workspace, config: configPath });

    // The traversal attempt must not escape outputs/resumes/: every entry
    // written stays under that directory, and nothing lands outside the tmp
    // workspace root.
    const outputResumesDir = path.join(workspace, "outputs", "resumes");
    const entries = fs.readdirSync(outputResumesDir);
    entries.forEach((entry) => {
      const fullPath = path.resolve(outputResumesDir, entry);
      assert.ok(
        fullPath === outputResumesDir || fullPath.startsWith(outputResumesDir + path.sep),
        `expected ${fullPath} to stay under ${outputResumesDir}`,
      );
    });
    assert.ok(!fs.existsSync("/tmp/escaped"), "traversal attempt must not create /tmp/escaped");
  });
});

test("render-resume command rejects an all-dot company value instead of silently writing to the parent directory", async () => {
  await withWorkspace(fictionalConfig({ company: ".." }), async ({ workspace, configPath }) => {
    await assert.rejects(() => command.run({ workspace, config: configPath }), /company/);
  });
});

test("render-resume command rejects an all-dot outputFileName value", async () => {
  await withWorkspace(fictionalConfig({ outputFileName: ".." }), async ({ workspace, configPath }) => {
    await assert.rejects(() => command.run({ workspace, config: configPath }), /outputFileName/);
  });
});

test("render-resume command rejects a whitespace-padded \"..\" company value (leading-dot strip must not be defeated by trim order)", async () => {
  await withWorkspace(fictionalConfig({ company: " .. " }), async ({ workspace, configPath }) => {
    await assert.rejects(() => command.run({ workspace, config: configPath }), /company/);
  });
});

test("render-resume command rejects a whitespace-padded \"..\" outputFileName value with a clean error, not a raw EISDIR crash", async () => {
  await withWorkspace(fictionalConfig({ outputFileName: " .. " }), async ({ workspace, configPath }) => {
    await assert.rejects(() => command.run({ workspace, config: configPath }), /outputFileName/);
  });
});

test("render-resume command strips null bytes from company/outputFileName instead of passing them to the filesystem", async () => {
  await withWorkspace(fictionalConfig({ company: "Acme\0Corp" }), async ({ workspace, configPath }) => {
    await command.run({ workspace, config: configPath });
    const expectedPath = path.join(workspace, "outputs", "resumes", "AcmeCorp", "sample-candidate-acme-corp.docx");
    assert.ok(fs.existsSync(expectedPath), `expected rendered file at ${expectedPath}`);
  });
});

test("render-resume command rejects an excessively long company value with a clean error, not a raw ENAMETOOLONG crash", async () => {
  await withWorkspace(fictionalConfig({ company: "A".repeat(500) }), async ({ workspace, configPath }) => {
    await assert.rejects(() => command.run({ workspace, config: configPath }), /company must be \d+ characters or fewer/);
  });
});
