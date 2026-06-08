"use strict";

const { createRole } = require("../../adapters/job-posting");
const { readJson, resolveWorkspace, workspacePaths, writeJson } = require("../../core/workspace");

function roleListPath(paths, role) {
  return role.status === "tracked" ? paths.rolesTracked : paths.rolesSeed;
}

function isDuplicate(existing, nextRole) {
  return existing.some((role) => {
    const sameId = role.id === nextRole.id;
    const sameJobUrl = role.urls?.job && role.urls.job === nextRole.urls.job;
    return sameId || sameJobUrl;
  });
}

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const role = createRole(options);
  const file = roleListPath(paths, role);
  const roles = readJson(file, []);

  if (isDuplicate(roles, role)) {
    console.log(`Role already exists in ${role.status}: ${role.company} — ${role.title}`);
    return;
  }

  writeJson(file, roles.concat(role));
  console.log(`Added ${role.status} role: ${role.company} — ${role.title}`);
  if (role.status === "tracked") console.log("Run build-tracker to refresh outputs/tracker.md.");
}

module.exports = { run };
