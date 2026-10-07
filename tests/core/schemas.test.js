"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { validateEvidence, validateOnboardingState, validateProfile, validatePreferences } = require("../../src/core/schemas");
const { defaultOnboardingState } = require("../../src/core/onboarding-state");

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

// ---------------------------------------------------------------------------
// validateOnboardingState (design plan 0006 D1, issue #128)
// ---------------------------------------------------------------------------

describe("validateOnboardingState", () => {
  test("passes the default (all-pending) onboarding state", () => {
    assert.deepEqual(validateOnboardingState(defaultOnboardingState()), []);
  });

  test("passes a fully-complete onboarding state", () => {
    const state = defaultOnboardingState();
    state.materialIngested = true;
    state.firstRoleAdded = true;
    Object.keys(state.sections).forEach((key) => { state.sections[key] = true; });
    assert.deepEqual(validateOnboardingState(state), []);
  });

  test("passes firstRoleAdded object form and firstDraftReady boolean", () => {
    const state = defaultOnboardingState();
    state.firstRoleAdded = { done: true, at: "2026-10-07T12:00:00.000Z" };
    state.firstDraftReady = true;
    assert.deepEqual(validateOnboardingState(state), []);
  });

  test("flags firstRoleAdded object done without at", () => {
    const state = defaultOnboardingState();
    state.firstRoleAdded = { done: true };
    const errors = validateOnboardingState(state);
    assert.ok(errors.some((e) => /firstRoleAdded\.at/.test(e)));
  });

  test("flags a missing top-level boolean field", () => {
    const state = defaultOnboardingState();
    delete state.materialIngested;
    const errors = validateOnboardingState(state);
    assert.ok(errors.some((e) => /materialIngested must be a boolean/.test(e)));
  });

  test("flags a missing section key rather than silently ignoring it", () => {
    const state = defaultOnboardingState();
    delete state.sections.dealBreakers;
    const errors = validateOnboardingState(state);
    assert.ok(errors.some((e) => /sections\.dealBreakers must be a boolean/.test(e)));
  });

  test("flags a non-object state entirely", () => {
    const errors = validateOnboardingState(null);
    assert.ok(errors.some((e) => /must be an object/.test(e)));
  });

  test("flags a missing schemaVersion", () => {
    const state = defaultOnboardingState();
    delete state.schemaVersion;
    const errors = validateOnboardingState(state);
    assert.ok(errors.some((e) => /onboarding-state\.schemaVersion/.test(e)));
  });

  test("flags a wrong-value schemaVersion", () => {
    const state = defaultOnboardingState();
    state.schemaVersion = "2.0";
    const errors = validateOnboardingState(state);
    assert.ok(errors.some((e) => /schemaVersion: must be "1\.0"/.test(e)));
  });
});

describe("validateProfile educationSkip", () => {
  test("accepts educationSkip skipped true with an education array", () => {
    const profile = {
      candidate: { links: [] },
      skills: [],
      experience: [],
      projects: [],
      education: [],
      sources: [],
      educationSkip: { skipped: true },
    };
    assert.deepEqual(validateProfile(profile), []);
  });
});

describe("validatePreferences skip markers", () => {
  test("accepts dealBreakersSkip skipped true", () => {
    assert.deepEqual(validatePreferences({ dealBreakersSkip: { skipped: true } }), []);
  });

  test("accepts dealBreakersSkip none true", () => {
    assert.deepEqual(validatePreferences({ dealBreakersSkip: { none: true } }), []);
  });

  test("rejects dealBreakersSkip typo key", () => {
    const errors = validatePreferences({ dealBreakersSkip: { skiped: true } });
    assert.equal(errors.length > 0, true);
    assert.match(errors.join("\n"), /dealBreakersSkip/);
  });

  test("rejects dealBreakersSkip skipped yes string", () => {
    const errors = validatePreferences({ dealBreakersSkip: { skipped: "yes" } });
    assert.equal(errors.length > 0, true);
  });

  test("rejects dealBreakersSkip extra keys", () => {
    const errors = validatePreferences({ dealBreakersSkip: { skipped: true, none: true } });
    assert.equal(errors.length > 0, true);
  });

  test("accepts compensation skipped true alone", () => {
    assert.deepEqual(validatePreferences({ compensation: { skipped: true } }), []);
  });

  test("accepts compensation numbers without skipped", () => {
    assert.deepEqual(
      validatePreferences({
        compensation: { currency: "USD", baseMinimum: 160000, totalMinimum: 190000, totalTarget: 220000, publiclyShare: false },
      }),
      [],
    );
  });

  test("rejects compensation skiped typo key", () => {
    const errors = validatePreferences({ compensation: { skiped: true } });
    assert.equal(errors.length > 0, true);
    assert.match(errors.join("\n"), /skiped/);
  });

  test("rejects compensation skipped yes string", () => {
    const errors = validatePreferences({ compensation: { skipped: "yes" } });
    assert.equal(errors.length > 0, true);
  });

  test("rejects compensation skipped mixed with numbers", () => {
    const errors = validatePreferences({ compensation: { skipped: true, baseMinimum: 160000 } });
    assert.equal(errors.length > 0, true);
  });
});

