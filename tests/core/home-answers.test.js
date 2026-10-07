"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { HOME_ANSWERS_FILENAME, saveHomeAnswers } = require("../../src/core/home-answers");
const { workspacePaths } = require("../../src/core/workspace");

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
    assert.equal(fs.existsSync(path.join(workspace, "output", "resume-draft-1.txt")), false);

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
