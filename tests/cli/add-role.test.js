"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const command = require("../../src/cli/commands/add-role");
const { createDefaultProfile } = require("../../src/core/candidate-profile");
const { defaultOnboardingState, isFirstRoleAddedDone, syncOnboardingState } = require("../../src/core/onboarding-state");
const { ensureDir, readJson, workspacePaths, writeJson } = require("../../src/core/workspace");

function withWorkspace(fn) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "add-role-workspace-"));
  const paths = workspacePaths(workspace);
  ensureDir(paths.outputs);
  writeJson(paths.profile, createDefaultProfile());
  writeJson(paths.rolesTracked, []);
  writeJson(paths.rolesSeed, []);
  writeJson(paths.onboardingState, defaultOnboardingState());
  try {
    return fn({ workspace, paths });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test("add-role --tracked marks firstRoleAdded when a tracked role exists", () => {
  withWorkspace(({ workspace, paths }) => {
    command.run({
      workspace,
      tracked: true,
      company: "Example Corp",
      title: "Operations Manager",
    });
    const state = readJson(paths.onboardingState);
    assert.equal(isFirstRoleAddedDone(state.firstRoleAdded), true);
    assert.equal(state.firstRoleAdded.done, true);
    assert.equal(typeof state.firstRoleAdded.at, "string");
    assert.equal(readJson(paths.rolesTracked).length, 1);
  });
});

test("add-role without --tracked does not mark firstRoleAdded", () => {
  withWorkspace(({ workspace, paths }) => {
    command.run({
      workspace,
      company: "Example Corp",
      title: "Operations Manager",
    });
    const state = readJson(paths.onboardingState);
    assert.equal(state.firstRoleAdded, false);
    assert.equal(readJson(paths.rolesSeed).length, 1);
    assert.equal(readJson(paths.rolesTracked).length, 0);
  });
});

test("firstRoleAdded stays done after tracked roles are emptied and sync runs again", () => {
  withWorkspace(({ workspace, paths }) => {
    command.run({
      workspace,
      tracked: true,
      company: "Example Corp",
      title: "Operations Manager",
    });
    const originalAt = readJson(paths.onboardingState).firstRoleAdded.at;
    writeJson(paths.rolesTracked, []);
    const state = syncOnboardingState(workspace);
    assert.equal(state.firstRoleAdded.done, true);
    assert.equal(state.firstRoleAdded.at, originalAt);
  });
});
