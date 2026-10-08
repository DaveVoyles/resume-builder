"use strict";

const path = require("path");
const { createDefaultProfile } = require("./candidate-profile");
const { HOME_ANSWERS_FILENAME, syncOnboardingState } = require("./onboarding-state");
const { ensureDir, readJson, workspacePaths, writeJson } = require("./workspace");

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function emptyPreferences() {
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
  };
}

const WHERE_TO_WORK_MODES = {
  Hybrid: ["hybrid"],
  "Remote (from home)": ["remote"],
  "Near where I live": ["on-site"],
  "Either is fine": ["flexible"],
  "Willing to move": ["flexible"],
};

function lastRecordedHomeWorkMode(answers) {
  const recorded = trimmed(answers && answers.lastHomeWorkMode);
  if (recorded) return recorded;
  const mapped = WHERE_TO_WORK_MODES[trimmed(answers && answers.where)];
  return mapped ? mapped[0] : "";
}

function applyHomeWorkMode(currentModes, previousHomeMode, nextHomeMode) {
  // Home Save replaces only its own previous work mode. Remove lastHomeWorkMode
  // if it is present, then append the new value if it is absent. Agent-written
  // values stay. If flexible sits next to specific modes, keep them all:
  // flexible means any mode is OK for matching, and the specific values remain
  // as stated preferences.
  const next = [];
  const seen = new Set();
  for (const mode of Array.isArray(currentModes) ? currentModes : []) {
    if (!mode || mode === previousHomeMode || seen.has(mode)) continue;
    seen.add(mode);
    next.push(mode);
  }
  if (nextHomeMode && !seen.has(nextHomeMode)) {
    next.push(nextHomeMode);
  }
  return next;
}


function applyDealBreakers(preferences, answers) {
  const text = trimmed(answers && answers.dealBreakers);
  const choice = trimmed(answers && answers.dealBreakersChoice).toLowerCase();
  if (text) {
    delete preferences.dealBreakersSkip;
    const existing = Array.isArray(preferences.dealBreakers) ? preferences.dealBreakers : [];
    const already = existing.some((item) => trimmed(item && item.text) === text);
    if (!already) {
      preferences.dealBreakers = existing.concat([
        {
          id: `deal-${String(existing.length + 1).padStart(3, "0")}`,
          text,
          priority: "must",
        },
      ]);
    }
    return { dealBreakers: text, dealBreakersChoice: "" };
  }
  if (choice === "skip") {
    preferences.dealBreakersSkip = { skipped: true };
    return { dealBreakers: "", dealBreakersChoice: "skip" };
  }
  if (choice === "none") {
    preferences.dealBreakersSkip = { none: true };
    return { dealBreakers: "", dealBreakersChoice: "none" };
  }
  return { dealBreakers: "", dealBreakersChoice: "" };
}

function saveHomeAnswers(workspace, answers) {
  const goal = trimmed(answers && answers.goal);
  if (!goal) {
    const error = new Error("Goal is required.");
    error.code = "GOAL_REQUIRED";
    throw error;
  }

  ensureDir(workspace);
  const paths = workspacePaths(workspace);
  const savedAt = new Date().toISOString();
  const preferences = readJson(paths.preferences, emptyPreferences());
  const answersPath = path.join(workspace, HOME_ANSWERS_FILENAME);
  const previousAnswers = readJson(answersPath, {});
  const dealBreakersRecord = applyDealBreakers(preferences, answers);
  const nextHomeModes = WHERE_TO_WORK_MODES[trimmed(answers && answers.where)];
  const nextHomeWorkMode = nextHomeModes ? nextHomeModes[0] : "";
  const payload = {
    name: trimmed(answers.name),
    location: trimmed(answers.location),
    history: trimmed(answers.history),
    goal,
    where: trimmed(answers.where),
    when: trimmed(answers.when),
    extra: trimmed(answers.extra),
    dealBreakers: dealBreakersRecord.dealBreakers,
    dealBreakersChoice: dealBreakersRecord.dealBreakersChoice,
    savedAt,
  };
  if (nextHomeWorkMode) {
    payload.lastHomeWorkMode = nextHomeWorkMode;
  }

  writeJson(answersPath, payload);

  const profile = readJson(paths.profile, createDefaultProfile());
  profile.candidate = profile.candidate || createDefaultProfile().candidate;
  if (payload.name) {
    profile.candidate.preferredName = payload.name;
    profile.candidate.name = payload.name;
  }
  if (payload.location) {
    profile.candidate.location = payload.location;
  }
  profile.updatedAt = savedAt;
  writeJson(paths.profile, profile);

  const hasTitles =
    Array.isArray(preferences.roleTargets) &&
    preferences.roleTargets.some((row) => Array.isArray(row.titles) && row.titles.some(trimmed));
  if (!hasTitles) {
    preferences.roleTargets = [
      {
        titles: [payload.goal],
        seniority: "flexible",
        employmentTypes: [],
        priority: "should",
      },
    ];
  }
  if (nextHomeWorkMode) {
    preferences.locations = preferences.locations || emptyPreferences().locations;
    preferences.locations.workModes = applyHomeWorkMode(
      preferences.locations.workModes,
      lastRecordedHomeWorkMode(previousAnswers),
      nextHomeWorkMode,
    );
  }
  preferences.updatedAt = savedAt;
  writeJson(paths.preferences, preferences);

  const state = syncOnboardingState(workspace);
  return {
    message: "Answers saved.",
    answersPath,
    filename: HOME_ANSWERS_FILENAME,
    displayPath: `resume-builder / candidate / ${HOME_ANSWERS_FILENAME}`,
    state,
  };
}

module.exports = { HOME_ANSWERS_FILENAME, saveHomeAnswers };
