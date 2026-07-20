"use strict";

const buildTracker = require("./build-tracker");
const { readJson, resolveWorkspace, workspacePaths, writeJson } = require("../../core/workspace");

const VALID_STATUSES = ["interested", "applied", "interview", "offer", "rejected", "withdrawn"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Rule table for auto-generating nextAction on status transitions
const NEXT_ACTION_RULES = {
  applied: {
    type: "follow-up",
    dueDateOffsetDays: 7,
    note: "check in if no response",
  },
  interview: {
    type: "follow-up",
    dueDateOffsetDays: 1,
    note: "send thank-you",
  },
  offer: {
    type: "follow-up",
    dueDateOffsetDays: 2,
    note: "respond to offer",
  },
  rejected: {
    type: "close",
    // no dueDate, no note
  },
  withdrawn: {
    type: "close",
    // no dueDate, no note
  },
  // interested: untouched entirely
};

function getCurrentDate() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function addDays(dateStr, days) {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
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

  // Auto-generate nextAction based on status transition, per the rule table
  const rule = NEXT_ACTION_RULES[options.status];
  if (rule) {
    if (options.status === "interested") {
      // interested leaves nextAction untouched entirely
      // (rule exists to document this, but takes no action)
    } else if (options.status === "rejected" || options.status === "withdrawn") {
      // Clear nextAction to close type
      role.nextAction = { type: "close" };
    } else {
      // applied, interview, offer: set to follow-up with computed dueDate
      const statusDate = options.date || getCurrentDate();
      const dueDate = addDays(statusDate, rule.dueDateOffsetDays);
      role.nextAction = {
        type: rule.type,
        owner: "candidate",
        dueDate,
      };
      // Append note to notes array
      if (!Array.isArray(role.notes)) {
        role.notes = [];
      }
      if (rule.note) {
        role.notes.push(rule.note);
      }
    }
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
