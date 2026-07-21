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
  { key: "basicInfo", label: "Basic information" },
  { key: "workHistory", label: "Work history" },
  { key: "education", label: "Education" },
  { key: "targetRole", label: "Target role" },
  { key: "location", label: "Location and work mode" },
  { key: "compensation", label: "Salary and compensation" },
  { key: "dealBreakers", label: "Constraints and deal breakers" },
];

// The three top-level steps around the 7 grill sections in the overall
// onboarding sequence: setup and ingestion happen before any section, the
// first tracked role happens after all of them.
const SETUP_STEP = { key: "setupComplete", label: "Workspace created" };
const INGEST_STEP = { key: "materialIngested", label: "Material ingested" };
const FINAL_STEP = { key: "firstRoleAdded", label: "First role added" };

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
    { label: SETUP_STEP.label, done: Boolean(state[SETUP_STEP.key]) },
    { label: INGEST_STEP.label, done: Boolean(state[INGEST_STEP.key]) },
    ...SECTIONS.map((section) => ({ label: section.label, done: Boolean(sections[section.key]) })),
    { label: FINAL_STEP.label, done: Boolean(state[FINAL_STEP.key]) },
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
