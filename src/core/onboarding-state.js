"use strict";

// Onboarding progress is one record: candidate/.onboarding-state.json.
// Home and the tracker both read it through this module.
//
// Done-ness is derived from workspace files, then written back. A section is
// done only when its data exists. Empty dealBreakers from init and an absent
// compensation object are not "done." See deriveOnboardingState().

const fs = require("fs");
const path = require("path");
const { readJson, writeJson, workspacePaths } = require("./workspace");

const HOME_ANSWERS_FILENAME = "home-answers.json";

// Ordered to match grill.md's own section numbers (1-7) — every renderer
// that walks this list produces a checklist in the interview's real order.
const SECTIONS = [
  {
    key: "basicInfo",
    label: "Basic information",
    howTo: "Tell your agent your name and where you live. They write it down. You do not edit files.",
  },
  {
    key: "workHistory",
    label: "Work history",
    howTo: "Walk through jobs you have held, newest first: company, title, dates, and what you did. Rough is fine.",
  },
  {
    key: "education",
    label: "Education",
    howTo: "Schools, degrees, and years if you want them on a resume. Skip anything you would rather leave off.",
  },
  {
    key: "targetRole",
    label: "Target role",
    howTo: "The kind of job you want next, in your own words.",
  },
  {
    key: "location",
    label: "Location and work mode",
    howTo: "Where you can work: near home, remote, hybrid, or willing to move.",
  },
  {
    key: "compensation",
    label: "Salary and compensation",
    howTo: "A pay range if you want it tracked. You can skip this.",
  },
  {
    key: "dealBreakers",
    label: "Constraints and deal breakers",
    howTo: "Things you will not do: industries, travel, hours, or other limits.",
  },
];

const SETUP_STEP = {
  key: "setupComplete",
  label: "Workspace created",
  howTo: "The private workspace is already on this computer. You do not need to do this step.",
};
const INGEST_STEP = {
  key: "materialIngested",
  label: "Your resumes and notes are read in",
  howTo: "Put old resumes and notes in `my-documents` at the top of the resume-builder folder. Tell your agent when they are in. The agent copies them into `candidate/inputs/resumes` and `candidate/inputs/notes`, then reads them. If Open folder fails, open `my-documents` yourself.",
};
const FINAL_STEP = {
  key: "firstRoleAdded",
  label: "First role added",
  howTo: "Tell your agent about a job you want. Paste the posting link in chat. This page does not add jobs from a form.",
};

// Single mapping used by the home server, home page (via GET /api/onboarding-state),
// and tests. Do not copy this object elsewhere.
//
// A home step is done only when every mapped tracker step is done.
// firstDraft maps to no tracker step: typed answers are not a resume draft.
const HOME_STEPS = [
  { key: "downloadRb", label: "Download RB" },
  { key: "startRb", label: "Start RB and open this page" },
  { key: "addFiles", label: "Add your files to my-documents" },
  { key: "answerQuestions", label: "Answer a few questions" },
  { key: "firstDraft", label: "Get your first draft" },
  { key: "addJobs", label: "Add jobs you want" },
];

const HOME_STEP_TO_TRACKER_STEPS = {
  downloadRb: ["setupComplete"],
  startRb: ["setupComplete"],
  addFiles: ["materialIngested"],
  // Home form captures name (basicInfo) and goal (targetRole). The other five
  // grill sections stay tracker-only until their files actually contain data.
  answerQuestions: ["basicInfo", "targetRole"],
  firstDraft: [],
  addJobs: ["firstRoleAdded"],
};

function defaultOnboardingState() {
  return {
    schemaVersion: "1.0",
    setupComplete: true,
    materialIngested: false,
    sections: Object.fromEntries(SECTIONS.map((section) => [section.key, false])),
    firstRoleAdded: false,
  };
}

function readOnboardingState(filePath) {
  return readJson(filePath, defaultOnboardingState());
}

// The single canonical list of every onboarding step, in order, with its
// done/pending status — isOnboardingComplete() and every checklist renderer
// (src/renderers/html-tracker.js) both derive from this one list rather than
// each hand-maintaining their own copy of "which fields count."
function onboardingSteps(onboardingState) {
  const state = onboardingState || {};
  const sections = state.sections || {};
  return [
    { key: SETUP_STEP.key, label: SETUP_STEP.label, howTo: SETUP_STEP.howTo, done: Boolean(state[SETUP_STEP.key]) },
    { key: INGEST_STEP.key, label: INGEST_STEP.label, howTo: INGEST_STEP.howTo, done: Boolean(state[INGEST_STEP.key]) },
    ...SECTIONS.map((section) => ({
      key: section.key,
      label: section.label,
      howTo: section.howTo,
      done: Boolean(sections[section.key]),
    })),
    { key: FINAL_STEP.key, label: FINAL_STEP.label, howTo: FINAL_STEP.howTo, done: Boolean(state[FINAL_STEP.key]) },
  ];
}

function isOnboardingComplete(state) {
  return onboardingSteps(state).every((step) => step.done);
}

function homeStepsFromOnboarding(onboardingState) {
  const doneByKey = Object.fromEntries(onboardingSteps(onboardingState).map((step) => [step.key, step.done]));
  return HOME_STEPS.map((step) => {
    const trackerKeys = HOME_STEP_TO_TRACKER_STEPS[step.key] || [];
    const done = trackerKeys.length > 0 && trackerKeys.every((key) => doneByKey[key]);
    return { key: step.key, label: step.label, trackerKeys, done };
  });
}

// Merges a partial update into the existing (or default) state and writes
// it back — the shape callers reach for whenever a step completes, so no
// caller has to hand-roll a read-modify-write against the raw file. Backfills
// `sections` against the default shape (not just `current.sections`) so a
// state file that predates a since-added section key — or was hand-edited
// down to a subset — never silently drops keys instead of defaulting them
// to false.
function updateOnboardingState(filePath, patch) {
  const current = readOnboardingState(filePath);
  const next = {
    ...defaultOnboardingState(),
    ...current,
    ...patch,
    sections: { ...defaultOnboardingState().sections, ...current.sections, ...patch.sections },
  };
  writeJson(filePath, next);
  return next;
}

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasLedgerEntries(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, "utf8");
  return text.split(/\r?\n/u).some((line) => line.trim());
}

function hasCompensation(preferences) {
  const compensation = preferences.compensation;
  if (!compensation || typeof compensation !== "object") return false;
  return ["baseMinimum", "totalMinimum", "totalTarget"].some((key) => Number.isFinite(Number(compensation[key])));
}

function hasDealBreakers(preferences, homeAnswers) {
  if (nonempty(homeAnswers.extra)) return true;
  return (
    Array.isArray(preferences.dealBreakers) &&
    preferences.dealBreakers.some((item) => nonempty(item && item.text) || nonempty(item))
  );
}

function deriveOnboardingState(workspace) {
  const paths = workspacePaths(workspace);
  const profile = readJson(paths.profile, {});
  const preferences = readJson(paths.preferences, {});
  const homeAnswers = readJson(path.join(workspace, HOME_ANSWERS_FILENAME), {});
  const tracked = readJson(paths.rolesTracked, []);
  const candidate = profile.candidate || {};

  const setupComplete = fs.existsSync(paths.profile);
  const materialIngested =
    (Array.isArray(profile.sources) && profile.sources.length > 0) || hasLedgerEntries(paths.evidence);
  const firstRoleAdded = Array.isArray(tracked) && tracked.length > 0;

  const sections = {
    basicInfo: nonempty(candidate.preferredName) || nonempty(candidate.name) || nonempty(homeAnswers.name),
    workHistory:
      (Array.isArray(profile.experience) &&
        profile.experience.some((row) => nonempty(row.organization) || nonempty(row.title))) ||
      nonempty(homeAnswers.history),
    education:
      Array.isArray(profile.education) &&
      profile.education.some((row) => nonempty(row.institution) || nonempty(row.degree)),
    targetRole:
      (Array.isArray(preferences.roleTargets) &&
        preferences.roleTargets.some((row) => Array.isArray(row.titles) && row.titles.some(nonempty))) ||
      nonempty(homeAnswers.goal),
    location:
      Boolean(
        preferences.locations &&
          ((Array.isArray(preferences.locations.workModes) && preferences.locations.workModes.length > 0) ||
            (Array.isArray(preferences.locations.preferredRegions) &&
              preferences.locations.preferredRegions.length > 0)),
      ) || nonempty(homeAnswers.where),
    compensation: hasCompensation(preferences),
    dealBreakers: hasDealBreakers(preferences, homeAnswers),
  };

  return {
    schemaVersion: "1.0",
    setupComplete,
    materialIngested,
    sections,
    firstRoleAdded,
  };
}

function syncOnboardingState(workspace) {
  const paths = workspacePaths(workspace);
  const derived = deriveOnboardingState(workspace);
  writeJson(paths.onboardingState, derived);
  return derived;
}

module.exports = {
  SECTIONS,
  HOME_STEPS,
  HOME_STEP_TO_TRACKER_STEPS,
  HOME_ANSWERS_FILENAME,
  defaultOnboardingState,
  isOnboardingComplete,
  onboardingSteps,
  homeStepsFromOnboarding,
  readOnboardingState,
  updateOnboardingState,
  deriveOnboardingState,
  syncOnboardingState,
};
