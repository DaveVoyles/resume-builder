"use strict";

const fs = require("fs");
const { renderTracker } = require("../../renderers/markdown-tracker");
const { validateEvidence, validateProfile, validateRoles } = require("../../core/schemas");
const { readJson, readJsonLines, resolveWorkspace, workspacePaths } = require("../../core/workspace");

function assertExists(file, errors) {
  if (!fs.existsSync(file)) errors.push(`Missing required file: ${file}`);
}

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const errors = [];

  [paths.profile, paths.evidence, paths.rolesSeed, paths.rolesTracked, paths.tracker].forEach((file) => assertExists(file, errors));
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const profile = readJson(paths.profile);
  const seedRoles = readJson(paths.rolesSeed);
  const trackedRoles = readJson(paths.rolesTracked);
  const evidence = readJsonLines(paths.evidence);

  errors.push(...validateProfile(profile));
  errors.push(...validateRoles(seedRoles, "roles.seed.json"));
  errors.push(...validateRoles(trackedRoles, "roles.tracked.json"));
  errors.push(...validateEvidence(evidence));

  const expectedTracker = renderTracker(trackedRoles);
  const actualTracker = fs.readFileSync(paths.tracker, "utf8");
  if (actualTracker !== expectedTracker) {
    errors.push("outputs/tracker.md is out of date with roles.tracked.json; run build-tracker");
  }

  if (errors.length > 0) throw new Error(`Workspace validation failed:\n${errors.join("\n")}`);
  console.log(`Workspace valid: ${workspace}`);
}

module.exports = { run };
