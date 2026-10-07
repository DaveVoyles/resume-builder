"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  SECTIONS,
  HOME_STEP_TO_TRACKER_STEPS,
  HOME_STEPS,
  defaultOnboardingState,
  isOnboardingComplete,
  isFirstRoleAddedDone,
  onboardingSteps,
  homeStepsFromOnboarding,
  readOnboardingState,
  updateOnboardingState,
  deriveOnboardingState,
  syncOnboardingState,
} = require("../../src/core/onboarding-state");
const { writeJson, workspacePaths } = require("../../src/core/workspace");

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
      ["Workspace created", "Your resumes and notes are read in", ...SECTIONS.map((s) => s.label), "First role added"],
    );
    assert.ok(steps.every((s) => typeof s.howTo === "string" && s.howTo.length > 0));
    assert.match(steps[1].howTo, /my-documents/);
    assert.match(steps[1].howTo, /candidate\/inputs\/resumes/);
    assert.match(steps[1].howTo, /candidate\/inputs\/notes/);
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
    assert.equal(isFirstRoleAddedDone(state.firstRoleAdded), true);
    assert.equal(state.firstRoleAdded.done, true);
    assert.equal(typeof state.firstRoleAdded.at, "string");
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

describe("HOME_STEP_TO_TRACKER_STEPS", () => {
  test("maps each of the six home steps onto tracker keys or home-only flags", () => {
    assert.deepEqual(
      HOME_STEPS.map((step) => step.key),
      ["downloadRb", "startRb", "addFiles", "answerQuestions", "firstDraft", "addJobs"],
    );
    assert.deepEqual(HOME_STEP_TO_TRACKER_STEPS.downloadRb, []);
    assert.deepEqual(HOME_STEP_TO_TRACKER_STEPS.startRb, []);
    assert.deepEqual(HOME_STEP_TO_TRACKER_STEPS.addFiles, ["materialIngested"]);
    assert.deepEqual(HOME_STEP_TO_TRACKER_STEPS.answerQuestions, ["basicInfo", "targetRole"]);
    assert.deepEqual(HOME_STEP_TO_TRACKER_STEPS.firstDraft, ["firstDraftReady"]);
    assert.deepEqual(HOME_STEP_TO_TRACKER_STEPS.addJobs, ["firstRoleAdded"]);
  });

  test("a home step is done only when every mapped tracker step is done", () => {
    const state = defaultOnboardingState();
    let home = homeStepsFromOnboarding(state);
    assert.equal(home.find((step) => step.key === "downloadRb").done, true);
    assert.equal(home.find((step) => step.key === "addFiles").done, false);
    assert.equal(home.find((step) => step.key === "answerQuestions").done, false);
    assert.equal(home.find((step) => step.key === "firstDraft").done, false);

    state.sections.basicInfo = true;
    home = homeStepsFromOnboarding(state);
    assert.equal(home.find((step) => step.key === "answerQuestions").done, false, "targetRole still pending");

    state.sections.targetRole = true;
    home = homeStepsFromOnboarding(state);
    assert.equal(home.find((step) => step.key === "answerQuestions").done, true);
    assert.equal(home.find((step) => step.key === "firstDraft").done, false);
  });

  test("Download RB and Start RB are done even when setupComplete is false", () => {
    const state = defaultOnboardingState();
    state.setupComplete = false;
    const home = homeStepsFromOnboarding(state);
    assert.equal(home.find((step) => step.key === "downloadRb").done, true);
    assert.equal(home.find((step) => step.key === "startRb").done, true);
    assert.deepEqual(home.find((step) => step.key === "downloadRb").trackerKeys, []);
    assert.deepEqual(home.find((step) => step.key === "startRb").trackerKeys, []);
  });

  test("Get your first draft is done only when firstDraftReady is true", () => {
    const state = defaultOnboardingState();
    let home = homeStepsFromOnboarding(state);
    assert.equal(home.find((step) => step.key === "firstDraft").done, false);
    state.firstDraftReady = true;
    home = homeStepsFromOnboarding(state);
    assert.equal(home.find((step) => step.key === "firstDraft").done, true);
  });
});

describe("deriveOnboardingState", () => {
  function tempWorkspace() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "onboarding-derive-"));
  }

  test("marks a section done only when its data exists", () => {
    const workspace = tempWorkspace();
    try {
      const paths = workspacePaths(workspace);
      writeJson(paths.profile, {
        candidate: { preferredName: "Jordan Sample" },
        experience: [],
        education: [],
        sources: [],
      });
      writeJson(paths.preferences, { roleTargets: [], locations: { workModes: [] }, dealBreakers: [] });
      writeJson(paths.rolesTracked, []);

      const state = deriveOnboardingState(workspace);
      assert.equal(state.setupComplete, true);
      assert.equal(state.materialIngested, false);
      assert.equal(state.sections.basicInfo, true);
      assert.equal(state.sections.workHistory, false);
      assert.equal(state.sections.education, false);
      assert.equal(state.sections.targetRole, false);
      assert.equal(state.sections.location, false);
      assert.equal(state.sections.compensation, false);
      assert.equal(state.sections.dealBreakers, false);
      assert.equal(state.firstRoleAdded, false);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("does not treat empty init dealBreakers or missing compensation as done", () => {
    const workspace = tempWorkspace();
    try {
      const paths = workspacePaths(workspace);
      writeJson(paths.profile, { candidate: {}, experience: [], education: [], sources: [] });
      writeJson(paths.preferences, { roleTargets: [], locations: { workModes: [] }, dealBreakers: [] });
      const state = deriveOnboardingState(workspace);
      assert.equal(state.sections.dealBreakers, false);
      assert.equal(state.sections.compensation, false);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("syncOnboardingState writes derived flags, not caller claims", () => {
    const workspace = tempWorkspace();
    try {
      const paths = workspacePaths(workspace);
      writeJson(paths.profile, {
        candidate: { preferredName: "Jordan Sample" },
        experience: [{ organization: "Example Corp", title: "Analyst" }],
        education: [],
        sources: [{ id: "src-001", kind: "notes", path: "inputs/notes/sample.md" }],
      });
      writeJson(paths.preferences, {
        roleTargets: [{ titles: ["Operations manager"] }],
        locations: { workModes: ["remote"] },
        dealBreakers: [],
      });
      writeJson(paths.rolesTracked, []);
      writeJson(paths.onboardingState, defaultOnboardingState());

      const state = syncOnboardingState(workspace);
      assert.equal(state.materialIngested, true);
      assert.equal(state.sections.basicInfo, true);
      assert.equal(state.sections.workHistory, true);
      assert.equal(state.sections.targetRole, true);
      assert.equal(state.sections.location, true);
      assert.equal(state.sections.education, false);
      assert.equal(state.firstRoleAdded, false);
      assert.deepEqual(readOnboardingState(paths.onboardingState), state);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("recorded skip marks education, compensation, and deal breakers done", () => {
    const workspace = tempWorkspace();
    try {
      const paths = workspacePaths(workspace);
      writeJson(paths.profile, {
        candidate: {},
        experience: [],
        education: [],
        educationSkip: { skipped: true },
        sources: [],
      });
      writeJson(paths.preferences, {
        roleTargets: [],
        locations: { workModes: [] },
        dealBreakers: [],
        compensation: { skipped: true },
        dealBreakersSkip: { skipped: true },
      });
      const state = deriveOnboardingState(workspace);
      assert.equal(state.sections.education, true);
      assert.equal(state.sections.compensation, true);
      assert.equal(state.sections.dealBreakers, true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("missing education, compensation, and deal breakers stay not done", () => {
    const workspace = tempWorkspace();
    try {
      const paths = workspacePaths(workspace);
      writeJson(paths.profile, { candidate: {}, experience: [], education: [], sources: [] });
      writeJson(paths.preferences, { roleTargets: [], locations: { workModes: [] }, dealBreakers: [] });
      const state = deriveOnboardingState(workspace);
      assert.equal(state.sections.education, false);
      assert.equal(state.sections.compensation, false);
      assert.equal(state.sections.dealBreakers, false);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("dealBreakersSkip none marks deal breakers done", () => {
    const workspace = tempWorkspace();
    try {
      const paths = workspacePaths(workspace);
      writeJson(paths.profile, { candidate: {}, experience: [], education: [], sources: [] });
      writeJson(paths.preferences, {
        roleTargets: [],
        locations: { workModes: [] },
        dealBreakers: [],
        dealBreakersSkip: { none: true },
      });
      const state = deriveOnboardingState(workspace);
      assert.equal(state.sections.dealBreakers, true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("home extra text does not mark deal breakers done", () => {
    const workspace = tempWorkspace();
    try {
      const paths = workspacePaths(workspace);
      writeJson(paths.profile, { candidate: {}, experience: [], education: [], sources: [] });
      writeJson(paths.preferences, { roleTargets: [], locations: { workModes: [] }, dealBreakers: [] });
      writeJson(path.join(workspace, "home-answers.json"), {
        extra: "Please avoid night shifts if possible",
        goal: "Operations manager",
      });
      const state = deriveOnboardingState(workspace);
      assert.equal(state.sections.dealBreakers, false);
      assert.equal(state.sections.targetRole, true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("firstDraftReady is true only when outputs/resumes has a real resume file", () => {
    const workspace = tempWorkspace();
    try {
      const paths = workspacePaths(workspace);
      writeJson(paths.profile, { candidate: {}, experience: [], education: [], sources: [] });
      writeJson(paths.preferences, { roleTargets: [], locations: { workModes: [] }, dealBreakers: [] });
      writeJson(paths.rolesTracked, []);
      fs.mkdirSync(paths.outputResumes, { recursive: true });
      fs.writeFileSync(path.join(paths.outputResumes, ".gitkeep"), "");
      fs.writeFileSync(path.join(paths.outputResumes, "README.md"), "placeholder\n");
      assert.equal(deriveOnboardingState(workspace).firstDraftReady, false);

      const companyDir = path.join(paths.outputResumes, "Example Corp");
      fs.mkdirSync(companyDir, { recursive: true });
      fs.writeFileSync(path.join(companyDir, "jordan-sample-example-corp.docx"), "docx");
      const state = deriveOnboardingState(workspace);
      assert.equal(state.firstDraftReady, true);
      const home = homeStepsFromOnboarding(state);
      assert.equal(home.find((step) => step.key === "firstDraft").done, true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("firstRoleAdded stays done after roles.tracked.json is emptied", () => {
    const workspace = tempWorkspace();
    try {
      const paths = workspacePaths(workspace);
      writeJson(paths.profile, { candidate: {}, experience: [], education: [], sources: [] });
      writeJson(paths.preferences, { roleTargets: [], locations: { workModes: [] }, dealBreakers: [] });
      writeJson(paths.rolesTracked, [{ id: "role-001", company: "Example Corp", title: "Analyst" }]);
      writeJson(paths.onboardingState, defaultOnboardingState());

      const first = syncOnboardingState(workspace);
      assert.equal(first.firstRoleAdded.done, true);
      assert.equal(typeof first.firstRoleAdded.at, "string");
      const originalAt = first.firstRoleAdded.at;

      writeJson(paths.rolesTracked, []);
      const again = syncOnboardingState(workspace);
      assert.equal(again.firstRoleAdded.done, true);
      assert.equal(again.firstRoleAdded.at, originalAt);
      assert.equal(deriveOnboardingState(workspace).firstRoleAdded, false);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  test("legacy firstRoleAdded true upgrades to { done, at } on write and stays sticky", () => {
    const workspace = tempWorkspace();
    try {
      const paths = workspacePaths(workspace);
      writeJson(paths.profile, { candidate: {}, experience: [], education: [], sources: [] });
      writeJson(paths.preferences, { roleTargets: [], locations: { workModes: [] }, dealBreakers: [] });
      writeJson(paths.rolesTracked, []);
      const legacy = defaultOnboardingState();
      legacy.firstRoleAdded = true;
      writeJson(paths.onboardingState, legacy);

      const state = syncOnboardingState(workspace);
      assert.equal(state.firstRoleAdded.done, true);
      assert.equal(typeof state.firstRoleAdded.at, "string");
      assert.equal(isOnboardingComplete({ ...state, materialIngested: true, sections: Object.fromEntries(SECTIONS.map((s) => [s.key, true])) }), true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
