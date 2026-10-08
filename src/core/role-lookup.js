"use strict";

const path = require("path");

/**
 * Finds one tracked role by --id, or by --company and --title (title matches
 * `title` or `role`). Throws when nothing matches or when company + title is
 * ambiguous (the message lists the ids so the caller can re-run with --id).
 */
function findTrackedRole(roles, options, commandName) {
  if (options.id) {
    const role = roles.find((candidate) => candidate.id === options.id);
    if (!role) throw new Error(`Role not found: no tracked role with id "${options.id}".`);
    return role;
  }
  if (options.company && options.title) {
    const company = String(options.company).toLowerCase();
    const title = String(options.title).toLowerCase();
    const matches = roles.filter((role) => String(role.company || "").toLowerCase() === company
      && (String(role.title || "").toLowerCase() === title || String(role.role || "").toLowerCase() === title));
    if (matches.length === 0) throw new Error(`Role not found: ${options.company} — ${options.title}.`);
    if (matches.length > 1) {
      throw new Error(`Ambiguous match: ${matches.length} tracked roles for ${options.company} — ${options.title} (ids: ${matches.map((m) => m.id).join(", ")}). Re-run with --id <role-id> to disambiguate.`);
    }
    return matches[0];
  }
  throw new Error(`${commandName} requires --id <role-id>, or --company <name> and --title <name>`);
}

/** True when the options name a role (so a command may look one up). */
function namesRole(options) {
  return Boolean(options.id || (options.company && options.title));
}

/** A path safe to print: relative to the current folder when inside it, else relative to the workspace. */
function displayPath(workspace, file) {
  const absolute = path.resolve(file);
  const fromCwd = path.relative(process.cwd(), absolute);
  if (fromCwd && !fromCwd.startsWith("..") && !path.isAbsolute(fromCwd)) return fromCwd.split(path.sep).join("/");
  return path.relative(workspace, absolute).split(path.sep).join("/");
}

module.exports = { displayPath, findTrackedRole, namesRole };
