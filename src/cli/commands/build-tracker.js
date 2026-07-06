"use strict";

const { renderTracker } = require("../../renderers/markdown-tracker");
const { renderHtmlTracker } = require("../../renderers/html-tracker");
const { readJson, resolveWorkspace, workspacePaths, writeTextIfMissing } = require("../../core/workspace");

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const roles = readJson(paths.rolesTracked, []);
  const format = options.format === "html" ? "html" : "md";

  if (format === "html") {
    const output = options.output || paths.htmlTracker;
    const profile = readJson(paths.profile, {});
    const candidateName = profile.candidate?.preferredName || profile.candidate?.name;
    const title = options.title || (candidateName ? `${candidateName} - Application Tracker` : "Application Tracker");
    writeTextIfMissing(output, renderHtmlTracker(roles, { title }), true);
    console.log(`Built html tracker for ${roles.length} tracked role(s): ${output}`);
    return;
  }

  const output = options.output || paths.tracker;
  writeTextIfMissing(output, renderTracker(roles), true);
  console.log(`Built tracker for ${roles.length} tracked role(s): ${output}`);
}

module.exports = { run };
