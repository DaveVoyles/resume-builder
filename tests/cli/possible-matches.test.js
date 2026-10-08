"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ingest = require("../../src/cli/commands/ingest");
const tailor = require("../../src/cli/commands/tailor");
const { readJson, readJsonLines, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");
const { validateRoles } = require("../../src/core/schemas");
const { createDefaultProfile } = require("../../src/core/candidate-profile");
const { readDocxText } = require("../helpers/read-docx-text");

// Fictional data only. Nothing here applies to or submits anything.

const PUBLISH = "Led Contoso Package Publishing inside the Studio portal, cutting turnaround from 12 hours to 30 minutes with zero release risk.";
const RESUME_TEXT = [
  "Jo Example",
  "SUMMARY",
  "Program manager who ships platform work.",
  "EXPERIENCE",
  "Program Manager — Contoso 2020 – 2024",
  `• ${PUBLISH}`,
  "• Organized the office holiday party and ordered the catering.",
].join("\n");

function config(bullet = "Ran the Contoso publishing program for the Studio portal.") {
  return {
    schemaVersion: "1.0",
    company: "Fabrikam AI",
    candidate: { name: "Jo Example", headline: "Program manager", contact: [{ text: "Remote, US" }] },
    summary: { text: "Program manager who ships platform work." },
    experienceSections: [{ heading: "Experience", jobs: [{ title: "Program Manager", company: "Contoso", dates: "2020 - 2024", bullets: [bullet] }] }],
    skills: [["Programs", "Platform delivery"]],
  };
}

async function withWorkspace(fn, { note } = {}) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "possible-matches-"));
  const paths = workspacePaths(workspace);
  const log = [];
  const originalLog = console.log;
  console.log = (...args) => log.push(args.join(" "));
  try {
    ensureDir(paths.inputs);
    ensureDir(paths.outputResumes);
    ensureDir(paths.resumes);
    ensureDir(paths.notes);
    writeJson(paths.profile, createDefaultProfile());
    fs.writeFileSync(paths.evidence, "");
    fs.writeFileSync(path.join(paths.resumes, "jo.md"), RESUME_TEXT);
    if (note) fs.writeFileSync(path.join(paths.notes, "answers.md"), note);
    await ingest.run({ workspace });
    ensureDir(paths.resumeConfigs);
    const configPath = path.join(paths.resumeConfigs, "fabrikam-ai.json");
    writeJson(configPath, config());
    await fn({ workspace, paths, configPath, log });
  } finally {
    console.log = originalLog;
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

const runTailor = (workspace, configPath, keywords) =>
  tailor.run({ workspace, config: configPath, title: "Program manager", url: "https://jobs.example.invalid/fabrikam/pm", keywords });

const mdOf = (workspace, role) => fs.readFileSync(path.join(workspace, role.resume.reportPath.replace(/\.html$/u, ".md")), "utf8");

test("a possible match is shown with its quote and evidence id, asked as a question, and not added to the resume", async () => {
  await withWorkspace(async ({ workspace, paths, configPath }) => {
    await runTailor(workspace, configPath, "release management,agile");
    const [role] = readJson(paths.rolesTracked);
    const coverage = role.resume.keywordCoverage;
    const ledger = readJsonLines(paths.evidence);
    const line = ledger.find((entry) => entry.snippet === PUBLISH);
    assert.ok(line, "the resume bullet is an evidence entry");

    // Stored next to keywordCoverage, never counted as covered.
    assert.equal(coverage.percent, 0);
    assert.deepEqual(coverage.covered, []);
    assert.deepEqual(coverage.possibleMatches.map((item) => item.keyword), ["release management"]);
    assert.equal(coverage.possibleMatches[0].matches[0].evidenceId, line.id);
    assert.equal(coverage.possibleMatches[0].matches[0].quote, PUBLISH);
    assert.deepEqual(validateRoles([role], "roles"), []);

    const md = mdOf(workspace, role);
    assert.match(md, /## Possible matches in your record\. You decide\./u);
    assert.ok(md.includes(`"${PUBLISH}" (evidence ${line.id}`), "quote and evidence id are printed");
    assert.match(md, /Does this show release management\? "Led Contoso Package Publishing inside the Studio portal, cutting turnaround/u);
    assert.match(md, /Missing, and I found no proof \(don't claim\): agile\./u);
    assert.match(md, /Missing, with a possible match to review below \(not claimed\): release management\./u);
    assert.match(md, /\*\*Status: Needs your confirmation\*\*/u);

    const html = fs.readFileSync(path.join(workspace, role.resume.reportPath), "utf8");
    assert.ok(html.includes("Possible matches in your record. You decide."));
    assert.ok(html.includes(line.id));
    assert.ok(html.includes("Led Contoso Package Publishing inside the Studio portal"));

    // The suggestion never reaches the resume on its own.
    assert.deepEqual(readJson(configPath), config(), "the resume config is untouched");
    const docx = path.join(workspace, role.resume.outputPath);
    assert.ok(!/release management/iu.test(readDocxText(docx)), "the rendered resume does not say release management");
  });
});

test("a keyword with no related evidence stays on the do-not-claim list with the old question", async () => {
  await withWorkspace(async ({ workspace, paths, configPath }) => {
    await runTailor(workspace, configPath, "ServiceNow");
    const [role] = readJson(paths.rolesTracked);
    assert.deepEqual(role.resume.keywordCoverage.possibleMatches, []);
    const md = mdOf(workspace, role);
    assert.doesNotMatch(md, /Possible matches in your record/u);
    assert.match(md, /Missing, and I found no proof \(don't claim\): ServiceNow\./u);
    assert.match(md, /The posting asks for "ServiceNow", and I found nothing in your record that shows it\./u);
  });
});

test("leadership is judged like any other keyword", async () => {
  await withWorkspace(async ({ workspace, paths, configPath }) => {
    await runTailor(workspace, configPath, "leadership");
    const [role] = readJson(paths.rolesTracked);
    assert.deepEqual(role.resume.keywordCoverage.possibleMatches.map((item) => item.keyword), ["leadership"]);
    assert.match(mdOf(workspace, role), /Does this show leadership\? "Led Contoso Package Publishing/u);
  });
});

const NOTE = [
  "# My answers",
  "I read the report. Here are my answers.",
  "Confirmed (2026-10-08): release management. Resume line: \"Led Contoso Package Publishing inside the Studio portal\"",
  "Not done (2026-10-08): agile",
  "Not done (2026-10-08): leadership",
].join("\n");

test("ingest stores the yes/no answers on the note and keeps them out of the profile skills", async () => {
  await withWorkspace(async ({ paths }) => {
    const note = readJsonLines(paths.evidence).find((entry) => entry.type === "notes" && /answers\.md$/u.test(entry.source.path));
    assert.deepEqual(note.metadata.confirmations.map((item) => `${item.status}:${item.keyword}`), ["confirmed:release management", "declined:agile", "declined:leadership"]);
    const profile = readJson(paths.profile);
    assert.ok(!JSON.stringify(profile.skills || []).toLowerCase().includes("leadership"), "a keyword the person said no to is not read as their skill");
    assert.equal(note.metadata.confirmations[0].quote, "Led Contoso Package Publishing inside the Studio portal");
  }, { note: NOTE });
});

test("a confirmation note turns the suggestion into supported evidence, with the note as the source", async () => {
  await withWorkspace(async ({ workspace, paths, configPath }) => {
    const ledger = readJsonLines(paths.evidence);
    const note = ledger.find((entry) => entry.type === "notes" && /answers\.md$/u.test(entry.source.path));

    // Not on the resume yet: it is "could add", backed by the note, with no question and no suggestion.
    await runTailor(workspace, configPath, "release management,agile");
    let [role] = readJson(paths.rolesTracked);
    let coverage = role.resume.keywordCoverage;
    assert.deepEqual(coverage.possibleMatches, []);
    const release = coverage.missing.find((item) => item.keyword === "release management");
    assert.equal(release.supported, true);
    assert.equal(release.confirmed, true);
    assert.equal(release.evidenceIds[0], note.id);
    const agile = coverage.missing.find((item) => item.keyword === "agile");
    assert.equal(agile.supported, false);
    assert.equal(agile.declined, true);
    let md = mdOf(workspace, role);
    assert.match(md, /Missing, and you have the experience \(could add\): release management \(you confirmed this\)\./u);
    assert.match(md, /Missing, and you told me you have not done it \(don't claim\): agile\./u);
    assert.doesNotMatch(md, /Possible matches in your record/u);
    assert.doesNotMatch(md, /Does this show/u);
    assert.doesNotMatch(md, /The posting asks for "agile"/u, "a declined keyword is not asked about again");
    assert.match(md, /\*\*Status: Ready to review\*\*/u);

    // Used on the resume, bound to the note: it counts as covered and the report cites the note.
    const used = config("Led release management for Contoso Package Publishing inside the Studio portal.");
    used.experienceSections[0].jobs[0].bulletEvidenceIds = [[note.id]];
    writeJson(configPath, used);
    await runTailor(workspace, configPath, "release management,agile");
    [role] = readJson(paths.rolesTracked);
    coverage = role.resume.keywordCoverage;
    assert.deepEqual(coverage.covered.map((item) => item.keyword), ["release management"]);
    assert.equal(coverage.percent, 50);
    md = mdOf(workspace, role);
    assert.match(md, /release management: now in a bullet \(you confirmed this; evidence /u);
    assert.ok(md.includes(note.id));
    assert.deepEqual(validateRoles([role], "roles"), []);
  }, { note: NOTE });
});
