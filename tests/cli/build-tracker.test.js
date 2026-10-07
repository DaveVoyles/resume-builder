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
    writeJson(paths.profile, {
      candidate: {},
      sources: [{ id: "src-001", kind: "resume", path: "inputs/resumes/sample.md" }],
    });
    writeJson(paths.onboardingState, defaultOnboardingState());

    command.run({ workspace, format: "html" });
    const html = fs.readFileSync(paths.htmlTracker, "utf8");
    assert.match(html, /class="onboarding-section" style="display:block"/);
    assert.match(html, /Onboarding: 2 of 10 steps/);
  });
});

test("build-tracker shows the completion pill once workspace files cover every step", () => {
  withTempWorkspace(({ workspace, paths }) => {
    writeJson(paths.profile, {
      candidate: { preferredName: "Jordan Sample" },
      experience: [{ organization: "Example Corp", title: "Analyst" }],
      education: [{ institution: "Example University", degree: "BA" }],
      sources: [{ id: "src-001", kind: "resume", path: "inputs/resumes/sample.md" }],
    });
    writeJson(paths.preferences, {
      roleTargets: [{ titles: ["Operations manager"] }],
      locations: { workModes: ["remote"], preferredRegions: [], excludedRegions: [] },
      compensation: { baseMinimum: 80000 },
      dealBreakers: [{ id: "deal-001", text: "No unpaid overtime" }],
    });
    writeJson(paths.rolesTracked, [{ id: "role-001", company: "Example Corp", title: "Analyst" }]);
    writeJson(paths.onboardingState, defaultOnboardingState());

    command.run({ workspace, format: "html" });
    const html = fs.readFileSync(paths.htmlTracker, "utf8");
    assert.match(html, /class="dashboard-section" style="display:block"/);
    assert.match(html, /Onboarding complete/);
  });
});

test("build-tracker degrades a corrupted .onboarding-state.json to 'absent' instead of crashing", () => {
  withTempWorkspace(({ workspace, paths }) => {
    fs.writeFileSync(paths.onboardingState, "{not valid json");

    assert.doesNotThrow(() => command.run({ workspace, format: "html" }));
    const html = fs.readFileSync(paths.htmlTracker, "utf8");
    assert.match(html, /class="onboarding-section" style="display:none"/, "an unreadable state file must render the normal dashboard, not crash the build");
  });
});

test("build-tracker with --notice flag includes the notice banner in the rendered HTML", () => {
  withTempWorkspace(({ workspace, paths }) => {
    const noticeText = "This is a test notice with <special> & characters";
    command.run({ workspace, format: "html", notice: noticeText });
    const html = fs.readFileSync(paths.htmlTracker, "utf8");

    // The notice banner should be present
    assert.match(html, /class="notice-banner"/, "notice banner must be rendered");
    // The notice text should be escaped and present
    assert.match(html, /This is a test notice with &lt;special&gt; &amp; characters/, "notice text must be HTML-escaped in the output");
  });
});

test("build-tracker without --notice flag renders no banner, preserving backward compatibility", () => {
  withTempWorkspace(({ workspace, paths }) => {
    command.run({ workspace, format: "html" });
    const html = fs.readFileSync(paths.htmlTracker, "utf8");

    // The notice banner must not appear
    assert.doesNotMatch(html, /class="notice-banner"/, "no notice banner should appear when --notice flag is not provided");
  });
});
