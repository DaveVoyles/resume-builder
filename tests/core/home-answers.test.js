"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { HOME_ANSWERS_FILENAME, saveHomeAnswers, parseSalaryInput, readHomeFormPrefill } = require("../../src/core/home-answers");
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

test("agent education prefill Save leaves education unchanged", () => {
  const workspace = tempWorkspace();
  try {
    const entries = [{ id: "edu-001", degree: "B.S. Computer Science", institution: "Example University" }];
    writeAgentProfile(workspace, entries);
    const prefill = readHomeFormPrefill(workspace);
    assert.equal(prefill.education, "B.S. Computer Science, Example University");
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      education: prefill.education,
    });
    const profile = JSON.parse(fs.readFileSync(workspacePaths(workspace).profile, "utf8"));
    assert.deepEqual(profile.education, entries);
    assert.equal(profile.education.length, 1);
    assertSavedWorkspaceValidates(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("home Education A then B replaces only the home entry", () => {
  const workspace = tempWorkspace();
  try {
    const agent = [{ id: "edu-001", institution: "Example University", degree: "B.S. Computer Science" }];
    writeAgentProfile(workspace, agent);
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      education: "A",
    });
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      education: "B",
    });
    const profile = JSON.parse(fs.readFileSync(workspacePaths(workspace).profile, "utf8"));
    assert.equal(profile.education.length, 2);
    assert.deepEqual(profile.education[0], agent[0]);
    const homeEntries = profile.education.filter((row) => row.id !== "edu-001");
    assert.equal(homeEntries.length, 1);
    assert.equal(homeEntries[0].institution, "B");
    assertSavedWorkspaceValidates(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("agent totalTarget prefill Save leaves compensation unchanged", () => {
  const workspace = tempWorkspace();
  try {
    const compensation = { currency: "USD", totalTarget: 200000 };
    writeAgentPreferences(workspace, { compensation });
    const prefill = readHomeFormPrefill(workspace);
    assert.equal(prefill.salary, "200000");
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      salary: prefill.salary,
    });
    const preferences = JSON.parse(fs.readFileSync(workspacePaths(workspace).preferences, "utf8"));
    assert.deepEqual(preferences.compensation, compensation);
    assert.equal(Object.prototype.hasOwnProperty.call(preferences.compensation, "baseMinimum"), false);
    assertSavedWorkspaceValidates(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("blank Education Save keeps lastHomeEducationId", () => {
  const workspace = tempWorkspace();
  try {
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      education: "A",
    });
    const answersPath = path.join(workspace, HOME_ANSWERS_FILENAME);
    const first = JSON.parse(fs.readFileSync(answersPath, "utf8"));
    assert.equal(first.lastHomeEducationId, "edu-001");
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
    });
    const blank = JSON.parse(fs.readFileSync(answersPath, "utf8"));
    assert.equal(blank.lastHomeEducationId, "edu-001");
    assert.equal(blank.education, "");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("blank name and location Save keeps previous home-answers and profile values", () => {
  const workspace = tempWorkspace();
  try {
    saveHomeAnswers(workspace, {
      name: "Jordan Sample",
      location: "Philadelphia, PA",
      goal: "Operations manager at a mid-size healthcare company",
    });
    saveHomeAnswers(workspace, {
      name: "",
      location: "  ",
      goal: "Operations manager at a mid-size healthcare company",
    });
    const answers = JSON.parse(fs.readFileSync(path.join(workspace, HOME_ANSWERS_FILENAME), "utf8"));
    assert.equal(answers.name, "Jordan Sample");
    assert.equal(answers.location, "Philadelphia, PA");
    const profile = JSON.parse(fs.readFileSync(workspacePaths(workspace).profile, "utf8"));
    assert.equal(profile.candidate.preferredName, "Jordan Sample");
    assert.equal(profile.candidate.location, "Philadelphia, PA");
    const prefill = readHomeFormPrefill(workspace);
    assert.equal(prefill.name, "Jordan Sample");
    assert.equal(prefill.location, "Philadelphia, PA");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("Either is fine and Willing to move round-trip as the exact where option", () => {
  const workspace = tempWorkspace();
  try {
    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      where: "Either is fine",
    });
    let preferences = JSON.parse(fs.readFileSync(workspacePaths(workspace).preferences, "utf8"));
    assert.deepEqual(preferences.locations.workModes, ["flexible"]);
    assert.equal(readHomeFormPrefill(workspace).where, "Either is fine");

    saveHomeAnswers(workspace, {
      goal: "Operations manager at a mid-size healthcare company",
      where: "Willing to move",
    });
    preferences = JSON.parse(fs.readFileSync(workspacePaths(workspace).preferences, "utf8"));
    assert.deepEqual(preferences.locations.workModes, ["flexible"]);
    assert.equal(readHomeFormPrefill(workspace).where, "Willing to move");
    assert.notEqual(readHomeFormPrefill(workspace).where, "Either is fine");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("readHomeFormPrefill fills agent profile fields when home-answers is missing", () => {
  const workspace = tempWorkspace();
  try {
    const { createDefaultProfile } = require("../../src/core/candidate-profile");
    const profile = createDefaultProfile();
    profile.candidate.preferredName = "Jordan Sample";
    profile.candidate.location = "Philadelphia, PA";
    profile.education = [{ id: "edu-001", institution: "Example University", degree: "B.S. Computer Science" }];
    writeJson(workspacePaths(workspace).profile, profile);
    writeAgentPreferences(workspace, {
      roleTargets: [{ titles: ["Operations manager"], seniority: "flexible", employmentTypes: [], priority: "should" }],
      dealBreakers: [{ id: "deal-001", text: "No unpaid overtime", priority: "must" }],
      compensation: { currency: "USD", baseMinimum: 120000 },
    });
    assert.equal(fs.existsSync(path.join(workspace, HOME_ANSWERS_FILENAME)), false);
    const prefill = readHomeFormPrefill(workspace);
    assert.equal(prefill.name, "Jordan Sample");
    assert.equal(prefill.location, "Philadelphia, PA");
    assert.equal(prefill.goal, "Operations manager");
    assert.equal(prefill.dealBreakers, "No unpaid overtime");
    assert.equal(prefill.education, "B.S. Computer Science, Example University");
    assert.equal(prefill.salary, "120000");
    assert.equal(prefill.history, "");
    assert.equal(prefill.where, "");
    assert.equal(prefill.when, "");
    assert.equal(prefill.extra, "");
    const beforeProfile = fs.readFileSync(workspacePaths(workspace).profile);
    const beforePreferences = fs.readFileSync(workspacePaths(workspace).preferences);
    saveHomeAnswers(workspace, prefill);
    assert.equal(Buffer.compare(beforeProfile, fs.readFileSync(workspacePaths(workspace).profile)), 0);
    assert.equal(Buffer.compare(beforePreferences, fs.readFileSync(workspacePaths(workspace).preferences)), 0);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("second Save with a new goal replaces the first roleTargets title", () => {
  const workspace = tempWorkspace();
  try {
    saveHomeAnswers(workspace, { goal: "Product Manager" });
    saveHomeAnswers(workspace, { goal: "Staff Engineer" });
    const preferences = JSON.parse(fs.readFileSync(workspacePaths(workspace).preferences, "utf8"));
    assert.equal(preferences.roleTargets.length, 1);
    assert.deepEqual(preferences.roleTargets[0].titles, ["Staff Engineer"]);
    assert.equal(readHomeFormPrefill(workspace).goal, "Staff Engineer");
    const answers = JSON.parse(fs.readFileSync(path.join(workspace, HOME_ANSWERS_FILENAME), "utf8"));
    assert.equal(answers.goal, "Staff Engineer");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("Save goal replaces only the first nonempty title in the first roleTargets row", () => {
  const workspace = tempWorkspace();
  try {
    const row1 = {
      titles: ["Product Manager", "Program Manager"],
      seniority: "senior",
      employmentTypes: ["full-time"],
      priority: "must",
    };
    const row2 = {
      titles: ["Operations Manager"],
      seniority: "mid",
      employmentTypes: ["contract"],
      priority: "should",
    };
    writeAgentPreferences(workspace, {
      roleTargets: [JSON.parse(JSON.stringify(row1)), JSON.parse(JSON.stringify(row2))],
    });
    const prefill = readHomeFormPrefill(workspace);
    assert.equal(prefill.goal, "Product Manager");
    saveHomeAnswers(workspace, { ...prefill, goal: "Staff Engineer" });
    const preferences = JSON.parse(fs.readFileSync(workspacePaths(workspace).preferences, "utf8"));
    assert.equal(preferences.roleTargets.length, 2);
    assert.deepEqual(preferences.roleTargets[0].titles, ["Staff Engineer", "Program Manager"]);
    const row1After = preferences.roleTargets[0];
    assert.equal(JSON.stringify({ ...row1After, titles: row1.titles }), JSON.stringify(row1));
    assert.equal(JSON.stringify(preferences.roleTargets[1]), JSON.stringify(row2));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("blank extra and history Save stores empty strings", () => {
  const workspace = tempWorkspace();
  try {
    saveHomeAnswers(workspace, {
      goal: "Product Manager",
      history: "Office Manager, Riverside Dental — 2019 to now",
      extra: "Open to healthcare operations",
    });
    saveHomeAnswers(workspace, {
      goal: "Product Manager",
      history: "",
      extra: "",
    });
    const answers = JSON.parse(fs.readFileSync(path.join(workspace, HOME_ANSWERS_FILENAME), "utf8"));
    assert.equal(answers.history, "");
    assert.equal(answers.extra, "");
    const prefill = readHomeFormPrefill(workspace);
    assert.equal(prefill.history, "");
    assert.equal(prefill.extra, "");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});


test("home work mode keeps an agent-written value when home picked the same one", () => {
  const workspace = tempWorkspace();
  try {
    const paths = workspacePaths(workspace);
    saveHomeAnswers(workspace, { goal: "PM" });
    const prefs = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    prefs.locations = { ...(prefs.locations || {}), workModes: ["remote"] };
    writeJson(paths.preferences, prefs);
    saveHomeAnswers(workspace, { goal: "PM", where: "Remote (from home)" });
    saveHomeAnswers(workspace, { goal: "PM", where: "Hybrid" });
    const after = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(after.locations.workModes.slice().sort(), ["hybrid", "remote"]);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("new Education and deal-breaker ids use highest id plus one, not the count", () => {
  const workspace = tempWorkspace();
  try {
    const paths = workspacePaths(workspace);
    saveHomeAnswers(workspace, { goal: "PM" });
    const profile = JSON.parse(fs.readFileSync(paths.profile, "utf8"));
    profile.education = [
      { id: "edu-001", institution: "A" },
      { id: "edu-003", institution: "B" },
    ];
    writeJson(paths.profile, profile);
    const prefs = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    prefs.dealBreakers = [
      { id: "deal-001", text: "x", priority: "must" },
      { id: "deal-004", text: "y", priority: "must" },
    ];
    writeJson(paths.preferences, prefs);
    saveHomeAnswers(workspace, { goal: "PM", education: "State U", dealBreakers: "No travel" });
    const p = JSON.parse(fs.readFileSync(paths.profile, "utf8"));
    const q = JSON.parse(fs.readFileSync(paths.preferences, "utf8"));
    assert.deepEqual(p.education.map((e) => e.id), ["edu-001", "edu-003", "edu-004"]);
    assert.equal(q.dealBreakers[2].id, "deal-005");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("saveHomeAnswers reports salaryChanged only when a prior amount exists and differs", () => {
  const workspace = tempWorkspace();
  try {
    const base = { name: "Jordan Sample", goal: "Operations manager" };
    const first = saveHomeAnswers(workspace, { ...base, salary: "100000" });
    assert.equal(first.salaryChanged, null);
    const same = saveHomeAnswers(workspace, { ...base, salary: "$100,000" });
    assert.equal(same.salaryChanged, null);
    const changed = saveHomeAnswers(workspace, { ...base, salary: "120k" });
    assert.deepEqual(changed.salaryChanged, { from: 100000, to: 120000 });
    const blank = saveHomeAnswers(workspace, base);
    assert.equal(blank.salaryChanged, null);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("a blank when select keeps the previous value, like where", () => {
  const workspace = tempWorkspace();
  try {
    const base = { name: "Jordan Sample", goal: "Operations manager" };
    saveHomeAnswers(workspace, { ...base, where: "Hybrid", when: "Just exploring" });
    saveHomeAnswers(workspace, { ...base, where: "", when: "" });
    const answers = JSON.parse(fs.readFileSync(path.join(workspace, HOME_ANSWERS_FILENAME), "utf8"));
    assert.equal(answers.where, "Hybrid");
    assert.equal(answers.when, "Just exploring");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
