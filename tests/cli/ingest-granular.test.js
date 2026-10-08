"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const command = require("../../src/cli/commands/ingest");
const { readJsonLines, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");
const { createDefaultProfile } = require("../../src/core/candidate-profile");
const { auditResumeConfig } = require("../../src/core/claim-audit");
const { validateEvidence } = require("../../src/core/schemas");

// Resume ingest writes one evidence entry per job header, bullet, or
// paragraph (plus the original whole-file entry) so numbers deep in a resume
// can be cited on their own.

async function withWorkspace(fn) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-granular-"));
  const paths = workspacePaths(workspace);
  ensureDir(paths.inputs);
  ensureDir(paths.outputResumes);
  ensureDir(paths.resumes);
  writeJson(paths.profile, createDefaultProfile());
  fs.writeFileSync(paths.evidence, "");
  try {
    await fn({ workspace, paths });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

async function captureLogs(fn) {
  const logs = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (...args) => logs.push(args.map(String).join(" "));
  console.warn = (...args) => logs.push(args.map(String).join(" "));
  try {
    await fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }
  return logs;
}

const GRANULAR_RESUME = [
  "Pat Example",
  "",
  "Experience",
  "",
  "Operations Lead, Acme Fictional Co — 2020 to now",
  "- Ran day-to-day operations.",
  "- Cut onboarding time by 40% across the company.",
  "",
  "Analyst, Globex Fictional — 2016 to 2020",
  "- Built the weekly report.",
  "",
].join("\n");

function longResumeWithDeepMetric() {
  const filler = [];
  for (let i = 0; i < 40; i += 1) filler.push(`- Supported fictional project number ${i} with planning and documentation.`);
  return ["Experience", "", "Lead, Filler Co — 2010 to 2015", ...filler, "- Raised renewal rate by 37% in one year.", ""].join("\n");
}

test("ingest splits a resume into job headers and bullets with organization and dates", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    fs.writeFileSync(path.join(paths.resumes, "pat.md"), GRANULAR_RESUME);
    await captureLogs(() => command.run({ workspace }));
    const entries = readJsonLines(paths.evidence);
    const bullet = entries.find((entry) => entry.snippet === "Cut onboarding time by 40% across the company.");
    assert.ok(bullet, "bullet should be its own entry");
    assert.equal(bullet.organization, "Operations Lead, Acme Fictional Co");
    assert.equal(bullet.dateRange, "2020 to now");
    assert.equal(bullet.section, "Experience");
    assert.equal(bullet.confidence, "source-text");
    assert.ok(entries.some((entry) => entry.metadata.chunkKind === "job-header"));
    assert.ok(entries.some((entry) => entry.type === "resume" && !entry.metadata.chunkKind), "whole-file entry is kept");
    assert.deepEqual(validateEvidence(entries), []);
  });
});

test("a metric deep in a long resume is supportable by its own entry", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    fs.writeFileSync(path.join(paths.resumes, "long.md"), longResumeWithDeepMetric());
    await captureLogs(() => command.run({ workspace }));
    const entries = readJsonLines(paths.evidence);
    const whole = entries.find((entry) => !entry.metadata.chunkKind);
    assert.ok(!whole.snippet.includes("37%"), "whole-file snippet is cut before the metric");
    const bullet = entries.find((entry) => entry.snippet.includes("37%") && entry.metadata.chunkKind === "bullet");
    assert.ok(bullet, "the metric has its own entry");
    assert.ok(bullet.snippet.length <= 600);
    const config = {
      summary: { text: "Fictional lead." },
      experienceSections: [
        { jobs: [{ title: "Lead", company: "Filler Co", bullets: ["Raised renewal rate by 37%."], evidenceIds: [bullet.id] }] },
      ],
      skills: [],
    };
    assert.deepEqual(auditResumeConfig(config, entries).errors, []);
  });
});

test("re-running ingest on a chunked resume adds no duplicates and keeps ids stable", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    fs.writeFileSync(path.join(paths.resumes, "pat.md"), `${GRANULAR_RESUME}- Ran day-to-day operations.\n`);
    await captureLogs(() => command.run({ workspace }));
    const first = readJsonLines(paths.evidence);
    await captureLogs(() => command.run({ workspace }));
    const second = readJsonLines(paths.evidence);
    assert.equal(second.length, first.length);
    assert.deepEqual(second.map((entry) => entry.id), first.map((entry) => entry.id));
    assert.equal(new Set(second.map((entry) => entry.id)).size, second.length);
  });
});

test("a PDF resume gets a plain-language ask for a Word or text copy", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    fs.writeFileSync(path.join(paths.resumes, "old.pdf"), "%PDF-1.4 fake");
    const logs = await captureLogs(() => command.run({ workspace }));
    assert.match(logs.join("\n"), /can't read the text inside old\.pdf.*Word \(\.docx\) or plain text copy.*my-documents/);
    const entries = readJsonLines(paths.evidence);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].confidence, "metadata-only");
  });
});
