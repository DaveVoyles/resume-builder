"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const command = require("../../src/cli/commands/build-tracker");
const { workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");
const { defaultOnboardingState } = require("../../src/core/onboarding-state");

// Coverage for design plan 0006 D5 (issue #132): build-tracker threads
// onboarding-state through to renderHtmlTracker when present, and stays
// unaffected (renders exactly as before) when it's absent.

function withTempWorkspace(fn) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "build-tracker-workspace-"));
  const paths = workspacePaths(workspace);
  ensureDir(paths.outputs);
  writeJson(paths.rolesTracked, []);
  writeJson(paths.profile, { candidate: {} });
  try {
    return fn({ workspace, paths });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test("build-tracker renders the normal dashboard when .onboarding-state.json is absent (older workspace)", () => {
  withTempWorkspace(({ workspace, paths }) => {
    command.run({ workspace, format: "html" });
    const html = fs.readFileSync(paths.htmlTracker, "utf8");
    assert.match(html, /class="onboarding-section" style="display:none"/);
    assert.match(html, /class="dashboard-section" style="display:block"/);
  });
});

test("build-tracker shows the checklist when .onboarding-state.json is present and incomplete", () => {
  withTempWorkspace(({ workspace, paths }) => {
    const state = defaultOnboardingState();
    state.materialIngested = true;
    writeJson(paths.onboardingState, state);

    command.run({ workspace, format: "html" });
    const html = fs.readFileSync(paths.htmlTracker, "utf8");
    assert.match(html, /class="onboarding-section" style="display:block"/);
    assert.match(html, /Onboarding: 2 of 10 steps/);
  });
});

test("build-tracker shows the completion pill once .onboarding-state.json reports every step done", () => {
  withTempWorkspace(({ workspace, paths }) => {
    const state = defaultOnboardingState();
    state.materialIngested = true;
    state.firstRoleAdded = true;
    Object.keys(state.sections).forEach((key) => { state.sections[key] = true; });
    writeJson(paths.onboardingState, state);

    command.run({ workspace, format: "html" });
    const html = fs.readFileSync(paths.htmlTracker, "utf8");
    assert.match(html, /class="dashboard-section" style="display:block"/);
    assert.match(html, /Onboarding complete/);
  });
});
