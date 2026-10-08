"use strict";

process.env.RESUME_BUILDER_PAGE_CHECK = process.env.RESUME_BUILDER_PAGE_CHECK || "off";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const command = require("../../src/cli/commands/tailor");
const { readJson, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");
const { parseConfirmations } = require("../../src/core/confirmations");

// tailor must refuse a resume that says something the person said they have not
// done, before it renders a file or tracks a role.

const BULLET = "Led launch coordination for an internal developer platform used by multiple product teams.";

function resumeEntry() {
  return {
    id: "ev-001",
    type: "resume",
    fact: BULLET,
    summary: "resume source ingested from inputs/resumes/ev-001.md",
    source: { kind: "resume", path: "inputs/resumes/ev-001.md" },
    snippet: BULLET,
    confidence: "source-text",
    metadata: { sha256: "fixture", extractionMode: "utf8" },
    createdAt: "2026-06-08T12:00:00.000Z",
  };
}

function noteEntry(text) {
  return {
    id: "ev-note",
    type: "notes",
    fact: "notes source ingested",
    summary: "notes source ingested from inputs/notes/answers.md",
    source: { kind: "notes", path: "inputs/notes/answers.md" },
    snippet: text,
    confidence: "source-text",
    metadata: { sha256: "fixture-note", extractionMode: "utf8", confirmations: parseConfirmations(text) },
    createdAt: "2026-10-08T12:00:00.000Z",
  };
}

function config(summaryText) {
  return {
    schemaVersion: "1.0",
    company: "Fabrikam AI",
    candidate: { name: "Sample Candidate", headline: "Fictional engineer for tests", contact: [{ text: "Remote, US" }] },
    summary: { text: summaryText },
    experienceSections: [{ heading: "Experience", jobs: [{ title: "Senior Platform Program Manager", company: "Contoso Labs", dates: "2022 - Present", bullets: [BULLET] }] }],
    skills: [["Developer platforms", "Platform strategy, internal tooling"]],
  };
}

async function withWorkspace(summaryText, noteText, fn) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "tailor-declined-"));
  const paths = workspacePaths(workspace);
  try {
    ensureDir(paths.resumeConfigs);
    const configPath = path.join(paths.resumeConfigs, "fabrikam-ai.json");
    writeJson(configPath, config(summaryText));
    fs.writeFileSync(paths.evidence, [resumeEntry(), noteEntry(noteText)].map((entry) => JSON.stringify(entry)).join("\n") + "\n");
    writeJson(paths.profile, {
      schemaVersion: "1.0",
      candidate: { id: "test-candidate", preferredName: "Sample Candidate", links: [] },
      skills: [],
      experience: [{ id: "exp-001", organization: "Contoso Labs", title: "Senior Platform Program Manager", startDate: "2022-04", endDate: null, highlights: [{ text: BULLET }] }],
      projects: [],
      education: [],
      sources: [],
    });
    await fn({ workspace, configPath, paths });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

const OPTIONS = { url: "https://jobs.example.invalid/fabrikam/pm", title: "Program manager" };

test("tailor refuses a resume that says a keyword the person said they have not done", async () => {
  await withWorkspace("Fictional program manager who runs agile delivery for platform teams.", "Not done (2026-10-08): agile", async ({ workspace, configPath, paths }) => {
    await assert.rejects(
      () => command.run({ workspace, config: configPath, ...OPTIONS }),
      (error) => {
        assert.match(error.message, /"agile" is on your not-done list/u);
        assert.match(error.message, /summary/u);
        return true;
      },
    );
    assert.ok(!fs.existsSync(path.join(workspace, "outputs", "resumes", "Fabrikam AI")), "nothing is rendered");
    assert.deepEqual(readJson(paths.rolesTracked, []), [], "no role is tracked");
  });
});

test("tailor renders once the keyword is gone from the resume", async () => {
  await withWorkspace("Fictional program manager who ships developer platform work.", "Not done (2026-10-08): agile", async ({ workspace, configPath, paths }) => {
    await command.run({ workspace, config: configPath, ...OPTIONS });
    assert.ok(fs.existsSync(path.join(workspace, "outputs", "resumes", "Fabrikam AI")));
    assert.equal(readJson(paths.rolesTracked, []).length, 1);
  });
});

test("a later yes lets the keyword back in", async () => {
  await withWorkspace(
    "Fictional program manager who runs agile delivery for platform teams.",
    "Not done (2026-01-01): agile\nConfirmed (2026-10-08): agile. Resume line: \"Led launch coordination for an internal developer platform\"",
    async ({ workspace, configPath }) => {
      await command.run({ workspace, config: configPath, ...OPTIONS });
    },
  );
});
