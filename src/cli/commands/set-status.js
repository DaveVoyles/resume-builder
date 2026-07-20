"use strict";

const { renderTracker } = require("../../renderers/markdown-tracker");
const { readJson, resolveWorkspace, workspacePaths, writeJson, writeTextIfMissing } = require("../../core/workspace");

const VALID_STATUSES = ["interested", "applied", "interview", "offer", "rejected", "withdrawn"];

function getCurrentDate() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function validateStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(
      `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(", ")}`
    );
  }
}

function findRole(roles, company, title) {
  return roles.find(
    (role) =>
      role.company.toLowerCase() === company.toLowerCase() &&
      (role.title.toLowerCase() === title.toLowerCase() ||
        role.role?.toLowerCase() === title.toLowerCase())
  );
}

async function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);

  // Validate inputs
  if (!options.company || !options.title) {
    throw new Error(
      "set-status requires --company <name> and --title <name> to match a role"
    );
  }
  if (!options.status) {
    throw new Error("set-status requires --status <status>");
  }

  validateStatus(options.status);

  // Read tracked roles
  const roles = readJson(paths.rolesTracked, []);

  // Find the role to update
  const role = findRole(roles, options.company, options.title);
  if (!role) {
    throw new Error(
      `Role not found: ${options.company} — ${options.title}. Use --company <name> --title <name> to match a tracked role.`
    );
  }

  // Update the role
  const appliedDate = options.date || getCurrentDate();
  role.status = options.status;
  role.application = role.application || {};
  role.application.appliedAt = appliedDate;
  role.updatedAt = getCurrentDate();

  // Write updated roles
  writeJson(paths.rolesTracked, roles);

  // Rebuild tracker
  const trackerContent = renderTracker(roles);
  writeTextIfMissing(paths.tracker, trackerContent, true);

  console.log(
    `Updated ${role.company} — ${role.title} to status: ${options.status} (${appliedDate})`
  );
  console.log(`Rebuilt tracker: ${paths.tracker}`);
}

module.exports = { run, VALID_STATUSES };
