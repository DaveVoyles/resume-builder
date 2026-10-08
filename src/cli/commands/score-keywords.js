"use strict";

const path = require("path");
const { buildCoverageRecord, classifyMissingKeywords, scoreKeywordCoverage } = require("../../core/keyword-coverage");
const { rebuildTrackers } = require("./build-tracker");
const { findTrackedRole, namesRole } = require("../../core/role-lookup");
const { hasPosting } = require("../../core/role-posting");
const { loadResumeConfig } = require("../../core/resume-config");
const { readJson, readJsonLines, resolveWorkspace, workspacePaths, writeJson } = require("../../core/workspace");

/**
 * score-keywords --config <resume-config.json> --keywords <keywords.json> [--json]
 * score-keywords --config <resume-config.json> --workspace <dir> (--id <role-id> | --company <name> --title <name>) [--keywords <keywords.json>] [--json]
 *
 * With a role (--id, or --company and --title) the result is saved on the role
 * as resume.keywordCoverage; without --keywords the role's stored posting
 * keywords (required and preferred) are scored.
 */
async function run(options) {
  if (!options.config) {
    throw new Error("score-keywords requires --config <path-to-resume-config.json>");
  }
  const roleRequested = namesRole(options);
  if (!options.keywords && !roleRequested) {
    throw new Error("score-keywords requires --keywords <path-to-keywords.json> (or a role: --id, or --company and --title, to use its stored posting keywords)");
  }

  const configPath = path.resolve(process.cwd(), options.config);
  const resumeConfig = loadResumeConfig(configPath);

  let role = null;
  let roles = null;
  let paths = null;
  if (roleRequested) {
    paths = workspacePaths(resolveWorkspace(options.workspace));
    roles = readJson(paths.rolesTracked, []);
    role = findTrackedRole(roles, options, "score-keywords");
  }

  let keywords;
  let source;
  if (options.keywords) {
    keywords = readJson(path.resolve(process.cwd(), options.keywords));
    if (!Array.isArray(keywords)) {
      throw new Error(`Keywords file must contain a JSON array (got: ${typeof keywords})`);
    }
    source = "keywords file";
  } else {
    if (!hasPosting(role) || !role.posting.keywords) {
      throw new Error("This role has no stored posting keywords. Pass --keywords <path-to-keywords.json>, or save the posting with add-role --jd-file.");
    }
    keywords = role.posting.keywords;
    source = "stored posting keywords";
  }

  const result = scoreKeywordCoverage(keywords, resumeConfig);
  const support = classifyMissingKeywords(result.missing, {
    profile: paths ? readJson(paths.profile, null) : null,
    evidence: paths ? readJsonLines(paths.evidence) : [],
  });

  if (role) {
    role.resume = role.resume || {};
    role.resume.keywordCoverage = buildCoverageRecord(result, support, { source });
    writeJson(paths.rolesTracked, roles);
    rebuildTrackers(options.workspace);
  }

  if (options.json) {
    console.log(JSON.stringify(role ? { ...result, support } : result, null, 2));
  } else {
    const presentList = result.present.length > 0 ? result.present.join(", ") : "(none)";
    const missingList = result.missing.length > 0 ? result.missing.join(", ") : "(none)";
    console.log(`Keyword coverage: ${result.percent}% (${result.present.length}/${result.present.length + result.missing.length})${source === "stored posting keywords" ? `, weighted ${result.weightedScore}%` : ""}`);
    console.log(`Present: ${presentList}`);
    console.log(`Missing: ${missingList}`);
    if (role) support.forEach((item) => console.log(`  - ${item.keyword}: ${item.note}`));
    if (role) console.log(`Saved on ${role.company} — ${role.title} (resume.keywordCoverage).`);
  }

  return result;
}

module.exports = { run };
