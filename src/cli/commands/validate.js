"use strict";

const fs = require("fs");
const path = require("path");
const { renderTracker } = require("../../renderers/markdown-tracker");
const { validateEvidence, validateProfile, validateRoles, validateFeedback } = require("../../core/schemas");
const { validateResumeConfig } = require("../../core/resume-config");
const { auditResumeConfig } = require("../../core/claim-audit");
const { lintConfig } = require("../../core/style-lint");
const { readJson, readJsonLines, resolveWorkspace, workspacePaths } = require("../../core/workspace");

function assertExists(file, errors) {
  if (!fs.existsSync(file)) errors.push(`Missing required file: ${file}`);
}

function listResumeConfigFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort()
    .map((name) => path.join(dir, name));
}

/**
 * Evidence-backed claim audit (design plan 0001, D3): validates every
 * resume-config file under <workspace>/resume-configs/ against the
 * workspace's evidence.jsonl ledger and folds the results into validate's
 * blocking errors (unsupported claims) and non-blocking warnings (thin
 * ledger). resume-configs/ is optional — a workspace without one (e.g. a
 * candidate who hasn't drafted a resume config yet) validates unaffected.
 */
function prefixed(label, messages) {
  return messages.map((message) => `${label}: ${message}`);
}

function auditResumeConfigs(paths, evidence, errors, warnings) {
  listResumeConfigFiles(paths.resumeConfigs).forEach((file) => {
    const label = path.relative(paths.root, file);

    let config;
    try {
      config = readJson(file);
    } catch (error) {
      errors.push(...prefixed(label, [error.message]));
      return;
    }

    const { valid, errors: schemaErrors } = validateResumeConfig(config);
    if (!valid) {
      errors.push(...prefixed(label, schemaErrors));
      return;
    }

    const audit = auditResumeConfig(config, evidence);
    errors.push(...prefixed(label, audit.errors));
    warnings.push(...prefixed(label, audit.warnings));

    // De-AI style lint advisory (D7, src/core/style-lint.js) — detects
    // AI-generated writing patterns and adds them as warnings (never blocking).
    const styleLint = lintConfig(config, "resume");
    styleLint.findings.forEach((finding) => {
      warnings.push(
        ...prefixed(
          label,
          [`Style: [${finding.sourceLabel}] ${finding.description}`],
        ),
      );
    });
  });
}

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const errors = [];
  const warnings = [];

  [paths.profile, paths.evidence, paths.rolesSeed, paths.rolesTracked, paths.tracker].forEach((file) => assertExists(file, errors));
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const profile = readJson(paths.profile);
  const seedRoles = readJson(paths.rolesSeed);
  const trackedRoles = readJson(paths.rolesTracked);
  const evidence = readJsonLines(paths.evidence);
  const feedback = fs.existsSync(paths.feedback) ? readJsonLines(paths.feedback) : [];

  errors.push(...validateProfile(profile));
  errors.push(...validateRoles(seedRoles, "roles.seed.json"));
  errors.push(...validateRoles(trackedRoles, "roles.tracked.json"));
  errors.push(...validateEvidence(evidence));
  if (feedback.length > 0) errors.push(...validateFeedback(feedback));

  const expectedTracker = renderTracker(trackedRoles);
  const actualTracker = fs.readFileSync(paths.tracker, "utf8");
  if (actualTracker !== expectedTracker) {
    errors.push("outputs/tracker.md is out of date with roles.tracked.json; run build-tracker");
  }

  auditResumeConfigs(paths, evidence, errors, warnings);

  warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

  if (errors.length > 0) throw new Error(`Workspace validation failed:\n${errors.join("\n")}`);
  console.log(`Workspace valid: ${workspace}`);
}

module.exports = { run };
