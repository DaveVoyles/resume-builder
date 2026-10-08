"use strict";

const fs = require("fs");
const path = require("path");
const { createDefaultProfile } = require("./candidate-profile");
const { HOME_ANSWERS_FILENAME, syncOnboardingState } = require("./onboarding-state");
const { ensureDir, readJson, workspacePaths, writeJson } = require("./workspace");

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonempty(value) {
  return trimmed(value).length > 0;
}

function isExclusiveTrueKey(value, key) {
  return isRecord(value) && Object.keys(value).length === 1 && value[key] === true;
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

function lastRecordedHomeEducationId(answers) {
  return trimmed(answers && answers.lastHomeEducationId);
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

function hasRealEducation(profile) {
  return (
    Array.isArray(profile && profile.education) &&
    profile.education.some((row) => nonempty(row && row.institution) || nonempty(row && row.degree))
  );
}

function hasRealCompensation(compensation) {
  if (!isRecord(compensation)) return false;
  if (Object.prototype.hasOwnProperty.call(compensation, "skipped")) return false;
  return ["baseMinimum", "totalMinimum", "totalTarget"].some((key) => Number.isFinite(Number(compensation[key])));
}

// Home salary field: "120000", "120,000", and "$120k" become 120000.
// Commas, spaces, and a leading $ are stripped. A trailing k/K multiplies by 1000.
// Anything else is unparseable — Save must not write junk.
function parseSalaryInput(raw) {
  const text = trimmed(raw);
  if (!text) return { empty: true };
  let normalized = text.replace(/[$,\s]/g, "");
  let multiplier = 1;
  if (/k$/i.test(normalized)) {
    multiplier = 1000;
    normalized = normalized.slice(0, -1);
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return {
      error: `Could not read salary "${text}". Try a number like 120000, 120,000, or $120k.`,
    };
  }
  const value = Number(normalized) * multiplier;
  if (!Number.isFinite(value) || value <= 0) {
    return {
      error: `Could not read salary "${text}". Try a number like 120000, 120,000, or $120k.`,
    };
  }
  return { value };
}

function applyEducation(profile, answers, previousAnswers) {
  const text = trimmed(answers && answers.education);
  const choice = trimmed(answers && answers.educationChoice).toLowerCase();
  const previousHomeEducationId = lastRecordedHomeEducationId(previousAnswers);
  if (text) {
    if (text === educationPrefill(profile).education) {
      return { education: text, educationChoice: "", lastHomeEducationId: previousHomeEducationId };
    }
    delete profile.educationSkip;
    const existing = Array.isArray(profile.education) ? profile.education.slice() : [];
    const homeIndex = previousHomeEducationId
      ? existing.findIndex((row) => row && row.id === previousHomeEducationId)
      : -1;
    if (homeIndex >= 0) {
      existing[homeIndex] = { ...existing[homeIndex], institution: text };
      profile.education = existing;
      return { education: text, educationChoice: "", lastHomeEducationId: previousHomeEducationId };
    }
    const id = `edu-${String(existing.length + 1).padStart(3, "0")}`;
    profile.education = existing.concat([
      {
        id,
        institution: text,
      },
    ]);
    return { education: text, educationChoice: "", lastHomeEducationId: id };
  }
  if (choice === "skip") {
    if (hasRealEducation(profile)) {
      return { education: "", educationChoice: "", lastHomeEducationId: previousHomeEducationId };
    }
    profile.educationSkip = { skipped: true };
    return { education: "", educationChoice: "skip", lastHomeEducationId: previousHomeEducationId };
  }
  return { education: "", educationChoice: "", lastHomeEducationId: previousHomeEducationId };
}

function applyCompensation(preferences, answers) {
  const text = trimmed(answers && answers.salary);
  const choice = trimmed(answers && answers.salaryChoice).toLowerCase();
  if (text) {
    const parsed = parseSalaryInput(text);
    if (parsed.error) {
      const error = new Error(parsed.error);
      error.code = "SALARY_INVALID";
      throw error;
    }
    const prefillAmount = compensationPrefillAmount(preferences.compensation);
    if (prefillAmount != null && parsed.value === prefillAmount) {
      return { salary: text, salaryChoice: "" };
    }
    const current = preferences.compensation;
    if (isExclusiveTrueKey(current, "skipped") || !isRecord(current)) {
      preferences.compensation = { currency: "USD", baseMinimum: parsed.value };
    } else {
      const next = { ...current };
      delete next.skipped;
      next.baseMinimum = parsed.value;
      if (!next.currency) next.currency = "USD";
      preferences.compensation = next;
    }
    return { salary: text, salaryChoice: "" };
  }
  if (choice === "skip") {
    if (hasRealCompensation(preferences.compensation)) {
      return { salary: "", salaryChoice: "" };
    }
    preferences.compensation = { skipped: true };
    return { salary: "", salaryChoice: "skip" };
  }
  return { salary: "", salaryChoice: "" };
}

function educationPrefill(profile) {
  if (hasRealEducation(profile)) {
    const row = profile.education.find((item) => nonempty(item && item.institution) || nonempty(item && item.degree));
    const parts = [row && row.degree, row && row.institution].map(trimmed).filter(Boolean);
    return { education: parts.join(", "), educationChoice: "" };
  }
  if (isExclusiveTrueKey(profile && profile.educationSkip, "skipped")) {
    return { education: "", educationChoice: "skip" };
  }
  return { education: "", educationChoice: "" };
}

function compensationPrefillAmount(compensation) {
  if (!hasRealCompensation(compensation)) return null;
  const amount = [compensation.baseMinimum, compensation.totalTarget, compensation.totalMinimum].find((value) =>
    Number.isFinite(Number(value)),
  );
  return amount == null ? null : Number(amount);
}

function salaryPrefill(preferences) {
  const amount = compensationPrefillAmount(preferences && preferences.compensation);
  if (amount != null) {
    return { salary: String(amount), salaryChoice: "" };
  }
  if (isExclusiveTrueKey(preferences && preferences.compensation, "skipped")) {
    return { salary: "", salaryChoice: "skip" };
  }
  return { salary: "", salaryChoice: "" };
}

function emptyHomeFormValues() {
  return {
    name: "",
    location: "",
    history: "",
    goal: "",
    where: "",
    when: "",
    extra: "",
    dealBreakers: "",
    dealBreakersChoice: "",
    education: "",
    educationChoice: "",
    salary: "",
    salaryChoice: "",
  };
}

function firstRoleTargetTitle(preferences) {
  const targets = Array.isArray(preferences && preferences.roleTargets) ? preferences.roleTargets : [];
  for (const row of targets) {
    if (!Array.isArray(row && row.titles)) continue;
    const title = row.titles.map(trimmed).find(Boolean);
    if (title) return title;
  }
  return "";
}

function dealBreakersPrefill(preferences, answers) {
  if (Array.isArray(preferences && preferences.dealBreakers)) {
    const row = preferences.dealBreakers.find(
      (item) => nonempty(item && item.text) || (typeof item === "string" && nonempty(item)),
    );
    if (row) {
      const text = typeof row === "string" ? trimmed(row) : trimmed(row.text);
      if (text) return { dealBreakers: text, dealBreakersChoice: "" };
    }
  }
  if (isExclusiveTrueKey(preferences && preferences.dealBreakersSkip, "skipped")) {
    return { dealBreakers: "", dealBreakersChoice: "skip" };
  }
  if (isExclusiveTrueKey(preferences && preferences.dealBreakersSkip, "none")) {
    return { dealBreakers: "", dealBreakersChoice: "none" };
  }
  return {
    dealBreakers: trimmed(answers && answers.dealBreakers),
    dealBreakersChoice: trimmed(answers && answers.dealBreakersChoice),
  };
}

function stripTimestampFields(value) {
  if (Array.isArray(value)) return value.map(stripTimestampFields);
  if (!isRecord(value)) return value;
  const next = {};
  for (const key of Object.keys(value).sort()) {
    if (key === "savedAt" || key === "updatedAt") continue;
    next[key] = stripTimestampFields(value[key]);
  }
  return next;
}

function writeJsonIfMeaningfulChange(filePath, next) {
  if (fs.existsSync(filePath)) {
    const previous = readJson(filePath, {});
    if (JSON.stringify(stripTimestampFields(previous)) === JSON.stringify(stripTimestampFields(next))) {
      return false;
    }
  }
  writeJson(filePath, next);
  return true;
}

function keepPreviousHomeField(submitted, previous) {
  return nonempty(submitted) ? trimmed(submitted) : trimmed(previous);
}

function homeOnlyFieldsEmpty(answers) {
  return !nonempty(answers && answers.history)
    && !nonempty(answers && answers.where)
    && !nonempty(answers && answers.when)
    && !nonempty(answers && answers.extra);
}

function submittedMatchesPrefill(answers, prefill) {
  return Object.keys(emptyHomeFormValues()).every(
    (key) => trimmed(answers && answers[key]) === trimmed(prefill[key]),
  );
}

function readHomeFormPrefill(workspace) {
  const paths = workspacePaths(workspace);
  const profile = readJson(paths.profile, createDefaultProfile());
  const preferences = readJson(paths.preferences, emptyPreferences());
  const answers = readJson(path.join(workspace, HOME_ANSWERS_FILENAME), {});
  const candidate = isRecord(profile.candidate) ? profile.candidate : {};
  const education = educationPrefill(profile);
  const salary = salaryPrefill(preferences);
  const deal = dealBreakersPrefill(preferences, answers);
  // Prefill sources (profile/preferences first; home-answers.json only when the
  // field lives there or the main file has nothing):
  // name <- profile.candidate.preferredName || profile.candidate.name, else home-answers.name
  // location <- profile.candidate.location, else home-answers.location
  // goal <- first nonempty preferences.roleTargets[].titles[], else home-answers.goal
  // dealBreakers / dealBreakersChoice <- preferences.dealBreakers or dealBreakersSkip, else home-answers
  // education / educationChoice <- profile.education or educationSkip (#178)
  // salary / salaryChoice <- preferences.compensation (#178)
  // history, where, when, extra <- home-answers.json only
  // where is the exact option text from home-answers.where, never workModes
  return {
    name: trimmed(candidate.preferredName) || trimmed(candidate.name) || trimmed(answers.name),
    location: trimmed(candidate.location) || trimmed(answers.location),
    history: trimmed(answers.history),
    goal: firstRoleTargetTitle(preferences) || trimmed(answers.goal),
    where: trimmed(answers.where),
    when: trimmed(answers.when),
    extra: trimmed(answers.extra),
    dealBreakers: deal.dealBreakers,
    dealBreakersChoice: deal.dealBreakersChoice,
    education: education.education,
    educationChoice: education.educationChoice,
    salary: salary.salary,
    salaryChoice: salary.salaryChoice,
  };
}

function saveHomeAnswers(workspace, answers) {
  const goal = trimmed(answers && answers.goal);
  if (!goal) {
    const error = new Error("Goal is required.");
    error.code = "GOAL_REQUIRED";
    throw error;
  }
  const salaryText = trimmed(answers && answers.salary);
  if (salaryText) {
    const parsed = parseSalaryInput(salaryText);
    if (parsed.error) {
      const error = new Error(parsed.error);
      error.code = "SALARY_INVALID";
      throw error;
    }
  }

  ensureDir(workspace);
  const paths = workspacePaths(workspace);
  const savedAt = new Date().toISOString();
  const preferences = readJson(paths.preferences, emptyPreferences());
  const answersPath = path.join(workspace, HOME_ANSWERS_FILENAME);
  const homeAnswersExisted = fs.existsSync(answersPath);
  const prefill = readHomeFormPrefill(workspace);
  const skipCreateHomeAnswers =
    !homeAnswersExisted && homeOnlyFieldsEmpty(answers) && submittedMatchesPrefill(answers, prefill);
  const previousAnswers = readJson(answersPath, {});
  const dealBreakersRecord = applyDealBreakers(preferences, answers);
  const compensationRecord = applyCompensation(preferences, answers);
  const submittedName = trimmed(answers && answers.name);
  const submittedLocation = trimmed(answers && answers.location);
  const submittedWhere = trimmed(answers && answers.where);
  const nextHomeModes = WHERE_TO_WORK_MODES[submittedWhere];
  const nextHomeWorkMode = nextHomeModes ? nextHomeModes[0] : "";
  const payload = {
    name: keepPreviousHomeField(submittedName, previousAnswers.name),
    location: keepPreviousHomeField(submittedLocation, previousAnswers.location),
    history: keepPreviousHomeField(answers && answers.history, previousAnswers.history),
    goal,
    where: keepPreviousHomeField(submittedWhere, previousAnswers.where),
    when: keepPreviousHomeField(answers && answers.when, previousAnswers.when),
    extra: keepPreviousHomeField(answers && answers.extra, previousAnswers.extra),
    dealBreakers: dealBreakersRecord.dealBreakers,
    dealBreakersChoice: dealBreakersRecord.dealBreakersChoice,
    education: "",
    educationChoice: "",
    salary: compensationRecord.salary,
    salaryChoice: compensationRecord.salaryChoice,
    savedAt,
  };
  if (nextHomeWorkMode) {
    payload.lastHomeWorkMode = nextHomeWorkMode;
  } else {
    const previousHomeWorkMode = lastRecordedHomeWorkMode(previousAnswers);
    if (previousHomeWorkMode) {
      payload.lastHomeWorkMode = previousHomeWorkMode;
    }
  }

  const profile = readJson(paths.profile, createDefaultProfile());
  profile.candidate = profile.candidate || createDefaultProfile().candidate;
  if (submittedName) {
    const currentName = trimmed(profile.candidate.preferredName) || trimmed(profile.candidate.name);
    if (submittedName !== currentName) {
      profile.candidate.preferredName = submittedName;
      profile.candidate.name = submittedName;
    }
  }
  if (submittedLocation && submittedLocation !== trimmed(profile.candidate.location)) {
    profile.candidate.location = submittedLocation;
  }
  const educationRecord = applyEducation(profile, answers, previousAnswers);
  payload.education = educationRecord.education;
  payload.educationChoice = educationRecord.educationChoice;
  if (educationRecord.lastHomeEducationId) {
    payload.lastHomeEducationId = educationRecord.lastHomeEducationId;
  }
  profile.updatedAt = savedAt;
  if (!skipCreateHomeAnswers) {
    writeJsonIfMeaningfulChange(answersPath, payload);
  }
  writeJsonIfMeaningfulChange(paths.profile, profile);

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
  writeJsonIfMeaningfulChange(paths.preferences, preferences);

  const state = syncOnboardingState(workspace);
  return {
    message: "Answers saved.",
    answersPath,
    filename: HOME_ANSWERS_FILENAME,
    displayPath: `resume-builder / candidate / ${HOME_ANSWERS_FILENAME}`,
    state,
  };
}

module.exports = {
  HOME_ANSWERS_FILENAME,
  emptyHomeFormValues,
  saveHomeAnswers,
  parseSalaryInput,
  readHomeFormPrefill,
};
