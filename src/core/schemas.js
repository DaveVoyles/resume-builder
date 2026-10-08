"use strict";

const { SECTIONS } = require("./onboarding-state");

function requireObject(value, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  return true;
}

function requireArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return false;
  }
  return true;
}

function requireString(value, label, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    const parts = label.split(".");
    errors.push(`${label}: missing ${parts[parts.length - 1]}`);
    return false;
  }
  return true;
}

function requireBoolean(value, label, errors) {
  if (typeof value !== "boolean") {
    errors.push(`${label} must be a boolean`);
    return false;
  }
  return true;
}

function checkDuplicateIds(entries, label, errors) {
  if (!Array.isArray(entries)) return;
  const seen = new Set();
  entries.forEach((entry, index) => {
    const id = entry && typeof entry === "object" ? entry.id : undefined;
    if (typeof id !== "string" || id === "") return;
    if (seen.has(id)) errors.push(`${label}[${index}]: duplicate id ${id}`);
    seen.add(id);
  });
}

function validateProfile(profile) {
  const errors = [];
  if (!requireObject(profile, "profile", errors)) return errors;
  requireObject(profile.candidate, "profile.candidate", errors);
  ["links", "skills", "experience", "projects", "education", "sources"].forEach((field) => {
    const value = field === "links" ? profile.candidate?.links : profile[field];
    requireArray(value, field === "links" ? "profile.candidate.links" : `profile.${field}`, errors);
  });
  ["experience", "projects", "education"].forEach((field) => {
    checkDuplicateIds(profile[field], `profile.${field}`, errors);
  });
  if (Array.isArray(profile.experience)) {
    profile.experience.forEach((row, index) => {
      const aliases = row && typeof row === "object" ? row.titleAliases : undefined;
      if (aliases !== undefined && (!Array.isArray(aliases) || !aliases.every((alias) => typeof alias === "string" && alias.trim() !== ""))) {
        errors.push(`profile.experience[${index}].titleAliases must be an array of non-empty strings`);
      }
    });
  }
  if (profile.educationSkip !== undefined) {
    const skip = profile.educationSkip;
    if (!skip || typeof skip !== "object" || Array.isArray(skip) || typeof skip.skipped !== "boolean") {
      errors.push("profile.educationSkip must be an object with boolean skipped");
    }
  }
  return errors;
}

const COMPENSATION_KEYS = new Set([
  "currency",
  "baseMinimum",
  "totalMinimum",
  "totalTarget",
  "publiclyShare",
  "skipped",
]);

const WORK_MODES = new Set(["remote", "hybrid", "on-site", "flexible"]);


function isExclusiveTrueKey(value, key) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    value[key] === true
  );
}

function validatePreferences(preferences) {
  const errors = [];
  if (!requireObject(preferences, "preferences", errors)) return errors;
  if (preferences.dealBreakersSkip !== undefined) {
    const skip = preferences.dealBreakersSkip;
    if (!isExclusiveTrueKey(skip, "skipped") && !isExclusiveTrueKey(skip, "none")) {
      errors.push('preferences.dealBreakersSkip must be exactly { "skipped": true } or { "none": true }');
    }
  }
  checkDuplicateIds(preferences.dealBreakers, "preferences.dealBreakers", errors);
  if (preferences.compensation !== undefined) {
    const compensation = preferences.compensation;
    if (!requireObject(compensation, "preferences.compensation", errors)) return errors;
    Object.keys(compensation).forEach((key) => {
      if (!COMPENSATION_KEYS.has(key)) {
        errors.push(`preferences.compensation.${key}: unknown key (allowed: ${[...COMPENSATION_KEYS].join(", ")})`);
      }
    });
    if (compensation.skipped !== undefined) {
      if (compensation.skipped !== true) {
        errors.push("preferences.compensation.skipped must be true");
      }
      const keys = Object.keys(compensation);
      if (keys.length !== 1 || keys[0] !== "skipped") {
        errors.push('preferences.compensation with skipped must be exactly { "skipped": true }');
      }
    }
  }
  if (preferences.locations !== undefined) {
    const locations = preferences.locations;
    if (!requireObject(locations, "preferences.locations", errors)) return errors;
    if (locations.workModes !== undefined) {
      if (!requireArray(locations.workModes, "preferences.locations.workModes", errors)) return errors;
      locations.workModes.forEach((mode, index) => {
        if (!WORK_MODES.has(mode)) {
          errors.push(`preferences.locations.workModes[${index}] must be one of: remote, hybrid, on-site, flexible`);
        }
      });
    }
  }
  return errors;
}

function validateEvidence(entries) {
  const errors = [];
  if (!requireArray(entries, "evidence", errors)) return errors;
  const ids = new Set();
  entries.forEach((entry, index) => {
    const label = `evidence line ${index + 1}`;
    if (!requireObject(entry, label, errors)) return;
    if (requireString(entry.id, `${label}.id`, errors)) {
      if (ids.has(entry.id)) errors.push(`${label}: duplicate id ${entry.id}`);
      ids.add(entry.id);
    }
    requireString(entry.type, `${label}.type`, errors);
    requireString(entry.fact, `${label}.fact`, errors);
    requireString(entry.summary, `${label}.summary`, errors);
    requireString(entry.confidence, `${label}.confidence`, errors);
    requireString(entry.createdAt, `${label}.createdAt`, errors);
    requireObject(entry.metadata, `${label}.metadata`, errors);
    ["organization", "dateRange", "section"].forEach((field) => {
      if (entry[field] !== undefined && (typeof entry[field] !== "string" || entry[field].trim() === "")) {
        errors.push(`${label}.${field}: must be a non-empty string when present`);
      }
    });

    if (requireObject(entry.source, `${label}.source`, errors)) {
      requireString(entry.source.kind, `${label}.source.kind`, errors);
      // `kind: "intake"` sources are legitimately sourceless-by-file: they're
      // the candidate's own conversational statement during grill intake
      // (see docs/playbooks/grill.md), not derived from a document or URL —
      // there is no path/url to require. See #103.
      if (entry.source.kind !== "intake") {
        const hasSourcePath = typeof entry.source.path === "string" && entry.source.path.trim() !== "";
        const hasSourceUrl = typeof entry.source.url === "string" && entry.source.url.trim() !== "";
        if (!hasSourcePath && !hasSourceUrl) {
          errors.push(`${label}.source: missing path or url`);
        }
      }
    }

    const hasSnippet = typeof entry.snippet === "string" && entry.snippet.trim() !== "";
    const hasQuote = typeof entry.quote === "string" && entry.quote.trim() !== "";
    if (entry.confidence === "metadata-only") {
      if (entry.fact !== entry.summary) {
        errors.push(`${label}: metadata-only evidence cannot support a separate fact without source text`);
      }
    } else if (!hasSnippet && !hasQuote) {
      errors.push(`${label}: source-backed evidence requires a snippet or quote`);
    }
  });
  return errors;
}

function validateRoles(roles, label) {
  const errors = [];
  if (!requireArray(roles, label, errors)) return errors;
  const ids = new Set();
  roles.forEach((role, index) => {
    const roleLabel = `${label}[${index}]`;
    if (!requireObject(role, roleLabel, errors)) return;
    ["id", "title", "company", "status"].forEach((field) => {
      if (typeof role[field] !== "string" || role[field].trim() === "") errors.push(`${roleLabel}: missing ${field}`);
    });
    if (ids.has(role.id)) errors.push(`${roleLabel}: duplicate id ${role.id}`);
    ids.add(role.id);
    if (!role.urls || typeof role.urls !== "object" || Array.isArray(role.urls)) errors.push(`${roleLabel}: urls must be an object`);
    if (!Array.isArray(role.notes)) errors.push(`${roleLabel}: notes must be an array`);
    if (!Array.isArray(role.followUpQuestions)) errors.push(`${roleLabel}: followUpQuestions must be an array`);
    validatePostingMetadata(role.posting, `${roleLabel}.posting`, errors);
    validateReportPath(role.resume && role.resume.reportPath, `${roleLabel}.resume.reportPath`, errors);
    validateCoverageRecord(role.resume && role.resume.baselineCoverage, `${roleLabel}.resume.baselineCoverage`, errors);
  });
  return errors;
}

// role.resume.baselineCoverage has the same shape as role.resume.keywordCoverage,
// scored for the person's general resume (or the resume the tailored one extends).
function validateCoverageRecord(value, label, errors) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label}: must be an object`);
    return;
  }
  if (!Array.isArray(value.covered)) errors.push(`${label}: covered must be an array`);
  if (!Array.isArray(value.missing)) errors.push(`${label}: missing must be an array`);
  if (value.percent !== undefined && !(Number.isFinite(value.percent) && value.percent >= 0 && value.percent <= 100)) {
    errors.push(`${label}: percent must be a number from 0 to 100`);
  }
}

function validateReportPath(value, label, errors) {
  if (value === undefined) return;
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label}: must be a non-empty string`);
  } else if (/^([a-zA-Z]:)?[\\/]/u.test(value) || value.split(/[\\/]/u).includes("..")) {
    errors.push(`${label}: must be a workspace-relative path without ".."`);
  }
}

const POSTING_SOURCES = new Set(["url", "pasted", "file"]);

// role.posting also carries optional display fields (location, compensation);
// the capture fields below are validated only when any of them is present.
function validatePostingMetadata(posting, label, errors) {
  if (posting === undefined) return;
  if (!posting || typeof posting !== "object" || Array.isArray(posting)) {
    errors.push(`${label}: must be an object`);
    return;
  }
  const captureKeys = ["path", "fetchedAt", "source", "keywords"];
  if (!captureKeys.some((key) => posting[key] !== undefined)) return;
  if (typeof posting.path !== "string" || posting.path.trim() === "") {
    errors.push(`${label}.path: must be a non-empty string`);
  } else if (/^([a-zA-Z]:)?[\\/]/u.test(posting.path) || posting.path.split(/[\\/]/u).includes("..")) {
    errors.push(`${label}.path: must be a workspace-relative path without ".."`);
  }
  if (typeof posting.fetchedAt !== "string" || Number.isNaN(Date.parse(posting.fetchedAt))) {
    errors.push(`${label}.fetchedAt: must be an ISO date-time string`);
  }
  if (!POSTING_SOURCES.has(posting.source)) errors.push(`${label}.source: must be url, pasted, or file`);
  const keywords = posting.keywords;
  if (!keywords || typeof keywords !== "object" || Array.isArray(keywords)) {
    errors.push(`${label}.keywords: must be an object with required and preferred arrays`);
    return;
  }
  ["required", "preferred"].forEach((key) => {
    if (!Array.isArray(keywords[key]) || keywords[key].some((item) => typeof item !== "string" || item.trim() === "")) {
      errors.push(`${label}.keywords.${key}: must be an array of non-empty strings`);
    }
  });
}

function validateFeedback(entries) {
  const errors = [];
  if (!requireArray(entries, "feedback", errors)) return errors;
  const ids = new Set();
  const validContexts = new Set(["grill", "interview", "study-guide", "tailor"]);
  const validSentiments = new Set(["confident", "neutral", "unsure", "poor"]);
  entries.forEach((entry, index) => {
    const label = `feedback line ${index + 1}`;
    if (!requireObject(entry, label, errors)) return;
    if (requireString(entry.id, `${label}.id`, errors)) {
      if (ids.has(entry.id)) errors.push(`${label}: duplicate id ${entry.id}`);
      ids.add(entry.id);
    }
    if (requireString(entry.schemaVersion, `${label}.schemaVersion`, errors) && entry.schemaVersion !== "1.0") {
      errors.push(`${label}.schemaVersion: must be "1.0"`);
    }
    requireString(entry.question, `${label}.question`, errors);
    requireString(entry.answer, `${label}.answer`, errors);
    requireString(entry.proposedAnswer, `${label}.proposedAnswer`, errors);
    requireString(entry.createdAt, `${label}.createdAt`, errors);

    if (requireString(entry.context, `${label}.context`, errors)) {
      if (!validContexts.has(entry.context)) {
        errors.push(`${label}.context: invalid value "${entry.context}" (must be grill, interview, study-guide, or tailor)`);
      }
    }

    if (requireString(entry.sentiment, `${label}.sentiment`, errors)) {
      if (!validSentiments.has(entry.sentiment)) {
        errors.push(`${label}.sentiment: invalid value "${entry.sentiment}" (must be confident, neutral, unsure, or poor)`);
      }
    }
  });
  return errors;
}

function requireFirstRoleAdded(value, label, errors) {
  if (typeof value === "boolean") return true;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (typeof value.done !== "boolean") {
      errors.push(`${label}.done must be a boolean`);
      return false;
    }
    if (value.done === true && (typeof value.at !== "string" || value.at.trim() === "")) {
      errors.push(`${label}.at must be an ISO timestamp when done is true`);
    }
    return true;
  }
  errors.push(`${label} must be a boolean or { "done": boolean, "at": string }`);
  return false;
}

function validateOnboardingState(state) {
  const errors = [];
  if (!requireObject(state, "onboarding-state", errors)) return errors;
  if (requireString(state.schemaVersion, "onboarding-state.schemaVersion", errors) && state.schemaVersion !== "1.0") {
    errors.push('onboarding-state.schemaVersion: must be "1.0"');
  }
  requireBoolean(state.setupComplete, "onboarding-state.setupComplete", errors);
  requireBoolean(state.materialIngested, "onboarding-state.materialIngested", errors);
  requireFirstRoleAdded(state.firstRoleAdded, "onboarding-state.firstRoleAdded", errors);
  if (state.firstDraftReady !== undefined) {
    requireBoolean(state.firstDraftReady, "onboarding-state.firstDraftReady", errors);
  }
  if (requireObject(state.sections, "onboarding-state.sections", errors)) {
    SECTIONS.forEach(({ key }) => {
      requireBoolean(state.sections[key], `onboarding-state.sections.${key}`, errors);
    });
  }
  return errors;
}

module.exports = {
  validateEvidence,
  validateOnboardingState,
  validateProfile,
  validatePreferences,
  validateRoles,
  validateFeedback,
  WORK_MODES,
};
