"use strict";

const fs = require("fs");
const path = require("path");

function resolveWorkspace(workspace) {
  return path.resolve(process.cwd(), workspace || "candidate");
}

function workspacePaths(workspace) {
  return {
    root: workspace,
    inputs: path.join(workspace, "inputs"),
    resumes: path.join(workspace, "inputs", "resumes"),
    notes: path.join(workspace, "inputs", "notes"),
    links: path.join(workspace, "inputs", "links.md"),
    outputs: path.join(workspace, "outputs"),
    outputResumes: path.join(workspace, "outputs", "resumes"),
    outputCoverLetters: path.join(workspace, "outputs", "cover-letters"),
    resumeConfigs: path.join(workspace, "resume-configs"),
    tracker: path.join(workspace, "outputs", "tracker.md"),
    htmlTracker: path.join(workspace, "outputs", "tracker.html"),
    similarRoles: path.join(workspace, "outputs", "similar-roles.md"),
    profile: path.join(workspace, "profile.json"),
    preferences: path.join(workspace, "preferences.json"),
    evidence: path.join(workspace, "evidence.jsonl"),
    feedback: path.join(workspace, "feedback.jsonl"),
    rolesSeed: path.join(workspace, "roles.seed.json"),
    rolesTracked: path.join(workspace, "roles.tracked.json"),
    claimPolicy: path.join(workspace, "claim-policy.json"),
    contacts: path.join(workspace, "contacts.json"),
    gitignore: path.join(workspace, ".gitignore"),
  };
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required JSON file: ${file}`);
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON in ${file}: ${error.message}`);
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonIfMissing(file, value, force) {
  if (force || !fs.existsSync(file)) {
    writeJson(file, value);
    return true;
  }
  return false;
}

function writeTextIfMissing(file, text, force) {
  if (force || !fs.existsSync(file)) {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, text);
    return true;
  }
  return false;
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL in ${file} line ${index + 1}: ${error.message}`);
      }
    });
}

function appendJsonLines(file, entries) {
  if (entries.length === 0) return;
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
}

function relativeToWorkspace(workspace, file) {
  return path.relative(workspace, path.resolve(file));
}

module.exports = {
  appendJsonLines,
  ensureDir,
  readJson,
  readJsonLines,
  relativeToWorkspace,
  resolveWorkspace,
  workspacePaths,
  writeJson,
  writeJsonIfMissing,
  writeTextIfMissing,
};
