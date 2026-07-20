"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readDocxText } = require("../helpers/read-docx-text");
const command = require("../../src/cli/commands/tailor");
const { readJson, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");
const { renderTracker } = require("../../src/renderers/markdown-tracker");

// Composition tests for the tailor workflow (design plan 0001, D4): JD →
// drafted resume config → validated + audited → rendered DOCX → tracked
// role, landing un-applied in one pass. Exercises the real `tailor` CLI
// command (not the individual D2/D3/D6/D7 modules in isolation) so the seam
// between them is what's actually under test.

function fictionalConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Fabrikam AI",
    candidate: {
      name: "Sample Candidate",
      contact: [{ text: "Remote, US" }],
    },
    summary: { text: "Fictional product leader focused on developer platforms and AI-assisted workflows." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Platform Program Manager",
            company: "Contoso Labs",
            dates: "2022 - Present",
            bullets: ["Led launch coordination for an internal developer platform used by multiple product teams."],
          },
        ],
      },
    ],
    skills: [["Developer platforms", "Platform strategy, internal tooling, developer experience"]],
    ...overrides,
  };
}

function sourceBackedEntry(id, text) {
  return {
    id,
    type: "resume",
    fact: text,
    summary: `resume source ingested from inputs/resumes/${id}.md`,
    source: { kind: "resume", path: `inputs/resumes/${id}.md` },
    snippet: text,
    confidence: "source-text",
    metadata: { sha256: "fixture", extractionMode: "utf8" },
    createdAt: "2026-06-08T12:00:00.000Z",
  };
}

function createFixtureWorkspace({ config = fictionalConfig(), evidenceEntries = [], configFileName = "fabrikam-ai.json" } = {}) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "tailor-workspace-"));
  const paths = workspacePaths(workspace);
  ensureDir(paths.resumeConfigs);

  const configPath = path.join(paths.resumeConfigs, configFileName);
  writeJson(configPath, config);

  const evidenceText = evidenceEntries.length > 0 ? `${evidenceEntries.map((entry) => JSON.stringify(entry)).join("\n")}\n` : "";
  fs.writeFileSync(paths.evidence, evidenceText);

  return { workspace, configPath, paths };
}

async function withWorkspace(options, fn) {
  const { workspace, configPath, paths } = createFixtureWorkspace(options);
  try {
    await fn({ workspace, configPath, paths });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

const backedEvidence = [
  sourceBackedEntry("ev-001", "Led launch coordination for an internal developer platform used by multiple product teams."),
  sourceBackedEntry("ev-002", "Created a demo project for documenting AI-assisted developer workflow experiments."),
  sourceBackedEntry("ev-003", "Presented developer-platform strategy at a quarterly engineering review."),
];

test("tailor validates, renders, and registers a tracked role landing un-applied, in one pass", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    const result = await command.run({
      workspace,
      config: configPath,
      url: "https://jobs.example.invalid/fabrikam/developer-platform-pm",
      title: "Developer platform product manager",
    });

    // DOCX rendered at the expected D2 render seam path.
    const expectedDocx = path.join(workspace, "outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx");
    assert.ok(fs.existsSync(expectedDocx), `expected rendered file at ${expectedDocx}`);
    const text = readDocxText(expectedDocx);
    assert.match(text, /Sample Candidate/);
    assert.match(text, /Led launch coordination/);
    assert.strictEqual(result.outputPath, expectedDocx);

    // Tracked role registered (D6/add-role reuse): list-membership status is
    // "tracked", not the application-progress enum.
    const roles = readJson(paths.rolesTracked);
    assert.strictEqual(roles.length, 1);
    const [role] = roles;
    assert.strictEqual(role.company, "Fabrikam AI");
    assert.strictEqual(role.title, "Developer platform product manager");
    assert.strictEqual(role.status, "tracked", "role.status is list membership (seed/tracked), not application progress");

    // Lands un-applied (D4 acceptance criteria) via role.application.status
    // (D7's field), never the reserved role.status field.
    assert.strictEqual(role.application.status, "interested", "new tailor entries must land not-yet-applied via application.status");
    assert.strictEqual(role.application.appliedAt, undefined, "no application date until the candidate actually applies");

    // Resume artifacts linked back to the role.
    assert.strictEqual(role.resume.configPath, "resume-configs/fabrikam-ai.json");
    assert.strictEqual(role.resume.outputPath, path.join("outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx"));
    assert.strictEqual(role.resume.status, "review-needed");

    // Tracker rebuilt (md + html) as part of the set-status reuse.
    const tracker = fs.readFileSync(paths.tracker, "utf8");
    assert.strictEqual(tracker, renderTracker(roles));
    assert.ok(fs.existsSync(paths.htmlTracker), "html tracker should be rebuilt too");
  });
});

test("tailor defaults the tracked role's company to the resume config's own company field", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    await command.run({ workspace, config: configPath, title: "Developer platform product manager" });
    const [role] = readJson(paths.rolesTracked);
    assert.strictEqual(role.company, "Fabrikam AI");
  });
});

test("tailor rejects an explicit --company that disagrees with the resume config's company", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath }) => {
    await assert.rejects(
      () => command.run({ workspace, config: configPath, company: "Some Other Company", title: "PM" }),
      /does not match the resume config's company/,
    );
  });
});

test("tailor requires --config", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace }) => {
    await assert.rejects(() => command.run({ workspace, title: "PM", company: "Fabrikam AI" }), /--config/);
  });
});

test("tailor blocks on an invalid resume config and writes nothing", async () => {
  await withWorkspace({ config: { company: "Fabrikam AI" } }, async ({ workspace, configPath, paths }) => {
    await assert.rejects(() => command.run({ workspace, config: configPath, title: "PM" }), /Invalid resume config/);
    assert.ok(!fs.existsSync(paths.outputResumes), "no DOCX should be written for an invalid config");
    assert.deepStrictEqual(readJson(paths.rolesTracked, []), [], "no role should be tracked for an invalid config");
  });
});

test("tailor blocks on an unsupported claim (D3 claim audit) before rendering or tracking", async () => {
  await withWorkspace(
    {
      config: fictionalConfig({
        experienceSections: [
          {
            heading: "Experience",
            jobs: [
              {
                title: "Senior Platform Program Manager",
                company: "Contoso Labs",
                dates: "2022 - Present",
                bullets: ["Increased platform adoption by 500% in one quarter."],
              },
            ],
          },
        ],
      }),
      evidenceEntries: backedEvidence,
    },
    async ({ workspace, configPath, paths }) => {
      await assert.rejects(
        () => command.run({ workspace, config: configPath, title: "PM" }),
        (error) => {
          assert.match(error.message, /evidence-backed claim audit/);
          assert.match(error.message, /500%/);
          return true;
        },
      );
      assert.ok(!fs.existsSync(paths.outputResumes), "no DOCX should be written when the claim audit blocks");
      assert.deepStrictEqual(readJson(paths.rolesTracked, []), [], "no role should be tracked when the claim audit blocks");
    },
  );
});

test("tailor prints (does not block on) a thin-ledger warning", async () => {
  await withWorkspace({ evidenceEntries: [backedEvidence[0]] }, async ({ workspace, configPath }) => {
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (message) => warnings.push(message);
    try {
      await command.run({ workspace, config: configPath, title: "PM" });
      assert.ok(warnings.some((message) => /thin/i.test(message)), `expected a thin-ledger warning, got: ${JSON.stringify(warnings)}`);
    } finally {
      console.warn = originalWarn;
    }
  });
});

test("tailor is safe to re-run: does not duplicate the tracked role or reset an in-progress application status", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    await command.run({
      workspace,
      config: configPath,
      url: "https://jobs.example.invalid/fabrikam/developer-platform-pm",
      title: "Developer platform product manager",
    });

    // The candidate has since actually applied — a later tailor re-run
    // (e.g. re-rendering the resume after a tweak) must not silently revert
    // that real progress back to "interested".
    const setStatus = require("../../src/cli/commands/set-status");
    const [firstRole] = readJson(paths.rolesTracked);
    await setStatus.run({ workspace, id: firstRole.id, status: "applied", date: "2026-07-01" });

    await command.run({
      workspace,
      config: configPath,
      url: "https://jobs.example.invalid/fabrikam/developer-platform-pm",
      title: "Developer platform product manager",
    });

    const roles = readJson(paths.rolesTracked);
    assert.strictEqual(roles.length, 1, "re-running tailor for the same role must not create a duplicate");
    assert.strictEqual(roles[0].application.status, "applied", "an in-progress application status must survive a tailor re-run");
    assert.strictEqual(roles[0].application.appliedAt, "2026-07-01");
    assert.strictEqual(roles[0].resume.status, "review-needed", "resume metadata still refreshes on re-run");
  });
});
