"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  SECTIONS,
  defaultOnboardingState,
  isOnboardingComplete,
  onboardingSteps,
  readOnboardingState,
  updateOnboardingState,
} = require("../../src/core/onboarding-state");

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "onboarding-state-"));
  return path.join(dir, ".onboarding-state.json");
}

describe("defaultOnboardingState", () => {
  test("every step starts pending except setupComplete", () => {
    const state = defaultOnboardingState();
    assert.strictEqual(state.setupComplete, true, "setup itself just ran, so it's already done");
    assert.strictEqual(state.materialIngested, false);
    assert.strictEqual(state.firstRoleAdded, false);
    SECTIONS.forEach(({ key }) => assert.strictEqual(state.sections[key], false, `sections.${key} should start false`));
  });

  test("sections cover exactly grill.md's 7 sections, in order", () => {
    assert.deepEqual(
      SECTIONS.map((s) => s.key),
      ["basicInfo", "workHistory", "education", "targetRole", "location", "compensation", "dealBreakers"],
    );
  });
});

describe("isOnboardingComplete", () => {
  test("false for the default (fresh) state", () => {
    assert.strictEqual(isOnboardingComplete(defaultOnboardingState()), false);
  });

  test("false when every section is done but material was never ingested", () => {
    const state = defaultOnboardingState();
    SECTIONS.forEach(({ key }) => { state.sections[key] = true; });
    state.firstRoleAdded = true;
    assert.strictEqual(isOnboardingComplete(state), false);
  });

  test("false when one section is still pending", () => {
    const state = defaultOnboardingState();
    state.materialIngested = true;
    state.firstRoleAdded = true;
    SECTIONS.forEach(({ key }) => { state.sections[key] = true; });
    state.sections.compensation = false;
    assert.strictEqual(isOnboardingComplete(state), false);
  });

  test("false when no role has been added yet, even with every section done", () => {
    const state = defaultOnboardingState();
    state.materialIngested = true;
    SECTIONS.forEach(({ key }) => { state.sections[key] = true; });
    assert.strictEqual(isOnboardingComplete(state), false);
  });

  test("true only once every step is done", () => {
    const state = defaultOnboardingState();
    state.materialIngested = true;
    state.firstRoleAdded = true;
    SECTIONS.forEach(({ key }) => { state.sections[key] = true; });
    assert.strictEqual(isOnboardingComplete(state), true);
  });

  test("ignores unrecognized extra keys in the state object", () => {
    const state = defaultOnboardingState();
    state.materialIngested = true;
    state.firstRoleAdded = true;
    SECTIONS.forEach(({ key }) => { state.sections[key] = true; });
    state.someFutureFieldNotYetKnownToThisVersion = false;
    assert.strictEqual(isOnboardingComplete(state), true);
  });
});

// design plan 0006 D5 (issue #132): the single canonical step list every
// checklist renderer AND isOnboardingComplete() itself derive from.
describe("onboardingSteps", () => {
  test("produces exactly 10 steps in order: setup, material, 7 sections, first role", () => {
    const steps = onboardingSteps(defaultOnboardingState());
    assert.strictEqual(steps.length, 10);
    assert.deepEqual(
      steps.map((s) => s.label),
      ["Workspace created", "Material ingested", ...SECTIONS.map((s) => s.label), "First role added"],
    );
  });

  test("isOnboardingComplete is exactly 'every step in onboardingSteps is done' — not a separately-maintained check", () => {
    const state = defaultOnboardingState();
    state.materialIngested = true;
    state.sections.basicInfo = true;
    // Deliberately NOT complete — proves isOnboardingComplete tracks
    // onboardingSteps()'s own done flags rather than a hand-duplicated list
    // that could drift from it.
    assert.strictEqual(isOnboardingComplete(state), onboardingSteps(state).every((step) => step.done));
    assert.strictEqual(isOnboardingComplete(state), false);
  });

  test("tolerates undefined/null/{} onboardingState without throwing", () => {
    assert.doesNotThrow(() => onboardingSteps(undefined));
    assert.doesNotThrow(() => onboardingSteps(null));
    assert.doesNotThrow(() => onboardingSteps({}));
    assert.strictEqual(onboardingSteps({}).filter((s) => s.done).length, 0);
  });
});

describe("readOnboardingState / updateOnboardingState", () => {
  test("readOnboardingState falls back to the default shape when the file doesn't exist", () => {
    const file = tempFile();
    assert.deepEqual(readOnboardingState(file), defaultOnboardingState());
  });

  test("updateOnboardingState creates the file from defaults when missing, applying the patch", () => {
    const file = tempFile();
    const result = updateOnboardingState(file, { materialIngested: true });
    assert.strictEqual(result.materialIngested, true);
    assert.strictEqual(readOnboardingState(file).materialIngested, true);
  });

  test("updateOnboardingState merges a section patch without clobbering other sections", () => {
    const file = tempFile();
    updateOnboardingState(file, { sections: { workHistory: true } });
    const state = updateOnboardingState(file, { sections: { targetRole: true } });

    assert.strictEqual(state.sections.workHistory, true, "an earlier section flip must survive a later, unrelated one");
    assert.strictEqual(state.sections.targetRole, true);
    assert.strictEqual(state.sections.education, false, "sections never explicitly touched must stay at their default");
  });

  test("updateOnboardingState never resets an already-true field back to false via an unrelated patch", () => {
    const file = tempFile();
    updateOnboardingState(file, { materialIngested: true });
    const state = updateOnboardingState(file, { firstRoleAdded: true });
    assert.strictEqual(state.materialIngested, true);
    assert.strictEqual(state.firstRoleAdded, true);
  });

  test("updateOnboardingState backfills a missing sections key to false instead of dropping it", () => {
    const file = tempFile();
    // Simulates a hand-edited or pre-this-feature file whose `sections`
    // object is missing a key entirely (not just falsy) — a naive
    // `{...current.sections, ...patch.sections}` merge would silently omit
    // it from the result rather than defaulting it.
    fs.writeFileSync(file, JSON.stringify({ schemaVersion: "1.0", setupComplete: true, materialIngested: false, sections: { workHistory: true }, firstRoleAdded: false }));

    const state = updateOnboardingState(file, { materialIngested: true });

    assert.strictEqual(state.sections.workHistory, true, "the one key that was present must survive");
    SECTIONS.forEach(({ key }) => {
      if (key !== "workHistory") assert.strictEqual(state.sections[key], false, `sections.${key} must backfill to false, not be missing`);
    });
  });
});
