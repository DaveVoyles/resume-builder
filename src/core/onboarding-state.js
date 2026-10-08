"use strict";

// Onboarding progress is one record: candidate/.onboarding-state.json.
// Home and the tracker both read it through this module.
//
// Done-ness is derived from workspace files, then written back. A section is
// done only when its data exists, including an explicit skip the person
// recorded. Empty dealBreakers from init and an absent compensation object
// are not "done." See deriveOnboardingState().

const fs = require("fs");
const path = require("path");
const { readJson, writeJson, workspacePaths } = require("./workspace");

const HOME_ANSWERS_FILENAME = "home-answers.json";

const PLACEHOLDER_RESUME_NAMES = new Set(["readme", "readme.md", "readme.txt", "gitkeep"]);

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
  howTo: "Paste the posting link in the Add a job box on the Jobs tab, then give the sentence it makes to your agent. The agent adds the job and tailors your resume.",
};

// Single mapping used by the home server, home page (via GET /api/onboarding-state),
// and tests. Do not copy this object elsewhere.
//
// A home step is done only when every mapped key is done, except downloadRb
// and startRb: those are done whenever the home server serves this mapping
// (the running page is the proof) and they map to no tracker step.
// firstDraft maps to firstDraftReady, a home-only flag, not a tracker checkbox.
const HOME_STEPS = [
  { key: "downloadRb", label: "Download RB", howTo: "Done. RB is now on your computer." },
  { key: "startRb", label: "Start RB and open this page", howTo: "Done. You're looking at it." },
  {
    key: "addFiles",
    label: "Add your files to my-documents",
    howTo: "Drag old resumes and notes into my-documents at the top of the resume-builder folder.",
  },
  {
    key: "answerQuestions",
    label: "Answer a few questions",
    howTo: "The agent fills in what it can. You check it and click Save.",
  },
  {
    key: "firstDraft",
    label: "Get your first draft",
    howTo: "A new resume, after your files in my-documents are read in. Saving answers here is not a draft.",
  },
  {
    key: "addJobs",
    label: "Add jobs you want",
    howTo: "Paste the posting link in the Add a job box on the Jobs tab. It makes a sentence for your agent, who adds the job.",
  },
];

const HOME_STEP_TO_TRACKER_STEPS = {
  downloadRb: [],
  startRb: [],
  addFiles: ["materialIngested"],
  // Home form captures name (basicInfo) and goal (targetRole). Education and
  // salary are on the same form but are not required for this home step.
  answerQuestions: ["basicInfo", "targetRole"],
  firstDraft: ["firstDraftReady"],
  addJobs: ["firstRoleAdded"],
};

function defaultOnboardingState() {
  return {
    schemaVersion: "1.0",
    setupComplete: true,
    materialIngested: false,
    sections: Object.fromEntries(SECTIONS.map((section) => [section.key, false])),
    firstRoleAdded: false,
    firstDraftReady: false,
  };
}

function readOnboardingState(filePath) {
  return readJson(filePath, defaultOnboardingState());
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isExclusiveTrueKey(value, key) {
  return isRecord(value) && Object.keys(value).length === 1 && value[key] === true;
}

function isSkipped(value) {
  return isExclusiveTrueKey(value, "skipped");
}

function isFirstRoleAddedDone(value) {
  if (value === true) return true;
  return isRecord(value) && value.done === true;
}

function parseFirstRoleAdded(value) {
  if (value === true) return { done: true, at: null };
  if (isRecord(value)) {
    return {
      done: value.done === true,
      at: typeof value.at === "string" && value.at.trim() ? value.at.trim() : null,
    };
  }
  return { done: false, at: null };
}

function mergeFirstRoleAdded(previous, incoming, now = new Date().toISOString()) {
  const prev = parseFirstRoleAdded(previous);
  const next = parseFirstRoleAdded(incoming);
  if (!prev.done && !next.done) return false;
  return { done: true, at: prev.at || next.at || now };
}

function isFirstDraftReady(value) {
  return value === true;
}

// The single canonical list of every onboarding step, in order, with its
// done/pending status — isOnboardingComplete() and every checklist renderer
// (src/renderers/html-tracker.js) both derive from this one list rather than
// each hand-maintaining their own copy of "which fields count."
// firstDraftReady is home-only and is not a tracker step.
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
    {
      key: FINAL_STEP.key,
      label: FINAL_STEP.label,
      howTo: FINAL_STEP.howTo,
      done: isFirstRoleAddedDone(state[FINAL_STEP.key]),
    },
  ];
}

function isOnboardingComplete(state) {
  return onboardingSteps(state).every((step) => step.done);
}

function homeStepsFromOnboarding(onboardingState) {
  const state = onboardingState || {};
  const doneByKey = Object.fromEntries(onboardingSteps(state).map((step) => [step.key, step.done]));
  doneByKey.firstDraftReady = isFirstDraftReady(state.firstDraftReady);
  doneByKey.firstRoleAdded = isFirstRoleAddedDone(state.firstRoleAdded);
  return HOME_STEPS.map((step) => {
    const trackerKeys = HOME_STEP_TO_TRACKER_STEPS[step.key] || [];
    const done =
      step.key === "downloadRb" || step.key === "startRb"
        ? true
        : trackerKeys.length > 0 && trackerKeys.every((key) => Boolean(doneByKey[key]));
    return { key: step.key, label: step.label, trackerKeys, done };
  });
}

// Home "setup complete" for the Jobs tab and Continue setup: the Introduction
// "Answer a few questions" step is done (basicInfo + targetRole). Education and
// salary are tracker-only and do not block hiding "Go to setup" or "Continue setup".
function isHomeSetupComplete(onboardingState) {
  return homeStepsFromOnboarding(onboardingState).some((step) => step.key === "answerQuestions" && step.done);
}

// Next step after Save (also on GET /api/onboarding-state). Home HTML only
// renders this object; it does not pick the step itself.
//
// Rule:
// 1. First HOME_STEPS item that is not done.
// 2. Never return addJobs when a tracked role already exists (firstRoleAdded
//    done). Skip it and keep looking. The success box must not say
//    "Add a job you want" in that case.
// 3. If every home step is done, look at tracker sections the home form now
//    covers: education, then compensation. If either is not done, point at
//    that field.
// 4. Otherwise { key: "complete", label: "Setup complete" }.
function nextHomeStep(onboardingState) {
  const homeMeta = Object.fromEntries(HOME_STEPS.map((step) => [step.key, step]));
  for (const step of homeStepsFromOnboarding(onboardingState)) {
    if (step.done) continue;
    if (step.key === "addJobs" && isFirstRoleAddedDone(onboardingState && onboardingState.firstRoleAdded)) {
      continue;
    }
    const meta = homeMeta[step.key] || step;
    return { key: step.key, label: meta.label, howTo: meta.howTo || "" };
  }
  const trackerByKey = Object.fromEntries(onboardingSteps(onboardingState).map((step) => [step.key, step]));
  const formCovered = [
    { key: "education", label: "Add your education or skip it" },
    { key: "compensation", label: "Add your salary or skip it" },
  ];
  for (const item of formCovered) {
    const section = trackerByKey[item.key];
    if (section && !section.done) {
      return { key: item.key, label: item.label, howTo: section.howTo || "" };
    }
  }
  return { key: "complete", label: "Setup complete", howTo: "" };
}


// Merges a partial update into the existing (or default) state and writes
// it back — the shape callers reach for whenever a step completes, so no
// caller has to hand-roll a read-modify-write against the raw file. Backfills
// `sections` against the default shape (not just `current.sections`) so a
// state file that predates a since-added section key — or was hand-edited
// down to a subset — never silently drops keys instead of defaulting them
// to false. Legacy `firstRoleAdded: true` upgrades to `{ done, at }` on write.
function updateOnboardingState(filePath, patch) {
  const current = readOnboardingState(filePath);
  const next = {
    ...defaultOnboardingState(),
    ...current,
    ...patch,
    sections: { ...defaultOnboardingState().sections, ...current.sections, ...patch.sections },
  };
  next.firstRoleAdded = mergeFirstRoleAdded(current.firstRoleAdded, next.firstRoleAdded);
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

function hasEducation(profile) {
  if (isSkipped(profile.educationSkip)) return true;
  return (
    Array.isArray(profile.education) &&
    profile.education.some((row) => nonempty(row.institution) || nonempty(row.degree))
  );
}

function hasCompensation(preferences) {
  const compensation = preferences.compensation;
  if (!isRecord(compensation)) return false;
  if (Object.prototype.hasOwnProperty.call(compensation, "skipped")) {
    return isExclusiveTrueKey(compensation, "skipped");
  }
  return ["baseMinimum", "totalMinimum", "totalTarget"].some((key) => Number.isFinite(Number(compensation[key])));
}

function hasDealBreakers(preferences) {
  const skip = preferences.dealBreakersSkip;
  if (isExclusiveTrueKey(skip, "skipped") || isExclusiveTrueKey(skip, "none")) return true;
  return (
    Array.isArray(preferences.dealBreakers) &&
    preferences.dealBreakers.some((item) => nonempty(item && item.text) || nonempty(item))
  );
}

function isPlaceholderResumeName(name) {
  const base = String(name || "").trim().toLowerCase();
  if (!base || base.startsWith(".")) return true;
  return PLACEHOLDER_RESUME_NAMES.has(base);
}

function hasFirstDraftFile(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (entry.isFile() && !isPlaceholderResumeName(entry.name)) return true;
    }
  }
  return false;
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
  const firstDraftReady = hasFirstDraftFile(paths.outputResumes);

  const sections = {
    basicInfo: nonempty(candidate.preferredName) || nonempty(candidate.name) || nonempty(homeAnswers.name),
    workHistory:
      (Array.isArray(profile.experience) &&
        profile.experience.some((row) => nonempty(row.organization) || nonempty(row.title))) ||
      nonempty(homeAnswers.history),
    education: hasEducation(profile),
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
    dealBreakers: hasDealBreakers(preferences),
  };

  return {
    schemaVersion: "1.0",
    setupComplete,
    materialIngested,
    sections,
    firstRoleAdded,
    firstDraftReady,
  };
}

function loadOnboardingState(workspace) {
  const paths = workspacePaths(workspace);
  const previous = fs.existsSync(paths.onboardingState)
    ? readOnboardingState(paths.onboardingState)
    : defaultOnboardingState();
  const derived = deriveOnboardingState(workspace);
  return {
    ...derived,
    firstRoleAdded: mergeFirstRoleAdded(previous.firstRoleAdded, derived.firstRoleAdded),
  };
}

function syncOnboardingState(workspace) {
  const next = loadOnboardingState(workspace);
  writeJson(workspacePaths(workspace).onboardingState, next);
  return next;
}

module.exports = {
  SECTIONS,
  HOME_STEPS,
  HOME_STEP_TO_TRACKER_STEPS,
  HOME_ANSWERS_FILENAME,
  defaultOnboardingState,
  isOnboardingComplete,
  isHomeSetupComplete,
  isFirstRoleAddedDone,
  nextHomeStep,
  onboardingSteps,
  homeStepsFromOnboarding,
  readOnboardingState,
  updateOnboardingState,
  deriveOnboardingState,
  loadOnboardingState,
  syncOnboardingState,
  mergeFirstRoleAdded,
  hasFirstDraftFile,
};
