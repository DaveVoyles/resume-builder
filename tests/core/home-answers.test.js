"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { HOME_ANSWERS_FILENAME, saveHomeAnswers, parseSalaryInput } = require("../../src/core/home-answers");
const { workspacePaths, writeJson } = require("../../src/core/workspace");

function tempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-answers-"));
}

test("saveHomeAnswers writes home-answers.json and shared onboarding state", () => {
  const workspace = tempWorkspace();
  try {
    const result = saveHomeAnswers(workspace, {
      name: "Jordan Sample",
      location: "Philadelphia, PA",
      goal: "Operations manager at a mid-size healthcare company",
      history: "Office Manager, Riverside Dental — 2019 to now",
    });
    assert.equal(result.message, "Answers saved.");
    assert.equal(result.filename, HOME_ANSWERS_FILENAME);
    assert.doesNotMatch(result.message, /draft/i);

    const answers = JSON.parse(fs.readFileSync(path.join(workspace, HOME_ANSWERS_FILENAME), "utf8"));
    assert.equal(answers.name, "Jordan Sample");
    assert.equal(answers.goal, "Operations manager at a mid-size healthcare company");

    const paths = workspacePaths(workspace);
    const state = JSON.parse(fs.readFileSync(paths.onboardingState, "utf8"));
    assert.equal(state.sections.basicInfo, true);
    assert.equal(state.sections.workHistory, true);
    assert.equal(state.sections.targetRole, true);
    assert.equal(state.sections.education, false);
    assert.equal(state.sections.compensation, false);
    assert.equal(state.sections.dealBreakers, false);
    assert.equal(state.firstDraftReady, false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("Hybrid where answer writes preferences.locations.workModes and counts for location", () => {
  const workspace = tempWorkspace();
  try {
    saveHomeAnswers(workspace, {
      name: "Jordan Sample",
      goal: "Operations manager at a mid-size healthcare company",
      where: "Hybrid",
    });
    const paths = workspacePaths(workspace);
    const preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(preferences.locations.workModes, ["hybrid"]);
    const { validatePreferences } = require("../../src/core/schemas");
    assert.deepEqual(validatePreferences(preferences), []);
    const { deriveOnboardingState } = require("../../src/core/onboarding-state");
    assert.equal(deriveOnboardingState(workspace).sections.location, true);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});


test("saveHomeAnswers rejects a missing or blank goal", () => {
  const workspace = tempWorkspace();
  try {
    assert.throws(() => saveHomeAnswers(workspace, {}), { code: "GOAL_REQUIRED" });
    assert.throws(() => saveHomeAnswers(workspace, { goal: "   " }), { code: "GOAL_REQUIRED" });
    assert.equal(fs.existsSync(path.join(workspace, HOME_ANSWERS_FILENAME)), false);
    assert.equal(fs.existsSync(path.join(workspace, ".onboarding-state.json")), false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("extra text alone leaves Deal breakers not done", () => {
  const workspace = tempWorkspace();
  try {
    const result = saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      extra: "Please avoid night shifts if possible",
    });
    assert.equal(result.state.sections.dealBreakers, false);
    const paths = workspacePaths(workspace);
    const preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.equal(preferences.dealBreakersSkip, undefined);
    assert.deepEqual(preferences.dealBreakers, []);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("deal breakers text marks Deal breakers done", () => {
  const workspace = tempWorkspace();
  try {
    const result = saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      dealBreakers: "No unpaid overtime",
    });
    assert.equal(result.state.sections.dealBreakers, true);
    const paths = workspacePaths(workspace);
    const preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.equal(preferences.dealBreakers[0].text, "No unpaid overtime");
    assert.equal(preferences.dealBreakersSkip, undefined);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("deal breakers None marks Deal breakers done", () => {
  const workspace = tempWorkspace();
  try {
    const result = saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      dealBreakersChoice: "none",
    });
    assert.equal(result.state.sections.dealBreakers, true);
    const paths = workspacePaths(workspace);
    const preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(preferences.dealBreakersSkip, { none: true });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("deal breakers Skip marks Deal breakers done", () => {
  const workspace = tempWorkspace();
  try {
    const result = saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      dealBreakersChoice: "skip",
    });
    assert.equal(result.state.sections.dealBreakers, true);
    const paths = workspacePaths(workspace);
    const preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(preferences.dealBreakersSkip, { skipped: true });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("untouched deal breakers field does not write a skip", () => {
  const workspace = tempWorkspace();
  try {
    const result = saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
    });
    assert.equal(result.state.sections.dealBreakers, false);
    const paths = workspacePaths(workspace);
    const preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.equal(preferences.dealBreakersSkip, undefined);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

function writePreferencesWorkModes(workspace, workModes) {
  const paths = workspacePaths(workspace);
  fs.writeFileSync(
    paths.preferences,
    `${JSON.stringify(
      {
        schemaVersion: "1.0",
        roleTargets: [],
        locations: {
          workModes,
          preferredRegions: [],
          excludedRegions: [],
          priority: "should",
        },
        dealBreakers: [],
      },
      null,
      2,
    )}\n`,
  );
}

test("home Save Remote keeps agent remote and hybrid without duplicating", () => {
  const workspace = tempWorkspace();
  try {
    writePreferencesWorkModes(workspace, ["remote", "hybrid"]);
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      where: "Remote (from home)",
    });
    const paths = workspacePaths(workspace);
    const preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(preferences.locations.workModes, ["remote", "hybrid"]);
    const answers = JSON.parse(fs.readFileSync(path.join(workspace, HOME_ANSWERS_FILENAME), "utf8"));
    assert.equal(answers.lastHomeWorkMode, "remote");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("home Save Remote replaces previous home on-site and keeps agent hybrid", () => {
  const workspace = tempWorkspace();
  try {
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      where: "Near where I live",
    });
    let paths = workspacePaths(workspace);
    let preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(preferences.locations.workModes, ["on-site"]);

    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      where: "Remote (from home)",
    });
    preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.equal(preferences.locations.workModes.includes("on-site"), false);
    assert.deepEqual(preferences.locations.workModes, ["remote"]);

    const withAgent = tempWorkspace();
    try {
      writePreferencesWorkModes(withAgent, ["hybrid"]);
      saveHomeAnswers(withAgent, {
        goal: "Operations manager at a mid-size healthcare company",
        where: "Near where I live",
      });
      saveHomeAnswers(withAgent, {
        goal: "Operations manager at a mid-size healthcare company",
        where: "Remote (from home)",
      });
      const agentPreferences = JSON.parse(fs.readFileSync(workspacePaths(withAgent).preferences, "utf8"));
      assert.equal(agentPreferences.locations.workModes.includes("on-site"), false);
      assert.deepEqual(agentPreferences.locations.workModes, ["hybrid", "remote"]);
    } finally {
      fs.rmSync(withAgent, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("home Save Hybrid on empty workModes writes hybrid", () => {
  const workspace = tempWorkspace();
  try {
    writePreferencesWorkModes(workspace, []);
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      where: "Hybrid",
    });
    const paths = workspacePaths(workspace);
    const preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(preferences.locations.workModes, ["hybrid"]);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("blank where Save keeps lastHomeWorkMode so a later Remote Save can replace on-site", () => {
  const workspace = tempWorkspace();
  try {
    writePreferencesWorkModes(workspace, ["hybrid"]);
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      where: "Near where I live",
    });
    const paths = workspacePaths(workspace);
    const answersPath = path.join(workspace, HOME_ANSWERS_FILENAME);
    let preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(preferences.locations.workModes, ["hybrid", "on-site"]);

    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
    });
    const blankAnswers = JSON.parse(fs.readFileSync(answersPath, "utf8"));
    assert.equal(blankAnswers.lastHomeWorkMode, "on-site");
    preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(preferences.locations.workModes, ["hybrid", "on-site"]);

    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      where: "Remote (from home)",
    });
    preferences = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.equal(preferences.locations.workModes.includes("on-site"), false);
    assert.deepEqual(preferences.locations.workModes, ["hybrid", "remote"]);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

function writeAgentProfile(workspace, education) {
  const { createDefaultProfile } = require("../../src/core/candidate-profile");
  const profile = createDefaultProfile();
  if (education) profile.education = education;
  writeJson(workspacePaths(workspace).profile, profile);
}

function writeAgentPreferences(workspace, extra) {
  writeJson(workspacePaths(workspace).preferences, {
    schemaVersion: "1.0",
    roleTargets: [],
    locations: {
      workModes: [],
      preferredRegions: [],
      excludedRegions: [],
      priority: "should",
    },
    dealBreakers: [],
    ...extra,
  });
}

function scaffoldValidate(workspace) {
  const { renderTracker } = require("../../src/renderers/markdown-tracker");
  const paths = workspacePaths(workspace);
  if (!fs.existsSync(paths.evidence)) fs.writeFileSync(paths.evidence, "");
  if (!fs.existsSync(paths.rolesSeed)) writeJson(paths.rolesSeed, []);
  if (!fs.existsSync(paths.rolesTracked)) writeJson(paths.rolesTracked, []);
  fs.mkdirSync(path.dirname(paths.tracker), { recursive: true });
  const tracked = JSON.parse(fs.readFileSync(paths.rolesTracked, "utf8"));
  fs.writeFileSync(paths.tracker, renderTracker(Array.isArray(tracked) ? tracked : []));
}

function assertSavedWorkspaceValidates(workspace) {
  const { validateProfile, validatePreferences } = require("../../src/core/schemas");
  const paths = workspacePaths(workspace);
  assert.deepEqual(validateProfile(JSON.parse(fs.readFileSync(paths.profile, "utf8"))), []);
  assert.deepEqual(validatePreferences(JSON.parse(fs.readFileSync(paths.preferences, "utf8"))), []);
  scaffoldValidate(workspace);
  require("../../src/cli/commands/validate").run({ workspace });
}

test("education filled ticks Education and validates", () => {
  const workspace = tempWorkspace();
  try {
    const result = saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      education: "Example University",
    });
    assert.equal(result.state.sections.education, true);
    const profile = JSON.parse(fs.readFileSync(workspacePaths(workspace).profile, "utf8"));
    assert.equal(profile.education[0].institution, "Example University");
    assert.equal(profile.educationSkip, undefined);
    assertSavedWorkspaceValidates(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("education skip ticks Education and validates", () => {
  const workspace = tempWorkspace();
  try {
    const result = saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      educationChoice: "skip",
    });
    assert.equal(result.state.sections.education, true);
    const profile = JSON.parse(fs.readFileSync(workspacePaths(workspace).profile, "utf8"));
    assert.deepEqual(profile.educationSkip, { skipped: true });
    assertSavedWorkspaceValidates(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("salary filled ticks Salary and validates parsed numbers", () => {
  const workspace = tempWorkspace();
  try {
    assert.equal(parseSalaryInput("120000").value, 120000);
    assert.equal(parseSalaryInput("120,000").value, 120000);
    assert.equal(parseSalaryInput("$120k").value, 120000);
    const result = saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      salary: "$120k",
    });
    assert.equal(result.state.sections.compensation, true);
    const preferences = JSON.parse(fs.readFileSync(workspacePaths(workspace).preferences, "utf8"));
    assert.equal(preferences.compensation.baseMinimum, 120000);
    assert.equal(preferences.compensation.currency, "USD");
    assert.equal(preferences.compensation.skipped, undefined);
    assertSavedWorkspaceValidates(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("salary skip ticks Salary and validates", () => {
  const workspace = tempWorkspace();
  try {
    const result = saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      salaryChoice: "skip",
    });
    assert.equal(result.state.sections.compensation, true);
    const preferences = JSON.parse(fs.readFileSync(workspacePaths(workspace).preferences, "utf8"));
    assert.deepEqual(preferences.compensation, { skipped: true });
    assertSavedWorkspaceValidates(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("unparseable salary does not write junk", () => {
  const workspace = tempWorkspace();
  try {
    assert.throws(
      () =>
        saveHomeAnswers(workspace, {
          goal: "Operations manager at a mid-size healthcare company",
          salary: "about one twenty",
        }),
      { code: "SALARY_INVALID" },
    );
    assert.equal(fs.existsSync(workspacePaths(workspace).preferences), false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("saving Education does not wipe Salary or agent values", () => {
  const workspace = tempWorkspace();
  try {
    writeAgentPreferences(workspace, {
      compensation: { currency: "USD", baseMinimum: 160000, totalTarget: 220000 },
    });
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      education: "Example University",
    });
    const preferences = JSON.parse(fs.readFileSync(workspacePaths(workspace).preferences, "utf8"));
    assert.deepEqual(preferences.compensation, { currency: "USD", baseMinimum: 160000, totalTarget: 220000 });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("Save with Salary blank leaves compensation unchanged", () => {
  const workspace = tempWorkspace();
  try {
    writeAgentPreferences(workspace, {
      compensation: { currency: "USD", baseMinimum: 160000 },
    });
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
    });
    const preferences = JSON.parse(fs.readFileSync(workspacePaths(workspace).preferences, "utf8"));
    assert.deepEqual(preferences.compensation, { currency: "USD", baseMinimum: 160000 });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("a-salary: agent compensation plus Salary Skip leaves compensation unchanged with no skipped", () => {
  const workspace = tempWorkspace();
  try {
    writeAgentPreferences(workspace, {
      compensation: { currency: "USD", baseMinimum: 160000 },
    });
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      salaryChoice: "skip",
    });
    const preferences = JSON.parse(fs.readFileSync(workspacePaths(workspace).preferences, "utf8"));
    assert.deepEqual(preferences.compensation, { currency: "USD", baseMinimum: 160000 });
    assert.equal(Object.prototype.hasOwnProperty.call(preferences.compensation, "skipped"), false);
    assertSavedWorkspaceValidates(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("a-education: agent education plus Education Skip keeps entries and does not set educationSkip", () => {
  const workspace = tempWorkspace();
  try {
    const entries = [{ id: "edu-001", institution: "Example University", degree: "B.S. Computer Science" }];
    writeAgentProfile(workspace, entries);
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      educationChoice: "skip",
    });
    const profile = JSON.parse(fs.readFileSync(workspacePaths(workspace).profile, "utf8"));
    assert.deepEqual(profile.education, entries);
    assert.equal(profile.educationSkip, undefined);
    assertSavedWorkspaceValidates(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("b-salary: skipped compensation plus Salary value stores real value only", () => {
  const workspace = tempWorkspace();
  try {
    writeAgentPreferences(workspace, { compensation: { skipped: true } });
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      salary: "120000",
    });
    const preferences = JSON.parse(fs.readFileSync(workspacePaths(workspace).preferences, "utf8"));
    assert.deepEqual(preferences.compensation, { currency: "USD", baseMinimum: 120000 });
    assert.equal(Object.prototype.hasOwnProperty.call(preferences.compensation, "skipped"), false);
    assertSavedWorkspaceValidates(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("b-education: educationSkip plus Education value writes entry and removes educationSkip", () => {
  const workspace = tempWorkspace();
  try {
    writeAgentProfile(workspace, []);
    const paths = workspacePaths(workspace);
    const profileBefore = JSON.parse(fs.readFileSync(paths.profile, "utf8"));
    profileBefore.educationSkip = { skipped: true };
    writeJson(paths.profile, profileBefore);
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      education: "Example University",
    });
    const profile = JSON.parse(fs.readFileSync(paths.profile, "utf8"));
    assert.equal(profile.education[0].institution, "Example University");
    assert.equal(profile.educationSkip, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(profile, "educationSkip"), false);
    assertSavedWorkspaceValidates(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
