"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { declinedClaimErrors, findDeclinedClaims } = require("../../src/core/declined-guard");
const { parseConfirmations } = require("../../src/core/confirmations");

function note(text, id = "ev-note") {
  return {
    id,
    type: "notes",
    fact: "notes source ingested",
    snippet: text,
    source: { kind: "notes", path: `inputs/notes/${id}.md` },
    confidence: "source-text",
    metadata: { confirmations: parseConfirmations(text) },
  };
}

function config(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Fabrikam AI",
    candidate: { name: "Sample Candidate", headline: "Fictional program manager", contact: [{ text: "Remote, US" }] },
    summary: { text: "Fictional program manager who ships platform work." },
    experienceSections: [{ heading: "Experience", jobs: [{ title: "Program Manager", company: "Contoso", dates: "2022 - Present", bullets: ["Shipped a publishing pipeline for partner teams."] }] }],
    skills: [["Delivery", "Publishing, partner systems"]],
    ...overrides,
  };
}

describe("findDeclinedClaims", () => {
  const declined = [note("Not done (2026-10-08): RAID, agile, ServiceNow")];

  test("a resume that never says a declined keyword passes", () => {
    assert.deepEqual(findDeclinedClaims(config(), declined), []);
  });

  test("finds the keyword in the summary, a bullet, a skills row and the headline", () => {
    const bad = config({
      candidate: { name: "Sample Candidate", headline: "Agile program manager", contact: [{ text: "Remote, US" }] },
      summary: { text: "Runs agile delivery for platform work." },
      experienceSections: [{ heading: "Experience", jobs: [{ title: "PM", company: "Contoso", dates: "2022 - Present", bullets: ["Ran an agile ceremony cadence."] }] }],
      skills: [["Tools", "ServiceNow, Jira"]],
    });
    const where = findDeclinedClaims(bad, declined).map((item) => `${item.keyword}: ${item.where}`);
    assert.ok(where.some((line) => /agile: summary/u.test(line)), where.join("\n"));
    assert.ok(where.some((line) => /agile: bullet 1 of PM at Contoso/u.test(line)));
    assert.ok(where.some((line) => /agile: headline/u.test(line)));
    assert.ok(where.some((line) => /ServiceNow: skills: Tools/u.test(line)));
  });

  test("matches whole words only, so a longer word is not a hit", () => {
    const fine = config({ summary: { text: "Built an agility program and a raider-proof rollout." } });
    assert.deepEqual(findDeclinedClaims(fine, declined), []);
  });

  test("a later yes replaces an earlier no", () => {
    const evidence = [note("Not done (2026-01-01): agile", "ev-1"), note("Confirmed (2026-10-08): agile. Resume line: \"Ran agile sprints\"", "ev-2")];
    assert.deepEqual(findDeclinedClaims(config({ summary: { text: "Runs agile delivery." } }), evidence), []);
  });

  test("a confirmed keyword is never blocked", () => {
    const evidence = [note("Confirmed (2026-10-08): release management. Resume line: \"Led releases\"")];
    assert.deepEqual(findDeclinedClaims(config({ summary: { text: "Led release management for partners." } }), evidence), []);
  });

  test("no notes means nothing is blocked", () => {
    assert.deepEqual(findDeclinedClaims(config({ summary: { text: "Runs agile delivery." } }), []), []);
  });
});

describe("declinedClaimErrors", () => {
  test("one plain-language line per keyword, naming every place and the evidence", () => {
    const bad = config({
      summary: { text: "Runs agile delivery." },
      experienceSections: [{ heading: "Experience", jobs: [{ title: "PM", company: "Contoso", dates: "2022 - Present", bullets: ["Ran an agile cadence."] }] }],
    });
    const errors = declinedClaimErrors(bad, [note("Not done (2026-10-08): agile")]);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /"agile" is on your not-done list/u);
    assert.match(errors[0], /summary; bullet 1 of PM at Contoso/u);
    assert.match(errors[0], /ev-note/u);
    assert.match(errors[0], /2026-10-08/u);
  });
});
