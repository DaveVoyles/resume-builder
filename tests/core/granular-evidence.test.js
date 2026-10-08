"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { chunkResumeText, splitLong, MAX_CHUNK_CHARS } = require("../../src/core/resume-chunker");
const { auditResumeConfig } = require("../../src/core/claim-audit");
const { validateResumeConfig } = require("../../src/core/resume-config");
const { validateEvidence } = require("../../src/core/schemas");

const RESUME = `Pat Example
Springfield, USA

Summary
Fictional operations lead.

Experience

Operations Lead, Acme Fictional Co — Jan 2020 - Present
- Cut onboarding time by 40% across 3 regions.
- Managed vendor contracts and
  weekly reporting.

Analyst, Globex Fictional — 2016–2020
Built the reporting pipeline.

Education
B.S. Business, Example University, 2016
`;

describe("chunkResumeText", () => {
  const chunks = chunkResumeText(RESUME);

  test("splits job headers and bullets with organization and dates", () => {
    const header = chunks.find((c) => c.kind === "job-header" && /Acme/.test(c.text));
    assert.equal(header.organization, "Operations Lead, Acme Fictional Co");
    assert.equal(header.dateRange, "Jan 2020 - Present");
    const bullet = chunks.find((c) => c.text.startsWith("Cut onboarding"));
    assert.equal(bullet.kind, "bullet");
    assert.equal(bullet.section, "Experience");
    assert.equal(bullet.dateRange, "Jan 2020 - Present");
    assert.equal(bullet.organization, "Operations Lead, Acme Fictional Co");
  });

  test("joins wrapped bullet lines and keeps paragraph text under a job", () => {
    assert.ok(chunks.some((c) => c.text === "Managed vendor contracts and weekly reporting."));
    const para = chunks.find((c) => c.text === "Built the reporting pipeline.");
    assert.equal(para.kind, "paragraph");
    assert.equal(para.dateRange, "2016–2020");
  });

  test("falls back to paragraph chunks when there are no bullets or dates", () => {
    const plain = chunkResumeText("First paragraph about work.\n\nSecond paragraph about school.");
    assert.deepEqual(plain.map((c) => c.kind), ["paragraph", "paragraph"]);
  });

  test("long text is split under the cap without losing words", () => {
    const sentence = "Delivered a result for the team and shared it widely. ";
    const long = sentence.repeat(40).trim();
    const pieces = splitLong(long);
    assert.ok(pieces.length > 1);
    assert.ok(pieces.every((piece) => piece.length <= MAX_CHUNK_CHARS));
    assert.equal(pieces.join(" ").replace(/\s+/g, " "), long);
  });

  test("a dot inside a word (Battle.net, Node.js) does not drop text", () => {
    const long = `Synced entitlements between Xbox Live and Battle.net for the acquisition. ${"Shipped the Node.js service for the team and shared it widely. ".repeat(14)}`.trim();
    const pieces = splitLong(long);
    assert.ok(pieces.length > 1);
    assert.equal(pieces.join(" ").replace(/\s+/g, " "), long);
    assert.ok(pieces[0].startsWith("Synced entitlements between Xbox Live and Battle.net"));
  });
});

function entry(id, text, extra = {}) {
  return {
    id,
    type: "resume",
    fact: text,
    summary: `resume bullet from inputs/resumes/${id}.md`,
    source: { kind: "resume", path: "inputs/resumes/r.md" },
    snippet: text,
    confidence: "source-text",
    metadata: {},
    createdAt: "2026-06-08T12:00:00.000Z",
    ...extra,
  };
}

function config(jobExtra = {}, summaryExtra = {}) {
  return {
    schemaVersion: "1.0",
    company: "Northwind",
    candidate: { name: "Pat Example", headline: "Fictional lead", contact: [{ text: "Remote" }] },
    summary: { text: "Fictional operations lead.", ...summaryExtra },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Lead",
            company: "Acme",
            dates: "2020 - Present",
            bullets: ["Cut onboarding time by 40%."],
            ...jobExtra,
          },
        ],
      },
    ],
    skills: [["Ops", "Planning"]],
  };
}

const LEDGER = [
  entry("ev-a", "Cut onboarding time by 40% across regions."),
  entry("ev-b", "Grew the team to 12 people and cut costs by 40%."),
  entry("ev-c", "Managed vendor contracts."),
  entry("ev-d", "Wrote weekly reports."),
];

describe("claim audit with evidenceIds", () => {
  test("bound claim passes when the listed entry states the number", () => {
    const result = auditResumeConfig(config({ evidenceIds: ["ev-a"] }), LEDGER);
    assert.deepEqual(result.errors, []);
    assert.ok(!result.warnings.some((w) => /Not tied/.test(w)));
  });

  test("bound claim fails when only a different entry has the number", () => {
    const result = auditResumeConfig(config({ evidenceIds: ["ev-c"] }), LEDGER);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /not backed by its listed evidence/);
    assert.match(result.errors[0], /ev-a/);
    assert.match(result.errors[0], /add its id to evidenceIds/);
  });

  test("per-bullet ids override the job-level list", () => {
    const pass = auditResumeConfig(config({ evidenceIds: ["ev-c"], bulletEvidenceIds: [["ev-b"]] }), LEDGER);
    assert.deepEqual(pass.errors, []);
  });

  test("unknown id is a blocking error that says what to do", () => {
    const result = auditResumeConfig(config({ evidenceIds: ["ev-missing"] }), LEDGER);
    assert.ok(result.errors.some((e) => /Unknown evidence id/.test(e) && /remove it from evidenceIds/.test(e)));
  });

  test("unbound claim still passes on ledger-wide match but warns", () => {
    const result = auditResumeConfig(config(), LEDGER);
    assert.deepEqual(result.errors, []);
    assert.ok(result.warnings.some((w) => /Not tied to specific evidence/.test(w) && /"40%"/.test(w)));
  });

  test("unbound claim with no ledger match is still blocking", () => {
    const result = auditResumeConfig(config(), [entry("ev-c", "Managed vendor contracts."), LEDGER[3], LEDGER[2]]);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Unsupported claim/);
  });

  test("summary evidenceIds are honoured", () => {
    const cfg = config({}, { text: "Cut costs by 40%.", evidenceIds: ["ev-c"] });
    cfg.experienceSections[0].jobs[0].evidenceIds = ["ev-a"];
    const result = auditResumeConfig(cfg, LEDGER);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /summary\.text/);
  });
});

describe("schema validation for evidence ids and chunk fields", () => {
  test("resume config accepts well-formed evidenceIds", () => {
    const cfg = config({ evidenceIds: ["ev-a"], bulletEvidenceIds: [["ev-a"]] }, { evidenceIds: ["ev-a"] });
    assert.deepEqual(validateResumeConfig(cfg).errors, []);
  });

  test("resume config rejects malformed evidenceIds", () => {
    const bad = validateResumeConfig(config({ evidenceIds: "ev-a", bulletEvidenceIds: [["ev-a"], ["ev-b"]] }));
    assert.ok(bad.errors.some((e) => /jobs\[0\]\.evidenceIds/.test(e)));
    assert.ok(bad.errors.some((e) => /bulletEvidenceIds: has 2 lists but the job has only 1 bullets/.test(e)));
    const badSummary = validateResumeConfig(config({}, { evidenceIds: [1] }));
    assert.ok(badSummary.errors.some((e) => /summary\.evidenceIds/.test(e)));
  });

  test("evidence entries accept organization, dateRange, section and reject empty ones", () => {
    assert.deepEqual(
      validateEvidence([entry("ev-a", "x 1", { organization: "Acme", dateRange: "2020 - 2022", section: "Experience" })]),
      [],
    );
    const errors = validateEvidence([entry("ev-a", "x 1", { organization: "", section: 5 })]);
    assert.equal(errors.length, 2);
  });
});
