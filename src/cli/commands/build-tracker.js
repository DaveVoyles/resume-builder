"use strict";

const { renderTracker } = require("../../renderers/markdown-tracker");
const { readJson, resolveWorkspace, workspacePaths, writeTextIfMissing } = require("../../core/workspace");

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const roles = readJson(paths.rolesTracked, []);
  const output = options.output || paths.tracker;
  writeTextIfMissing(output, renderTracker(roles), true);
  console.log(`Built tracker for ${roles.length} tracked role(s): ${output}`);
}

module.exports = { run };
