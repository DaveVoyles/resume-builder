"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildGeneralResume, computeBaselineCoverage } = require("../../src/core/general-resume");

// Fictional data only.
const profile = {
  summary: "General leader.",
  skills: [{ name: "Roadmaps" }, "Hiring"],
  experience: [{ title: "Manager", organization: "Contoso", highlights: [{ text: "Ran planning.", evidenceIds: ["ev-1"] }, "Wrote notes."] }],
};

test("builds a config-shaped baseline from the profile", () => {
  const general = buildGeneralResume({ profile, evidence: [] });
  assert.equal(general.summary.text, "General leader.");
  const [job] = general.experienceSections[0].jobs;
  assert.deepEqual(job.bullets, ["Ran planning.", "Wrote notes."]);
  assert.deepEqual(job.bulletEvidenceIds, [["ev-1"], []]);
  assert.deepEqual(general.skills, [["Roadmaps", ""], ["Hiring", ""]]);
});

test("falls back to ingested resume pieces and the resume's Summary line", () => {
  const evidence = [
    { id: "a", type: "resume", snippet: "Pat Sample Summary Operations lead for clinics. Work history Office Manager, Riverside Dental - Ran things.", confidence: "source-text" },
    { id: "b", type: "resume", organization: "Office Manager, Riverside Dental", dateRange: "2019 to now", source: { path: "r.txt" }, metadata: { chunkKind: "bullet" }, snippet: "Ran the front desk." },
  ];
  const config = { experienceSections: [{ jobs: [{ title: "Office Manager", company: "Riverside Dental", bullets: ["x"] }] }] };
  const general = buildGeneralResume({ profile: { summary: "" }, evidence, config });
  assert.equal(general.summary.text, "Operations lead for clinics.");
  const [job] = general.experienceSections[0].jobs;
  assert.equal(job.title, "Office Manager");
  assert.equal(job.company, "Riverside Dental");
  assert.deepEqual(job.bulletEvidenceIds, [["b"]]);
});

test("returns null with nothing to build from", () => {
  assert.equal(buildGeneralResume({ profile: { summary: "", skills: [], experience: [] }, evidence: [] }), null);
  assert.equal(buildGeneralResume({}), null);
});

test("baseline coverage scores the same keywords as the stored coverage", () => {
  const general = buildGeneralResume({ profile, evidence: [] });
  const stored = { covered: [{ keyword: "planning", importance: "required" }], missing: [{ keyword: "budgeting", importance: "preferred", supported: false }] };
  const record = computeBaselineCoverage({ keywordCoverage: stored, baselineConfig: general, profile, evidence: [], source: "general-resume" });
  assert.equal(record.percent, 50);
  assert.deepEqual(record.covered.map((item) => item.keyword), ["planning"]);
  assert.equal(record.missing[0].supported, false);
  assert.equal(record.source, "general-resume");
  assert.equal(computeBaselineCoverage({ keywordCoverage: { covered: [], missing: [] }, baselineConfig: general }), null);
  assert.equal(computeBaselineCoverage({ keywordCoverage: stored, baselineConfig: null }), null);
});
