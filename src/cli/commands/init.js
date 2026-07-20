"use strict";

const path = require("path");
const fs = require("fs");
const { createDefaultProfile } = require("../../core/candidate-profile");
const { renderTracker } = require("../../renderers/markdown-tracker");
const { renderSimilarRoles } = require("../../renderers/markdown-similar-roles");
const {
  ensureDir,
  resolveWorkspace,
  workspacePaths,
  writeJsonIfMissing,
  writeTextIfMissing,
} = require("../../core/workspace");

function defaultPreferences() {
  return {
    schemaVersion: "1.0",
    roleTargets: [],
    locations: [],
    compensation: "",
    workAuthorization: "",
    remotePreference: "",
    updatedAt: new Date().toISOString(),
  };
}

function defaultClaimPolicy() {
  return {
    schemaVersion: "1.0",
    requireEvidenceForResumeClaims: true,
    allowUnverifiedPlaceholders: false,
    notes: "Generated resumes should use facts from profile.json or evidence.jsonl unless the candidate approves additions.",
  };
}

function linksTemplate() {
  return [
    "# Public source links",
    "#",
    "# One link per line — GitHub, portfolio, personal site, published writing, talks, etc.",
    "# Lines starting with # are ignored.",
    "",
  ].join("\n");
}

function gitignoreText() {
  return [
    "# Raw candidate source material can contain personal data.",
    "inputs/resumes/*",
    "inputs/notes/*",
    "inputs/links.md",
    "!inputs/resumes/.gitkeep",
    "!inputs/notes/.gitkeep",
    "",
    "# Generated candidate outputs are workspace-local by default.",
    "outputs/*",
    "!outputs/resumes/",
    "outputs/resumes/*",
    "!outputs/resumes/.gitkeep",
    "",
  ].join("\n");
}

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const force = Boolean(options.force);
  const intakeTemplate = path.resolve(__dirname, "../../../templates/candidate-intake.md");
  const intakeText = fs.readFileSync(intakeTemplate, "utf8");

  [paths.resumes, paths.notes, paths.outputResumes].forEach(ensureDir);
  writeTextIfMissing(path.join(paths.resumes, ".gitkeep"), "", force);
  writeTextIfMissing(path.join(paths.notes, ".gitkeep"), "", force);
  writeTextIfMissing(path.join(paths.outputResumes, ".gitkeep"), "", force);
  writeJsonIfMissing(paths.profile, createDefaultProfile(), force);
  writeJsonIfMissing(paths.preferences, defaultPreferences(), force);
  writeJsonIfMissing(paths.rolesSeed, [], force);
  writeJsonIfMissing(paths.rolesTracked, [], force);
  writeJsonIfMissing(paths.claimPolicy, defaultClaimPolicy(), force);
  writeTextIfMissing(paths.evidence, "", force);
  writeTextIfMissing(path.join(paths.notes, "intake.md"), intakeText, force);
  writeTextIfMissing(paths.links, linksTemplate(), force);
  writeTextIfMissing(paths.tracker, renderTracker([]), force);
  writeTextIfMissing(paths.similarRoles, renderSimilarRoles({ searchBriefs: [], recommendations: [], duplicateCandidates: [] }), force);
  writeTextIfMissing(paths.gitignore, gitignoreText(), force);

  console.log(`Initialized candidate workspace at ${workspace}`);
}

module.exports = { run };
