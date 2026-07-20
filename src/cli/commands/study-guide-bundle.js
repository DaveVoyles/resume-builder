"use strict";

const fs = require("fs");
const path = require("path");
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
 * Find the role config file for a given role by matching each candidate
 * config's own `company` field (read from its content), not by guessing
 * from the filename — a filename substring match can silently return the
 * WRONG config (e.g. company "Ab" matching a file named "fabrikam-co.json"),
 * bundling the wrong role's resume into a study guide with no error. There's
 * no explicit link field between a tracked role and its config file in the
 * schema yet, so this can't disambiguate two DIFFERENT roles at the SAME
 * company that each have their own config — that case fails loud (ambiguous
 * match) rather than silently guessing, which is the safe default until a
 * schema-level link exists.
 */
function findRoleConfigPath(workspace, role) {
  const configDir = path.join(workspace, "resume-configs");

  if (!fs.existsSync(configDir)) {
    throw new Error(`Resume configs directory not found: ${configDir}`);
  }

  const files = fs.readdirSync(configDir).filter((file) => file.endsWith(".json"));
  if (files.length === 0) {
    throw new Error(
      `No resume configs found for ${role.company} — ${role.title}. Create a config in ${configDir}/<name>.json.`
    );
  }

  const companyLower = role.company.toLowerCase();
  const matches = files
    .map((file) => {
      const fullPath = path.join(configDir, file);
      try {
        return { file, fullPath, config: readJson(fullPath) };
      } catch (error) {
        return null;
      }
    })
    .filter((entry) => entry && typeof entry.config.company === "string" && entry.config.company.toLowerCase() === companyLower);

  if (matches.length === 0) {
    throw new Error(
      `Resume config not found for ${role.company} — ${role.title}. No config in ${configDir}/ has a matching "company" field. Found files: ${files.join(", ")}.`
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous resume config: ${matches.length} configs in ${configDir}/ match company "${role.company}" (${matches.map((m) => m.file).join(", ")}). This tool can't yet distinguish multiple tracked roles at the same company by config alone — consolidate or remove the extra config.`
    );
  }

  return matches[0].fullPath;
}

/**
 * Create a study guide bundle for a tracked role.
 * Gathers:
 * - candidate profile
 * - evidence ledger
 * - the role's tracked entry
 * - the role's resume config
 * - JD reference (URL from role.urls.job)
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
    jobPosting: {
      url: role.urls?.job || null,
      applyUrl: role.urls?.apply || null,
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
