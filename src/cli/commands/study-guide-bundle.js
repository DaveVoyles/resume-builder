"use strict";

const fs = require("fs");
const path = require("path");
const { readJson, resolveWorkspace, workspacePaths, ensureDir } = require("../../core/workspace");

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
 * Find the role config file for a given role.
 * Looks for files in <workspace>/resume-configs/ matching the role's company and title.
 * Returns the full path to the config file, or throws if not found.
 */
function findRoleConfigPath(workspace, role) {
  const configDir = path.join(workspace, "resume-configs");

  if (!fs.existsSync(configDir)) {
    throw new Error(`Resume configs directory not found: ${configDir}`);
  }

  const files = fs.readdirSync(configDir);

  // Look for a config file that matches the role ID or a slug-like match
  // For now, accept any config file in the directory that exists
  // The agent is responsible for providing the correct config
  if (files.length === 0) {
    throw new Error(
      `No resume configs found for ${role.company} — ${role.title}. Create a config in ${configDir}/<name>.json.`
    );
  }

  // Try to find config by role ID (converted to kebab-case slug)
  const roleSlug = role.id.replace(/_/g, "-");
  const directMatch = files.find((f) => f.includes(roleSlug) || f.includes(role.id));
  if (directMatch) {
    return path.join(configDir, directMatch);
  }

  // Try company slug match
  const companySlug = role.company.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const companyMatches = files.filter((f) => f.includes(companySlug));
  if (companyMatches.length === 1) {
    return path.join(configDir, companyMatches[0]);
  }

  // If multiple matches or no match, require explicit config specification
  throw new Error(
    `Resume config not found for ${role.company} — ${role.title}. Found configs: ${files.join(", ")}. Specify the config path or rename it to match the role.`
  );
}

/**
 * Read all evidence from the evidence.jsonl file.
 */
function readEvidence(evidencePath) {
  if (!fs.existsSync(evidencePath)) {
    return [];
  }

  const content = fs.readFileSync(evidencePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());
  return lines.map((line) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`Failed to parse evidence line: ${line}`);
    }
  });
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
  const evidence = readEvidence(paths.evidence);

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
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

  console.log(`Created study guide bundle for ${role.company} — ${role.title}: ${bundlePath}`);
  return bundlePath;
}

module.exports = { run };
