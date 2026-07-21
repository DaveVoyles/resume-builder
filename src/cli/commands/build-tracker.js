"use strict";

const fs = require("fs");
const { renderTracker } = require("../../renderers/markdown-tracker");
const { renderHtmlTracker } = require("../../renderers/html-tracker");
const { readJson, resolveWorkspace, workspacePaths, writeTextIfMissing } = require("../../core/workspace");
const { DEFAULT_THRESHOLDS } = require("../../core/staleness");

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const roles = readJson(paths.rolesTracked, []);
  const format = options.format === "html" ? "html" : "md";

  // Load staleness thresholds from preferences, falling back to defaults.
  const preferences = readJson(paths.preferences, {});
  const stalenessThresholds = preferences.stalenessThresholds || DEFAULT_THRESHOLDS;

  if (format === "html") {
    const output = options.output || paths.htmlTracker;
    const profile = readJson(paths.profile, {});
    const candidateName = profile.candidate?.preferredName || profile.candidate?.name;
    const title = options.title || (candidateName ? `${candidateName} - Application Tracker` : "Application Tracker");
    // Optional, same as preferences.stalenessThresholds above — older
    // workspaces created before design plan 0006 render exactly as before.
    // A corrupted onboarding-state.json degrades to "absent" rather than
    // crashing the whole build — this file's job is building the tracker,
    // not validating the workspace (that's `validate`'s job).
    let onboardingState;
    if (fs.existsSync(paths.onboardingState)) {
      try {
        onboardingState = readJson(paths.onboardingState);
      } catch (error) {
        console.warn(`Warning: ignoring unreadable .onboarding-state.json (${error.message})`);
      }
    }
    writeTextIfMissing(output, renderHtmlTracker(roles, { title, stalenessThresholds, onboardingState }), true);
    console.log(`Built html tracker for ${roles.length} tracked role(s): ${output}`);
    return;
  }

  const output = options.output || paths.tracker;
  writeTextIfMissing(output, renderTracker(roles, { stalenessThresholds }), true);
  console.log(`Built tracker for ${roles.length} tracked role(s): ${output}`);
}

module.exports = { run };
