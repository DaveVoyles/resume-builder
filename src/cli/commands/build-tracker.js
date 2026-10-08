"use strict";

const fs = require("fs");
const { renderTracker } = require("../../renderers/markdown-tracker");
const { renderHtmlTracker } = require("../../renderers/html-tracker");
const { readJson, relativeToWorkspace, requireWorkspace, resolveWorkspace, workspacePaths, writeTextIfMissing } = require("../../core/workspace");
const { DEFAULT_THRESHOLDS } = require("../../core/staleness");
const { syncOnboardingState } = require("../../core/onboarding-state");

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  requireWorkspace(workspace);
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
        onboardingState = syncOnboardingState(workspace);
      } catch (error) {
        console.warn(`Warning: ignoring unreadable .onboarding-state.json (${error.message})`);
      }
    }
    writeTextIfMissing(output, renderHtmlTracker(roles, { title, stalenessThresholds, onboardingState, notice: options.notice }), true);
    if (!options.quiet) console.log(`Built html tracker for ${roles.length} tracked role(s): ${relativeToWorkspace(workspace, output)}`);
    return;
  }

  const output = options.output || paths.tracker;
  writeTextIfMissing(output, renderTracker(roles, { stalenessThresholds }), true);
  if (!options.quiet) console.log(`Built tracker for ${roles.length} tracked role(s): ${relativeToWorkspace(workspace, output)}`);
}

function rebuildTrackers(workspaceOption) {
  // Quiet: callers like home Save and ingest print their own result line.
  run({ workspace: workspaceOption, format: "md", quiet: true });
  run({ workspace: workspaceOption, format: "html", quiet: true });
}

function tryRebuildTrackers(workspaceOption) {
  try {
    rebuildTrackers(workspaceOption);
  } catch (error) {
    console.error(`Warning: tracker rebuild failed (${error && error.message ? error.message : error})`);
  }
}


module.exports = { run, rebuildTrackers, tryRebuildTrackers };
