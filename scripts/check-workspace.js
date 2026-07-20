"use strict";

const fs = require("fs");
const path = require("path");
const { validateEvidence, validateFeedback } = require("../src/core/schemas");
const { renderTracker } = require("../src/renderers/markdown-tracker");

function usage() {
  console.log("Usage: node scripts/check-workspace.js --workspace <path>");
}

function parseArgs(argv) {
  const args = { workspace: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--workspace") {
      args.workspace = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      args.help = true;
    }
  }
  return args;
}

function readJson(file, label, errors) {
  if (!fs.existsSync(file)) {
    errors.push(`Missing ${label}: ${file}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`Invalid JSON in ${label}: ${file}\n  ${error.message}`);
    return null;
  }
}

function assertObject(value, label, errors) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    errors.push(`${label} must be a JSON object`);
  }
}

function assertArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be a JSON array`);
  }
}

function validateEvidenceJsonl(file, errors) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/u).filter(Boolean);
  const entries = [];
  const parseErrors = [];
  lines.forEach((line, index) => {
    try {
      entries.push(JSON.parse(line));
    } catch (error) {
      parseErrors.push(`evidence.jsonl line ${index + 1}: invalid JSON\n  ${error.message}`);
    }
  });
  errors.push(...parseErrors);
  if (parseErrors.length === 0) errors.push(...validateEvidence(entries));
}

function validateFeedbackJsonl(file, errors) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/u).filter(Boolean);
  const entries = [];
  const parseErrors = [];
  lines.forEach((line, index) => {
    try {
      entries.push(JSON.parse(line));
    } catch (error) {
      parseErrors.push(`feedback.jsonl line ${index + 1}: invalid JSON\n  ${error.message}`);
    }
  });
  errors.push(...parseErrors);
  if (parseErrors.length === 0) errors.push(...validateFeedback(entries));
}

function validateRoles(roles, label, errors) {
  if (!Array.isArray(roles)) return;
  const seen = new Set();
  roles.forEach((role, index) => {
    const prefix = `${label}[${index}]`;
    if (!role || typeof role !== "object" || Array.isArray(role)) {
      errors.push(`${prefix} must be an object`);
      return;
    }
    for (const field of ["company", "status"]) {
      if (typeof role[field] !== "string" || role[field].trim() === "") {
        errors.push(`${prefix}: missing ${field}`);
      }
    }
    const title = role.title || role.role;
    if (typeof title !== "string" || title.trim() === "") {
      errors.push(`${prefix}: missing title`);
    }
    if (!role.urls || typeof role.urls !== "object" || Array.isArray(role.urls)) {
      errors.push(`${prefix}: urls must be an object`);
    }
    const urls = role.urls && typeof role.urls === "object" ? [role.urls.job, role.urls.apply].filter(Boolean) : [];
    const key = `${role.company || ""}::${title || ""}::${urls.join(",")}`;
    if (seen.has(key)) errors.push(`${prefix}: duplicate role entry`);
    seen.add(key);
  });
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (!args.workspace) {
    usage();
    process.exitCode = 1;
    return;
  }

  const workspace = path.resolve(args.workspace);
  const errors = [];
  if (!fs.existsSync(workspace)) errors.push(`Workspace does not exist: ${workspace}`);

  const profile = readJson(path.join(workspace, "profile.json"), "profile", errors);
  const preferences = readJson(path.join(workspace, "preferences.json"), "preferences", errors);
  const seedRoles = readJson(path.join(workspace, "roles.seed.json"), "seed roles", errors);
  const trackedRoles = readJson(path.join(workspace, "roles.tracked.json"), "tracked roles", errors);

  assertObject(profile, "profile.json", errors);
  assertObject(preferences, "preferences.json", errors);
  assertArray(seedRoles, "roles.seed.json", errors);
  assertArray(trackedRoles, "roles.tracked.json", errors);
  validateRoles(seedRoles, "roles.seed.json", errors);
  validateRoles(trackedRoles, "roles.tracked.json", errors);
  validateEvidenceJsonl(path.join(workspace, "evidence.jsonl"), errors);
  validateFeedbackJsonl(path.join(workspace, "feedback.jsonl"), errors);

  const trackerFile = path.join(workspace, "outputs", "tracker.md");
  if (fs.existsSync(trackerFile) && Array.isArray(trackedRoles)) {
    const actualTracker = fs.readFileSync(trackerFile, "utf8");
    const expectedTracker = renderTracker(trackedRoles);
    if (actualTracker !== expectedTracker) {
      errors.push("outputs/tracker.md is out of date with roles.tracked.json; run build-tracker");
    }
  }

  if (errors.length > 0) {
    console.error(`Workspace validation failed:\n${errors.join("\n")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Workspace valid: ${workspace}`);
}

main();
