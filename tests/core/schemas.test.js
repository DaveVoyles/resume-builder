"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { validateEvidence } = require("../../src/core/schemas");

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function evidenceEntry(overrides = {}) {
  return {
    id: "ev-001",
    type: "resume",
    fact: "Led launch coordination for an internal developer platform.",
    summary: "resume source ingested from inputs/resumes/ev-001.md",
    source: { kind: "resume", path: "inputs/resumes/ev-001.md" },
    snippet: "Led launch coordination for an internal developer platform.",
    confidence: "source-text",
    metadata: {},
    createdAt: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateEvidence — source.kind: "intake" exemption (#103)
// ---------------------------------------------------------------------------

describe("validateEvidence — intake-kind sources", () => {
  test("passes grill.md's own documented intake evidence-source example (no path or url)", () => {
    const entry = evidenceEntry({
      fact: "Senior Platform Program Manager at Contoso Labs, 2022-04–present",
      summary: "Work history from candidate intake",
      source: { kind: "intake", note: "Candidate-provided during grill intake" },
      snippet: "I've been a Senior Platform Program Manager at Contoso Labs since April 2022.",
    });

    const errors = validateEvidence([entry]);
    assert.deepEqual(errors, []);
  });

  test("still requires source.kind on an intake entry", () => {
    const entry = evidenceEntry({ source: { note: "Candidate-provided during grill intake" } });

    const errors = validateEvidence([entry]);
    assert.ok(errors.some((e) => /source\.kind/.test(e)));
  });

  test("still requires a snippet or quote on an intake entry (the exemption only covers path/url)", () => {
    const entry = evidenceEntry({
      source: { kind: "intake", note: "Candidate-provided during grill intake" },
      snippet: "",
    });

    const errors = validateEvidence([entry]);
    assert.ok(errors.some((e) => /snippet or quote/.test(e)));
  });

  test("still requires path or url for non-intake source kinds", () => {
    const entry = evidenceEntry({ source: { kind: "resume" } });

    const errors = validateEvidence([entry]);
    assert.ok(errors.some((e) => /source: missing path or url/.test(e)));
  });

  test("passes a normal resume-kind entry with a path", () => {
    const errors = validateEvidence([evidenceEntry()]);
    assert.deepEqual(errors, []);
  });
});
