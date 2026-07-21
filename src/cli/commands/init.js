"use strict";

const path = require("path");
const fs = require("fs");
const { createDefaultProfile } = require("../../core/candidate-profile");
const { renderTracker } = require("../../renderers/markdown-tracker");
const { renderHtmlTracker } = require("../../renderers/html-tracker");
const { renderSimilarRoles } = require("../../renderers/markdown-similar-roles");
const serve = require("./serve");
const {
  ensureDir,
  resolveWorkspace,
  workspacePaths,
  writeJsonIfMissing,
  writeTextIfMissing,
} = require("../../core/workspace");

const DEFAULT_SERVE_PORT = 4321;

function defaultPreferences() {
  return {
    schemaVersion: "1.0",
    roleTargets: [],
    locations: {
      workModes: [],
      preferredRegions: [],
      excludedRegions: [],
      priority: "should",
    },
    dealBreakers: [],
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
    "# One link per line — GitHub, portfolio, personal site, LinkedIn (for reference — not scraped for content), published writing, talks, etc.",
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

// `serveRunner`/`openInBrowser` are injectable so tests can verify a launch
// was attempted (and how init reacts to it) without starting a real HTTP
// server or opening a real browser window.
async function run(options, { serveRunner = serve.run, openInBrowser = serve.openInBrowser } = {}) {
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
  writeTextIfMissing(paths.htmlTracker, renderHtmlTracker([]), force);
  writeTextIfMissing(paths.similarRoles, renderSimilarRoles({ searchBriefs: [], recommendations: [], duplicateCandidates: [] }), force);
  writeTextIfMissing(paths.gitignore, gitignoreText(), force);

  console.log(`Initialized candidate workspace at ${workspace}`);

  if (options.noServe) return;

  const parsedPort = Number.parseInt(options.port, 10);
  const port = Number.isNaN(parsedPort) ? DEFAULT_SERVE_PORT : parsedPort;

  try {
    await serveRunner({ workspace, port: options.port, noOpen: options.noOpen });
  } catch (error) {
    if (!/already in use/iu.test(error.message)) throw error;
    // Setup's job is "make sure the candidate sees a result immediately" —
    // a server already running on this port (from a previous setup, or a
    // manually-started `workspace:serve`) already satisfies that, so treat
    // it as success rather than failing the whole `npm run setup` run.
    console.log(`A server is already running on port ${port} — reusing it.`);
    if (!options.noOpen) openInBrowser(`http://localhost:${port}/tracker.html`);
  }
}

module.exports = { run };
