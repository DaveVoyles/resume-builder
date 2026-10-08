"use strict";

const { findRole } = require("./study-guide-bundle");
const buildTracker = require("./build-tracker");
const { writeTailorReport } = require("../../core/tailor-report");
const { readJson, resolveWorkspace, workspacePaths, writeJson } = require("../../core/workspace");

/**
 * Rewrites the plain-language report for a tracked role from stored data. It
 * does not render anything or touch the resume file.
 */
async function run(options) {
  if (!options.id && (!options.company || !options.title)) {
    throw new Error("tailor-report requires --id <role-id>, or --company <name> and --title <name>");
  }
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const roles = readJson(paths.rolesTracked, []);
  const role = findRole(roles, options);

  const report = writeTailorReport(workspace, role);
  role.resume = role.resume || {};
  role.resume.reportPath = report.path;
  writeJson(paths.rolesTracked, roles);
  buildTracker.rebuildTrackers(options.workspace);

  console.log(`Report ready: ${report.path}`);
  return { role, reportPath: report.path, status: report.status };
}

module.exports = { run };
