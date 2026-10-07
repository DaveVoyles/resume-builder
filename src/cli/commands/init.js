"use strict";

const path = require("path");
const fs = require("fs");
const http = require("http");
const { createDefaultProfile } = require("../../core/candidate-profile");
const { renderTracker } = require("../../renderers/markdown-tracker");
const { renderHtmlTracker } = require("../../renderers/html-tracker");
const { renderSimilarRoles } = require("../../renderers/markdown-similar-roles");
const { defaultOnboardingState } = require("../../core/onboarding-state");
const { hasIdentityHeader } = require("../../core/server-config");
const serve = require("./serve");
const {
  ensureDir,
  readJson,
  resolveWorkspace,
  workspacePaths,
  writeJsonIfMissing,
  writeTextIfMissing,
} = require("../../core/workspace");

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

const PROBE_TIMEOUT_MS = 1000;
const PROBE_PATH = "/api/onboarding-state";

function portBusyWarning(port) {
  return `Another program is using port ${port}. Pass --port <n> to use a different one.`;
}

function looksLikeOnboardingState(body) {
  try {
    const json = JSON.parse(body);
    return Boolean(
      json &&
        typeof json === "object" &&
        json.state &&
        typeof json.state === "object" &&
        Array.isArray(json.trackerSteps) &&
        Array.isArray(json.homeSteps),
    );
  } catch (error) {
    return false;
  }
}

function classifyProbeResponse(res, body) {
  if (hasIdentityHeader(res.headers) || looksLikeOnboardingState(body)) return "rb";
  return "foreign";
}

function probeResumeBuilder(port, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (kind) => {
      if (settled) return;
      settled = true;
      resolve(kind);
    };

    const req = http.get(
      {
        hostname: "127.0.0.1",
        port,
        path: PROBE_PATH,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          done(classifyProbeResponse(res, Buffer.concat(chunks).toString("utf8")));
        });
        res.on("error", () => done("foreign"));
      },
    );

    req.on("timeout", () => {
      req.destroy();
      done("free");
    });
    req.on("error", (error) => {
      if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT" || error.code === "ENOTFOUND") {
        done("free");
        return;
      }
      done("foreign");
    });
  });
}

async function reuseOrWarn(kind, port, options, openInBrowser) {
  if (kind === "rb") {
    if (!options.noOpen) openInBrowser(serve.trackerUrl(port));
    return;
  }
  console.warn(portBusyWarning(port));
}


// `serveRunner`/`openInBrowser`/`probePort` are injectable so tests can verify
// a launch was attempted (and how init reacts to it) without starting a real
// HTTP server or opening a real browser window.
async function run(options, { serveRunner = serve.run, openInBrowser = serve.openInBrowser, probePort = probeResumeBuilder } = {}) {
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
  writeJsonIfMissing(paths.onboardingState, defaultOnboardingState(), force);
  writeTextIfMissing(paths.evidence, "", force);
  writeTextIfMissing(path.join(paths.notes, "intake.md"), intakeText, force);
  writeTextIfMissing(paths.links, linksTemplate(), force);
  writeTextIfMissing(paths.tracker, renderTracker([]), force);
  // Read back rather than assuming defaults: --force resets both files
  // together (consistent with every other pair here), but without --force,
  // a tracker.html that's missing for some other reason (manually deleted,
  // etc.) still renders against whatever real progress the untouched
  // onboarding-state file already has, instead of a wrong "all pending" view.
  const onboardingState = readJson(paths.onboardingState, defaultOnboardingState());
  writeTextIfMissing(paths.htmlTracker, renderHtmlTracker([], { onboardingState }), force);
  writeTextIfMissing(paths.similarRoles, renderSimilarRoles({ searchBriefs: [], recommendations: [], duplicateCandidates: [] }), force);
  writeTextIfMissing(paths.gitignore, gitignoreText(), force);

  console.log(`Initialized candidate workspace at ${workspace}`);

  if (options.noServe) return;

  const port = serve.resolvePort(options.port);
  const probe = await probePort(port);
  if (probe === "rb") {
    await reuseOrWarn(probe, port, options, openInBrowser);
    return;
  }
  if (probe === "foreign") {
    await reuseOrWarn(probe, port, options, openInBrowser);
    return;
  }

  try {
    await serveRunner({ workspace, port: options.port, noOpen: options.noOpen });
  } catch (error) {
    if (error.code !== "EADDRINUSE") throw error;
    const raced = await probePort(port);
    await reuseOrWarn(raced === "free" ? "foreign" : raced, port, options, openInBrowser);
  }
}

module.exports = { run };
