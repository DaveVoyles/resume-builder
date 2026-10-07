"use strict";

// Onboarding progress is tracked via an explicit marker file rather than
// inferred from profile.json/preferences.json's own shape — compensation is
// an optional preferences field, and an empty dealBreakers array is a valid
// *complete* answer ("no deal breakers"), not "not asked yet." Inferring
// completion from data shape alone can't tell those apart; an explicit
// per-section flag can. See design plan 0006 D1 for the full rationale.

const { readJson, writeJson } = require("./workspace");

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
  label: "Material ingested",
  howTo: "Put old resumes and notes in `my-documents` at the top of the resume-builder folder. Tell your agent when they are in. The agent copies them into `candidate/inputs/resumes` and `candidate/inputs/notes`, then reads them. If Open folder fails, open `my-documents` yourself.",
};
const FINAL_STEP = {
  key: "firstRoleAdded",
  label: "First role added",
  howTo: "Tell your agent about a job you want. Paste the posting link in chat. This page does not add jobs from a form.",
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

function readOnboardingState(path) {
  return readJson(path, defaultOnboardingState());
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

// Merges a partial update into the existing (or default) state and writes
// it back — the shape callers reach for whenever a step completes, so no
// caller has to hand-roll a read-modify-write against the raw file. Backfills
// `sections` against the default shape (not just `current.sections`) so a
// state file that predates a since-added section key — or was hand-edited
// down to a subset — never silently drops keys instead of defaulting them
// to false.
function updateOnboardingState(path, patch) {
  const current = readOnboardingState(path);
  const next = {
    ...defaultOnboardingState(),
    ...current,
    ...patch,
    sections: { ...defaultOnboardingState().sections, ...current.sections, ...patch.sections },
  };
  writeJson(path, next);
  return next;
}

module.exports = {
  SECTIONS,
  defaultOnboardingState,
  isOnboardingComplete,
  onboardingSteps,
  readOnboardingState,
  updateOnboardingState,
};
