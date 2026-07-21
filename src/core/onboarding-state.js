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

function isOnboardingComplete(state) {
  return Boolean(
    state.setupComplete && state.materialIngested && SECTIONS.every((section) => state.sections?.[section.key]) && state.firstRoleAdded,
  );
}

// Merges a partial update into the existing (or default) state and writes
// it back — the shape callers reach for whenever a step completes, so no
// caller has to hand-roll a read-modify-write against the raw file.
function updateOnboardingState(path, patch) {
  const current = readOnboardingState(path);
  const next = {
    ...current,
    ...patch,
    sections: { ...current.sections, ...patch.sections },
  };
  writeJson(path, next);
  return next;
}

module.exports = {
  SECTIONS,
  defaultOnboardingState,
  isOnboardingComplete,
  readOnboardingState,
  updateOnboardingState,
};
