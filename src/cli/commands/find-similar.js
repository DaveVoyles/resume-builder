"use strict";

const { buildDiscovery } = require("../../core/similar-roles");
const { renderSimilarRoles } = require("../../renderers/markdown-similar-roles");
const { readJson, resolveWorkspace, workspacePaths, writeTextIfMissing } = require("../../core/workspace");

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const seedRoles = readJson(paths.rolesSeed, []);
  const preferences = readJson(paths.preferences, {});
  const trackedRoles = readJson(paths.rolesTracked, []);
  const candidates = options.candidates ? readJson(options.candidates, []) : [];
  if (!Array.isArray(candidates)) throw new Error("--candidates must point to a JSON array of manually researched roles");

  const discovery = buildDiscovery(seedRoles, preferences, trackedRoles, candidates);
  const output = options.output || paths.similarRoles;
  writeTextIfMissing(output, renderSimilarRoles(discovery, { max: options.max }), true);

  console.log(`Built similar-role review for ${discovery.recommendations.length} candidate role(s): ${output}`);
  console.log("Review candidates before adding accepted roles to roles.tracked.json.");
}

module.exports = { run };
