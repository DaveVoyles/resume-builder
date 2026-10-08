"use strict";

const fs = require("fs");
const path = require("path");
const { readStoredPostingText } = require("../../core/role-posting");
const { readJson, readJsonLines, resolveWorkspace, workspacePaths, ensureDir, writeJson } = require("../../core/workspace");

/**
 * Find a role in the tracked roles list.
 * If id is provided, find by ID.
 * If company and title are provided, find by company+title.
 * Throws if role is not found or if multiple roles match company+title.
 */
function findRole(roles, options) {
  if (options.id) {
    const role = roles.find((r) => r.id === options.id);
    if (!role) {
      throw new Error(`Role not found: no tracked role with id "${options.id}".`);
    }
    return role;
  }

  if (options.company && options.title) {
    const companyLower = options.company.toLowerCase();
    const titleLower = options.title.toLowerCase();
    const matches = roles.filter(
      (r) => r.company.toLowerCase() === companyLower && (r.title.toLowerCase() === titleLower || (r.role && r.role.toLowerCase() === titleLower))
    );

    if (matches.length === 0) {
      throw new Error(`Role not found: ${options.company} — ${options.title}.`);
    }
    if (matches.length > 1) {
      const ids = matches.map((m) => m.id).join(", ");
      throw new Error(
        `Ambiguous match: ${matches.length} tracked roles for ${options.company} — ${options.title} (ids: ${ids}). Re-run with --id <role-id> to disambiguate.`
      );
    }

    return matches[0];
  }

  throw new Error("study-guide-bundle requires --id <role-id>, or --company <name> and --title <name>");
}

/**
 * A role registered via `tailor` carries an explicit `resume.configPath` link
 * back to the exact config it rendered, relative to the workspace root (see
 * src/cli/commands/tailor.js). roles.tracked.json is hand-editable, so a
 * `../`-laden or absolute value must not be trusted to escape the workspace:
 * an escaping path is treated the same as a missing file.
 */
function findLinkedConfigPath(workspace, role) {
  const configPath = role.resume?.configPath;
  if (!configPath) return null;
  const workspaceRoot = path.resolve(workspace);
  const fullPath = path.resolve(workspaceRoot, configPath);
  if (fullPath !== workspaceRoot && !fullPath.startsWith(workspaceRoot + path.sep)) return null;
  return fs.existsSync(fullPath) ? fullPath : null;
}

/**
 * The resume config for a role comes ONLY from the role's own
 * `resume.configPath` link (written by `tailor`). Matching by company name
 * is gone: two roles at one company can each have their own config, and a
 * name match would quietly bundle the wrong one. A role without a usable
 * link fails loud with the fix.
 */
function findRoleConfigPath(workspace, role) {
  const linked = findLinkedConfigPath(workspace, role);
  if (linked) return linked;
  const label = `${role.company} — ${role.title}`;
  if (!role.resume?.configPath) {
    throw new Error(
      `No resume is linked to ${label} (role id ${role.id}). Run tailor for this role first so its resume config is recorded, then re-run study-guide-bundle.`
    );
  }
  throw new Error(
    `The resume config linked to ${label} (${role.resume.configPath}) was not found inside the workspace. Re-run tailor for this role to relink it.`
  );
}

/**
 * Create a study guide bundle for a tracked role.
 * Gathers:
 * - candidate profile
 * - evidence ledger
 * - the role's tracked entry
 * - the role's resume config
 * - JD reference (URL from role.urls.job) plus the stored posting text and keywords
 *
 * Writes to outputs/study-guide-bundles/<role-id>.json
 */
async function run(options) {
  if (!options.id && (!options.company || !options.title)) {
    throw new Error(
      "study-guide-bundle requires --id <role-id>, or --company <name> and --title <name> to match a role"
    );
  }

  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);

  // Load profile
  const profile = readJson(paths.profile);

  // Load evidence
  const evidence = readJsonLines(paths.evidence);

  // Load tracked roles
  const rolesTracked = readJson(paths.rolesTracked, []);

  // Find the role
  const role = findRole(rolesTracked, options);

  // Find and load the resume config
  const roleConfigPath = findRoleConfigPath(workspace, role);
  const resumeConfig = readJson(roleConfigPath);

  // Create the bundle
  const bundle = {
    role,
    profile,
    evidence,
    resumeConfig,
    coverLetterOutputPath: role.coverLetter?.outputPath || null,
    jobPosting: {
      url: role.urls?.job || null,
      applyUrl: role.urls?.apply || null,
      // Stored posting (add-role --jd-file); null fields mean "only the URL is known".
      text: readStoredPostingText(workspace, role),
      path: role.posting?.path || null,
      source: role.posting?.source || null,
      fetchedAt: role.posting?.fetchedAt || null,
      keywords: role.posting?.keywords || null,
    },
    generatedAt: new Date().toISOString(),
  };

  // Write bundle to outputs/study-guide-bundles/<role-id>.json
  const bundleDir = path.join(paths.outputs, "study-guide-bundles");
  ensureDir(bundleDir);
  const bundlePath = path.join(bundleDir, `${role.id}.json`);
  writeJson(bundlePath, bundle);

  console.log(`Created study guide bundle for ${role.company} — ${role.title}: ${bundlePath}`);
  return bundlePath;
}

module.exports = { run };
