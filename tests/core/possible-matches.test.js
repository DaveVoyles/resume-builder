"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { collectConfirmations, parseConfirmations, withoutConfirmationLines } = require("../../src/core/confirmations");
const { buildCoverageRecord, classifyMissingKeywords, scoreKeywordCoverage } = require("../../src/core/keyword-coverage");
const { findPossibleMatches } = require("../../src/core/possible-matches");
const { buildTailorPlan } = require("../../src/core/tailor-plan");
const { validateRoles } = require("../../src/core/schemas");

// Fictional data only.

function bullet(id, text, extra = {}) {
  return {
    id,
    type: "resume",
    fact: text,
    snippet: text,
    summary: `resume bullet from inputs/resumes/jo.docx`,
    source: { kind: "resume", path: "inputs/resumes/jo.docx" },
    confidence: "source-text",
    organization: "Contoso",
    dateRange: "2020 - 2024",
    metadata: { chunkKind: "bullet" },
    ...extra,
  };
}

const LINES = {
  publish: "Led Contoso Package Publishing inside the Studio portal, cutting turnaround from 12 hours to 30 minutes with zero release risk.",
  partners: "Designed transfer APIs so 8 partner systems kept their existing tools through ownership transfers.",
  unrelated: "Organized the office holiday party and ordered the catering.",
};

const evidence = [
  bullet("ev-publish", LINES.publish),
  bullet("ev-partners", LINES.partners),
  bullet("ev-party", LINES.unrelated),
  // The whole-file entry holds the entire resume; it must never be quoted as one "line".
  { id: "ev-whole", type: "resume", fact: "whole resume", snippet: `${LINES.publish} ${LINES.partners} ${LINES.unrelated}`, source: { kind: "resume", path: "inputs/resumes/jo.docx" }, confidence: "source-text", metadata: {} },
];

const CONFIRMATION_NOTE_TEXT = [
  "# My answers",
  "Confirmed (2026-10-08): release management. Resume line: \"Led Contoso Package Publishing inside the Studio portal\"",
  "Not done (2026-10-08): RAID, agile",
].join("\n");

function noteEntry(text = CONFIRMATION_NOTE_TEXT, id = "ev-note") {
  return {
    id,
    type: "notes",
    fact: "notes source ingested",
    snippet: text,
    source: { kind: "notes", path: "inputs/notes/answers.md" },
    confidence: "source-text",
    metadata: { confirmations: parseConfirmations(text) },
  };
}

describe("parseConfirmations", () => {
  test("reads confirmed and not-done lines with their dates and quoted resume lines", () => {
    const parsed = parseConfirmations([
      "Some prose that is not an answer.",
      "- Confirmed (2026-10-08): leadership. Resume line: \"Led A\" and \"Led B\"",
      "Confirmed: release management. Resume line: \"Shipped it\"",
      "Not done (2026-10-08): RAID, agile and ServiceNow",
    ].join("\n"));
    assert.deepEqual(parsed, [
      { keyword: "leadership", status: "confirmed", date: "2026-10-08", quote: "Led A | Led B" },
      { keyword: "release management", status: "confirmed", date: "", quote: "Shipped it" },
      { keyword: "RAID", status: "declined", date: "2026-10-08", quote: "" },
      { keyword: "agile", status: "declined", date: "2026-10-08", quote: "" },
      { keyword: "ServiceNow", status: "declined", date: "2026-10-08", quote: "" },
    ]);
  });

  test("withoutConfirmationLines leaves the prose and drops the answers", () => {
    assert.equal(withoutConfirmationLines(CONFIRMATION_NOTE_TEXT), "# My answers");
  });

  test("a later answer replaces an earlier one for the same keyword", () => {
    const earlier = noteEntry("Not done (2026-01-01): agile", "ev-1");
    const later = noteEntry("Confirmed (2026-02-01): agile. Resume line: \"Ran sprints\"", "ev-2");
    const latest = collectConfirmations([later, earlier]);
    assert.equal(latest.length, 1);
    assert.equal(latest[0].status, "confirmed");
    assert.equal(latest[0].evidenceId, "ev-2");
  });
});

describe("findPossibleMatches", () => {
  const support = (keywords, ledger = evidence) => classifyMissingKeywords(keywords, { evidence: ledger });

  test("suggests the line behind a keyword the ledger does not state in so many words", () => {
    const found = findPossibleMatches(support(["release management", "dependency management"]), { evidence });
    const byKeyword = new Map(found.map((item) => [item.keyword, item]));
    assert.equal(byKeyword.get("release management").matches[0].evidenceId, "ev-publish");
    assert.equal(byKeyword.get("release management").matches[0].quote, LINES.publish);
    assert.equal(byKeyword.get("dependency management").matches[0].evidenceId, "ev-partners");
  });

  test("judges leadership like any other keyword", () => {
    const found = findPossibleMatches(support(["leadership"]), { evidence });
    assert.equal(found[0].keyword, "leadership");
    assert.equal(found[0].matches[0].evidenceId, "ev-publish");
  });

  test("a keyword with no related line gets no suggestion", () => {
    assert.deepEqual(findPossibleMatches(support(["ServiceNow", "RAID", "agile"]), { evidence }), []);
  });

  test("never quotes the whole-resume entry when the resume was split into lines", () => {
    const found = findPossibleMatches(support(["release management"]), { evidence });
    assert.ok(found[0].matches.every((match) => match.evidenceId !== "ev-whole"));
  });

  test("a keyword the person already settled is not searched", () => {
    const ledger = [...evidence, noteEntry()];
    const classified = support(["release management", "agile"], ledger);
    assert.deepEqual(findPossibleMatches(classified, { evidence: ledger }), []);
  });

  test("the yes/no note itself is never offered as a suggestion", () => {
    const ledger = [noteEntry("Confirmed (2026-10-08): release management. Resume line: \"Led Contoso Package Publishing\"")];
    const found = findPossibleMatches([{ keyword: "release management", supported: false }], { evidence: ledger });
    assert.deepEqual(found, []);
  });

  test("a long line is cut at a word with an ellipsis", () => {
    const long = `Led the release of ${"a very long description ".repeat(30)}end.`;
    const found = findPossibleMatches([{ keyword: "release management", supported: false }], { evidence: [bullet("ev-long", long)] });
    const { quote } = found[0].matches[0];
    assert.ok(quote.endsWith("…") && quote.length <= 222, quote.length);
  });
});

describe("a confirmation note", () => {
  const ledger = [...evidence, noteEntry()];

  test("makes the keyword supported evidence with the note as the source", () => {
    const [release] = classifyMissingKeywords(["release management"], { evidence: ledger });
    assert.equal(release.supported, true);
    assert.equal(release.confirmed, true);
    assert.equal(release.evidenceIds[0], "ev-note");
  });

  test("a not-done line is never support, even though the note names the keyword", () => {
    const [agile, raid] = classifyMissingKeywords(["agile", "RAID"], { evidence: ledger });
    assert.equal(agile.supported, false);
    assert.equal(agile.declined, true);
    assert.deepEqual(agile.evidenceIds, []);
    assert.equal(raid.supported, false);
    assert.equal(raid.declined, true);
  });

  test("a confirmation covers the keyword's aliases only, not neighbouring keywords", () => {
    const aliasLedger = [noteEntry("Confirmed (2026-10-08): data analytics. Resume line: \"Built telemetry\"")];
    const [analytics, unrelated] = classifyMissingKeywords(["analytics", "release management"], { evidence: aliasLedger });
    assert.equal(analytics.supported, true);
    assert.equal(unrelated.supported, false);
  });

  test("the coverage record stores suggestions apart from covered and missing, and validates", () => {
    const config = { summary: { text: "Program lead." }, experienceSections: [], skills: [] };
    const result = scoreKeywordCoverage({ required: ["release management", "agile"] }, config);
    const support = classifyMissingKeywords(result.missing, { evidence });
    const possibleMatches = findPossibleMatches(support, { evidence });
    const record = buildCoverageRecord(result, support, { possibleMatches });
    assert.deepEqual(record.covered, []);
    assert.deepEqual(record.missing.map((item) => item.keyword), ["release management", "agile"]);
    assert.equal(record.possibleMatches.length, 1);
    assert.equal(record.possibleMatches[0].keyword, "release management");
    assert.equal(record.possibleMatches[0].importance, "required");
    assert.equal(record.percent, 0, "a suggestion does not raise the score");
    const role = { id: "r1", title: "T", company: "C", status: "tracked", urls: {}, notes: [], followUpQuestions: [], resume: { keywordCoverage: record } };
    assert.deepEqual(validateRoles([role], "roles"), []);
    role.resume.keywordCoverage.possibleMatches[0].matches = [{ quote: "no id" }];
    assert.ok(validateRoles([role], "roles").some((error) => /possibleMatches/u.test(error)));
  });
});

describe("tailor-plan", () => {
  test("lists a possible match apart from do-not-claim and supported, and never as supported", () => {
    const role = { id: "r1", company: "Fabrikam", title: "TPM", posting: { keywords: { required: ["release management", "agile", "Contoso"], preferred: [] } } };
    const plan = buildTailorPlan({ role, profile: null, evidence: [...evidence, noteEntry("Not done (2026-10-08): agile")] });
    assert.deepEqual(plan.keywords.possibleMatches.map((item) => item.keyword), ["release management"]);
    assert.ok(!plan.keywords.supported.some((item) => item.keyword === "release management"));
    assert.ok(!plan.keywords.doNotClaim.some((item) => item.keyword === "release management"));
    const agile = plan.keywords.doNotClaim.find((item) => item.keyword === "agile");
    assert.ok(agile && agile.declined, "a declined keyword stays on the do-not-claim list");
    assert.ok(plan.notes.some((note) => /suggestions only/u.test(note)));
    assert.ok(plan.otherEvidence.every((item) => item.id !== "ev-note"), "the yes/no note is not ranked as ordinary evidence");
  });

  test("a confirmed keyword is supported and cites the note first", () => {
    const role = { id: "r1", company: "Fabrikam", title: "TPM", posting: { keywords: { required: ["release management"], preferred: [] } } };
    const plan = buildTailorPlan({ role, profile: null, evidence: [...evidence, noteEntry()] });
    const [item] = plan.keywords.supported;
    assert.equal(item.keyword, "release management");
    assert.equal(item.confirmed, true);
    assert.equal(item.evidenceIds[0], "ev-note");
    assert.deepEqual(plan.keywords.possibleMatches, []);
  });
});
