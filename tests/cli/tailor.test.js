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
const { defaultOnboardingState } = require("../../src/core/onboarding-state");

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

function fictionalCoverLetterConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Fabrikam AI",
    candidate: {
      name: "Sample Candidate",
      contact: [{ text: "Remote, US" }],
    },
    salutation: "Dear Hiring Manager,",
    bodyParagraphs: [
      "I am excited to apply for this role and believe my background is a strong fit.",
      "I look forward to discussing how my experience in developer platforms can contribute to your team.",
    ],
    closing: "Sincerely,",
    ...overrides,
  };
}

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

test("tailor accepts an explicit --company that matches the config's company case/whitespace-insensitively", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    await command.run({ workspace, config: configPath, company: "  fabrikam ai  ", title: "PM" });
    const [role] = readJson(paths.rolesTracked);
    assert.strictEqual(role.company, "  fabrikam ai  ", "the caller's own --company text is preserved verbatim, only the comparison is lenient");
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

test("tailor prints (does not block on) a thin-ledger warning, and still renders + tracks", async () => {
  await withWorkspace({ evidenceEntries: [backedEvidence[0]] }, async ({ workspace, configPath, paths }) => {
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (message) => warnings.push(message);
    try {
      await command.run({ workspace, config: configPath, title: "PM" });
      assert.ok(warnings.some((message) => /thin/i.test(message)), `expected a thin-ledger warning, got: ${JSON.stringify(warnings)}`);
    } finally {
      console.warn = originalWarn;
    }
    // A thin-ledger warning is non-blocking: the DOCX and tracked role must
    // still land, not be silently skipped alongside the warning.
    assert.ok(fs.existsSync(path.join(workspace, "outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx")));
    const [role] = readJson(paths.rolesTracked);
    assert.strictEqual(role.company, "Fabrikam AI");
    assert.strictEqual(role.application.status, "interested");
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
    assert.strictEqual(roles[0].resume.configPath, "resume-configs/fabrikam-ai.json", "resume.configPath must still be correct after a re-run");
    assert.strictEqual(
      roles[0].resume.outputPath,
      path.join("outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx"),
      "resume.outputPath must still be correct after a re-run",
    );
  });
});

test("tailor re-run finds the existing role by job URL even when --title has drifted (not a stale-id crash)", async () => {
  // Regression: an earlier version recomputed the role id from THIS call's
  // own --title/--company after add-role's own (URL-based) dedup had
  // already recognized the role as a duplicate, so a re-run with the same
  // job URL but a reworded --title threw "could not find the tracked role
  // it just registered" instead of finding and updating the existing role
  // — a realistic flow, since an agent may reword a title between two
  // tailor passes over the same posting.
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    await command.run({
      workspace,
      config: configPath,
      url: "https://jobs.example.invalid/fabrikam/developer-platform-pm",
      title: "Developer platform product manager",
    });

    await command.run({
      workspace,
      config: configPath,
      url: "https://jobs.example.invalid/fabrikam/developer-platform-pm",
      title: "Developer Platform Product Manager", // reworded casing, same posting
    });

    const roles = readJson(paths.rolesTracked);
    assert.strictEqual(roles.length, 1, "the reworded-title re-run must update the existing role, not create a second one");
    assert.strictEqual(roles[0].resume.status, "review-needed");
    assert.strictEqual(roles[0].application.status, "interested");
  });
});

test("tailor with --keywords prints keyword coverage report (advisory-only D7 integration)", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    const keywordsPath = path.join(workspace, "test-keywords.json");
    const keywords = ["Platform strategy", "Developer experience", "Nonexistent tech"];
    writeJson(keywordsPath, keywords);

    const originalLog = console.log;
    const logs = [];
    console.log = (message) => logs.push(message);
    try {
      await command.run({
        workspace,
        config: configPath,
        keywords: keywordsPath,
        title: "Developer platform product manager",
      });

      // Coverage report should be printed.
      assert.ok(logs.some((message) => /Keyword coverage:/.test(message)), "expected keyword coverage report line");
      assert.ok(logs.some((message) => /Present:/.test(message)), "expected Present: line");
      assert.ok(logs.some((message) => /Missing:/.test(message)), "expected Missing: line");
      assert.ok(logs.some((message) => /Platform strategy/.test(message)), "expected a present keyword");
      assert.ok(logs.some((message) => /Nonexistent tech/.test(message)), "expected a missing keyword");
    } finally {
      console.log = originalLog;
    }

    // Command must still succeed and produce artifacts (not blocked by keyword advisory).
    assert.ok(fs.existsSync(path.join(workspace, "outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx")));
    const [role] = readJson(paths.rolesTracked);
    assert.strictEqual(role.application.status, "interested");
  });
});

test("tailor without --keywords does not print keyword coverage report", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    const originalLog = console.log;
    const logs = [];
    console.log = (message) => logs.push(message);
    try {
      await command.run({
        workspace,
        config: configPath,
        title: "Developer platform product manager",
      });

      // No keywords flag provided, so no coverage report should be printed.
      assert.ok(!logs.some((message) => /Keyword coverage:/.test(message)), "no keyword coverage report should be printed without --keywords");
    } finally {
      console.log = originalLog;
    }

    // Command must still succeed normally.
    assert.ok(fs.existsSync(path.join(workspace, "outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx")));
    const [role] = readJson(paths.rolesTracked);
    assert.strictEqual(role.application.status, "interested");
  });
});

test("tailor with --keywords never blocks, even with zero coverage", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    const keywordsPath = path.join(workspace, "test-keywords-zero-coverage.json");
    const keywords = ["Ruby", "Python", "Go", "Rust"];
    writeJson(keywordsPath, keywords);

    const originalLog = console.log;
    const logs = [];
    console.log = (message) => logs.push(message);
    try {
      // Critical test: tailor must succeed even with 0% keyword coverage.
      await command.run({
        workspace,
        config: configPath,
        keywords: keywordsPath,
        title: "Developer platform product manager",
      });

      // Coverage report should show 0%.
      assert.ok(logs.some((message) => /Keyword coverage: 0%/.test(message)), "expected 0% coverage report");
      assert.ok(logs.some((message) => /Present: \(none\)/.test(message)), "expected no present keywords");
    } finally {
      console.log = originalLog;
    }

    // Command must STILL succeed and produce artifacts (keyword coverage never blocks).
    assert.ok(fs.existsSync(path.join(workspace, "outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx")));
    const roles = readJson(paths.rolesTracked);
    assert.strictEqual(roles.length, 1, "role must be tracked despite zero keyword coverage");
    assert.strictEqual(roles[0].application.status, "interested");
  });
});

test("tailor with invalid --keywords file path warns but does not block", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    const originalWarn = console.warn;
    const originalLog = console.log;
    const warns = [];
    const logs = [];
    console.warn = (message) => warns.push(message);
    console.log = (message) => logs.push(message);
    try {
      await command.run({
        workspace,
        config: configPath,
        keywords: "nonexistent-keywords.json",
        title: "Developer platform product manager",
      });

      // Should warn about the keywords failure but not block.
      assert.ok(warns.some((message) => /keyword coverage analysis failed/.test(message)), "expected a warning about keyword analysis failure");
    } finally {
      console.warn = originalWarn;
      console.log = originalLog;
    }

    // Command must still succeed (keyword errors never block).
    assert.ok(fs.existsSync(path.join(workspace, "outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx")));
    const [role] = readJson(paths.rolesTracked);
    assert.strictEqual(role.application.status, "interested");
  });
});

test("tailor with a malformed (non-array) --keywords file warns but does not block", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    const keywordsPath = path.join(workspace, "malformed-keywords.json");
    writeJson(keywordsPath, { not: "an array" });

    const originalWarn = console.warn;
    const warns = [];
    console.warn = (message) => warns.push(message);
    try {
      await command.run({
        workspace,
        config: configPath,
        keywords: keywordsPath,
        title: "Developer platform product manager",
      });

      assert.ok(
        warns.some((message) => /keyword coverage analysis failed/.test(message)),
        "expected a warning about the keywords file not being a JSON array",
      );
    } finally {
      console.warn = originalWarn;
    }

    // Command must still succeed (malformed keywords input never blocks).
    assert.ok(fs.existsSync(path.join(workspace, "outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx")));
    const [role] = readJson(paths.rolesTracked);
    assert.strictEqual(role.application.status, "interested");
  });
});

// End-to-end run against the real fictional sample candidate (design plan
// 0001, D4 acceptance criteria: "End-to-end run on the fictional sample
// candidate documented and tested" — docs/playbooks/tailor.md's "Sample-
// candidate walkthrough" documents this exact scenario). Copies
// examples/sample-candidate into a scratch tmpdir first — the committed
// sample workspace itself must stay untouched (it's checked into git; see
// examples/sample-candidate/README.md's privacy rules) — and tailors the
// existing Fabrikam AI seed role (roles.seed.json's role-seed-001) using the
// sample candidate's actual profile/evidence.jsonl, not synthetic fixtures.
const SAMPLE_CANDIDATE_DIR = path.join(__dirname, "..", "..", "examples", "sample-candidate");

test("tailor end-to-end: tailors the real sample-candidate's Fabrikam AI seed role using its actual evidence", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "tailor-e2e-sample-candidate-"));
  try {
    fs.cpSync(SAMPLE_CANDIDATE_DIR, workspace, { recursive: true });
    const paths = workspacePaths(workspace);

    const rolesBefore = readJson(paths.rolesTracked);
    assert.strictEqual(rolesBefore.length, 1, "sanity check: the committed sample starts with exactly the Northwind Tools role");

    // Mirrors docs/playbooks/tailor.md's documented walkthrough: draft a
    // config for the Fabrikam AI seed role using only claims the sample
    // candidate's real evidence.jsonl (ev-001, ev-002) actually backs.
    const configPath = path.join(paths.resumeConfigs, "fabrikam-ai-developer-platform-pm.json");
    writeJson(configPath, {
      schemaVersion: "1.0",
      company: "Fabrikam AI",
      outputFileName: "alex-rivera-fabrikam-ai.docx",
      candidate: {
        name: "Alex Rivera",
        contact: [{ text: "Raleigh, NC" }],
      },
      summary: {
        text: "Fictional product and program leader focused on developer platforms, AI-assisted workflows, and launch readiness.",
      },
      experienceSections: [
        {
          heading: "Experience",
          jobs: [
            {
              title: "Senior Platform Program Manager",
              company: "Contoso Labs",
              dates: "2022 - Present",
              bullets: [
                "Led launch coordination for an internal developer platform used by multiple product teams.",
                "Created a demo project for documenting AI-assisted developer workflow experiments.",
              ],
            },
          ],
        },
      ],
      skills: [["Developer platforms", "Platform strategy, internal tooling, developer experience"]],
      includePublicationsSpeaking: false,
    });

    const result = await command.run({
      workspace,
      config: configPath,
      url: "https://jobs.example.invalid/fabrikam/developer-platform-product-manager",
      title: "Developer platform product manager",
    });

    const expectedDocx = path.join(workspace, "outputs", "resumes", "Fabrikam AI", "alex-rivera-fabrikam-ai.docx");
    assert.strictEqual(result.outputPath, expectedDocx);
    assert.ok(fs.existsSync(expectedDocx));

    const rolesAfter = readJson(paths.rolesTracked);
    assert.strictEqual(rolesAfter.length, 2, "tailoring adds a new tracked role alongside the existing sample role");
    assert.deepStrictEqual(rolesAfter[0], rolesBefore[0], "the pre-existing Northwind Tools sample role must be untouched");

    const fabrikamRole = rolesAfter.find((role) => role.company === "Fabrikam AI");
    assert.ok(fabrikamRole, "expected a Fabrikam AI tracked role");
    assert.strictEqual(fabrikamRole.status, "tracked");
    assert.strictEqual(fabrikamRole.application.status, "interested", "lands not-yet-applied");
    assert.strictEqual(fabrikamRole.resume.configPath, "resume-configs/fabrikam-ai-developer-platform-pm.json");
    assert.strictEqual(fabrikamRole.resume.outputPath, path.join("outputs", "resumes", "Fabrikam AI", "alex-rivera-fabrikam-ai.docx"));

    const tracker = fs.readFileSync(paths.tracker, "utf8");
    assert.match(tracker, /Fabrikam AI/);
    assert.match(tracker, /Interested/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("tailor with --cover-letter flag renders and links the cover letter to the role", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    const coverLetterConfigPath = path.join(paths.resumeConfigs, "fabrikam-ai-cover-letter.json");
    writeJson(coverLetterConfigPath, fictionalCoverLetterConfig());

    const result = await command.run({
      workspace,
      config: configPath,
      coverLetter: coverLetterConfigPath,
      url: "https://jobs.example.invalid/fabrikam/developer-platform-pm",
      title: "Developer platform product manager",
    });

    // Resume DOCX rendered at the expected path.
    const expectedDocx = path.join(workspace, "outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx");
    assert.ok(fs.existsSync(expectedDocx), `expected rendered file at ${expectedDocx}`);

    // Cover letter DOCX rendered at the expected path.
    const expectedCoverLetter = path.join(
      workspace,
      "outputs",
      "cover-letters",
      "Fabrikam AI",
      "sample-candidate-fabrikam-ai-cover-letter.docx"
    );
    assert.ok(fs.existsSync(expectedCoverLetter), `expected rendered cover letter at ${expectedCoverLetter}`);

    // Tracked role has both resume and cover letter linked.
    const [role] = readJson(paths.rolesTracked);
    assert.strictEqual(role.company, "Fabrikam AI");
    assert.strictEqual(role.resume.configPath, "resume-configs/fabrikam-ai.json");
    assert.strictEqual(role.resume.outputPath, path.join("outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx"));
    assert.strictEqual(role.resume.status, "review-needed");

    // Cover letter is linked with same shape as resume.
    assert.strictEqual(role.coverLetter.configPath, "resume-configs/fabrikam-ai-cover-letter.json");
    assert.strictEqual(
      role.coverLetter.outputPath,
      path.join("outputs", "cover-letters", "Fabrikam AI", "sample-candidate-fabrikam-ai-cover-letter.docx")
    );
    assert.strictEqual(role.coverLetter.status, "review-needed");
  });
});

test("tailor without --cover-letter flag does not create a coverLetter entry on the role", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    await command.run({
      workspace,
      config: configPath,
      url: "https://jobs.example.invalid/fabrikam/developer-platform-pm",
      title: "Developer platform product manager",
    });

    const [role] = readJson(paths.rolesTracked);
    assert.strictEqual(role.coverLetter, undefined, "coverLetter should not be set when --cover-letter is not provided");
  });
});

test("tailor with --cover-letter runs the cover letter's own independent claim audit — blocks on its unsupported claim even though the resume's own claims are all backed", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    const coverLetterConfigPath = path.join(paths.resumeConfigs, "fabrikam-ai-cover-letter.json");
    writeJson(
      coverLetterConfigPath,
      fictionalCoverLetterConfig({
        bodyParagraphs: ["I led a team that grew revenue by 40% in one year, with no matching evidence entry."],
      }),
    );

    await assert.rejects(
      () =>
        command.run({
          workspace,
          config: configPath,
          coverLetter: coverLetterConfigPath,
          url: "https://jobs.example.invalid/fabrikam/developer-platform-pm",
          title: "Developer platform product manager",
        }),
      /evidence-backed claim audit/,
      "tailor should block on the cover letter's own unsupported claim, independent of the resume's (fully-backed) claims",
    );
  });
});

test("tailor persists the resume linkage even when the cover letter step blocks afterward", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    const coverLetterConfigPath = path.join(paths.resumeConfigs, "fabrikam-ai-cover-letter.json");
    writeJson(
      coverLetterConfigPath,
      fictionalCoverLetterConfig({
        bodyParagraphs: ["I led a team that grew revenue by 40% in one year, with no matching evidence entry."],
      }),
    );

    await assert.rejects(() =>
      command.run({
        workspace,
        config: configPath,
        coverLetter: coverLetterConfigPath,
        url: "https://jobs.example.invalid/fabrikam/developer-platform-pm",
        title: "Developer platform product manager",
      }),
    );

    // Regression test (PR #67 review): the resume DOCX already rendered
    // successfully and the role was already tracked before the cover letter
    // step threw — that resume linkage must not be silently discarded just
    // because the independent cover-letter audit blocked afterward.
    const [role] = readJson(paths.rolesTracked);
    assert.ok(role, "the role should still be tracked even though the cover letter step blocked");
    assert.strictEqual(role.resume.configPath, "resume-configs/fabrikam-ai.json", "the resume linkage must survive a cover-letter-step failure");
    assert.strictEqual(role.resume.status, "review-needed");
    assert.strictEqual(role.coverLetter, undefined, "coverLetter must not be set since its own render/audit step never completed");
  });
});

// Coverage for design plan 0006 D1 (issue #128): the first tracked role ever
// added completes onboarding's checklist.

test("tailor marks onboarding-state.firstRoleAdded true after the first tracked role", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    writeJson(paths.onboardingState, defaultOnboardingState());

    await command.run({
      workspace,
      config: configPath,
      url: "https://jobs.example.invalid/fabrikam/developer-platform-pm",
      title: "Developer platform product manager",
    });

    const state = readJson(paths.onboardingState);
    assert.strictEqual(state.firstRoleAdded, true);
  });
});

test("tailor does not touch onboarding-state on a second tracked role (already true, stays true)", async () => {
  await withWorkspace({ evidenceEntries: backedEvidence }, async ({ workspace, configPath, paths }) => {
    writeJson(paths.onboardingState, defaultOnboardingState());

    await command.run({
      workspace,
      config: configPath,
      url: "https://jobs.example.invalid/fabrikam/developer-platform-pm",
      title: "Developer platform product manager",
    });

    const secondConfigPath = path.join(paths.resumeConfigs, "contoso.json");
    writeJson(secondConfigPath, fictionalConfig({ company: "Contoso" }));

    await command.run({
      workspace,
      config: secondConfigPath,
      url: "https://jobs.example.invalid/contoso/developer-platform-pm",
      title: "Developer platform product manager",
    });

    const roles = readJson(paths.rolesTracked);
    assert.strictEqual(roles.length, 2, "sanity check: a second distinct role was actually tracked");
    const state = readJson(paths.onboardingState);
    assert.strictEqual(state.firstRoleAdded, true, "still true after a second role — never reset");
  });
});
