"use strict";

const buildTracker = require("./build-tracker");
const { readJson, resolveWorkspace, workspacePaths, writeJson } = require("../../core/workspace");

const VALID_STATUSES = ["interested", "applied", "interview", "offer", "rejected", "withdrawn"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

function validateDate(date) {
  if (date !== undefined && !DATE_PATTERN.test(date)) {
    throw new Error(`Invalid --date: ${date}. Expected YYYY-MM-DD format.`);
  }
}

function roleTitle(role) {
  return role.title || role.role || "";
}

function findMatchingRoles(roles, company, title) {
  const companyLower = company.toLowerCase();
  const titleLower = title.toLowerCase();
  return roles.filter(
    (role) => role.company.toLowerCase() === companyLower && roleTitle(role).toLowerCase() === titleLower
  );
}

async function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);

  // Validate inputs
  if (!options.id && (!options.company || !options.title)) {
    throw new Error(
      "set-status requires --id <role-id>, or --company <name> and --title <name> to match a role"
    );
  }
  if (!options.status) {
    throw new Error("set-status requires --status <status>");
  }

  validateStatus(options.status);
  validateDate(options.date);

  // Read tracked roles
  const roles = readJson(paths.rolesTracked, []);

  // Find the role to update. Prefer --id (unambiguous); fall back to
  // company+title, erroring instead of guessing when more than one tracked
  // role shares that company+title (e.g. a reapply after a prior rejection).
  let role;
  if (options.id) {
    role = roles.find((candidate) => candidate.id === options.id);
    if (!role) {
      throw new Error(`Role not found: no tracked role with id "${options.id}".`);
    }
  } else {
    const matches = findMatchingRoles(roles, options.company, options.title);
    if (matches.length === 0) {
      throw new Error(
        `Role not found: ${options.company} — ${options.title}. Use --company <name> --title <name> to match a tracked role.`
      );
    }
    if (matches.length > 1) {
      const ids = matches.map((match) => match.id).join(", ");
      throw new Error(
        `Ambiguous match: ${matches.length} tracked roles for ${options.company} — ${options.title} (ids: ${ids}). Re-run with --id <role-id> to disambiguate.`
      );
    }
    [role] = matches;
  }

  // Update the role. `role.status` already means "seed" vs "tracked" list
  // membership elsewhere (src/adapters/job-posting.js) — the enum status
  // lives in `role.application.status` instead, which role-view.js's
  // formatApplied() reads and displays/buckets correctly.
  role.application = role.application || {};
  role.application.status = options.status;
  // `appliedAt` marks the date the candidate actually applied — only set it
  // the first time the status becomes "applied", or on an explicit --date
  // override (trusts the caller's correction regardless of status). A role
  // that skips straight from "interested" to "interview"/"rejected" never
  // had an apply event, so appliedAt correctly stays unset; once set — by
  // that first "applied" call OR a later transition, e.g. a re-apply after
  // rejection — neither a later transition nor an idempotent repeat call to
  // "applied" may silently overwrite that historical date.
  if ((options.status === "applied" && !role.application.appliedAt) || options.date) {
    role.application.appliedAt = options.date || getCurrentDate();
  }
  role.updatedAt = getCurrentDate();

  // Write updated roles, then delegate the tracker rebuild to build-tracker
  // (re-reads the roles we just wrote) so there's one place that knows how
  // to render each format, instead of a second, drifting copy here.
  writeJson(paths.rolesTracked, roles);
  buildTracker.run({ workspace: options.workspace, format: "md" });
  buildTracker.run({ workspace: options.workspace, format: "html" });

  console.log(`Updated ${role.company} — ${roleTitle(role)} to status: ${options.status} (${role.updatedAt})`);
}

module.exports = { run, VALID_STATUSES };
