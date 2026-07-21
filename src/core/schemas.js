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

function validateProfile(profile) {
  const errors = [];
  if (!requireObject(profile, "profile", errors)) return errors;
  requireObject(profile.candidate, "profile.candidate", errors);
  ["links", "skills", "experience", "projects", "education", "sources"].forEach((field) => {
    const value = field === "links" ? profile.candidate?.links : profile[field];
    requireArray(value, field === "links" ? "profile.candidate.links" : `profile.${field}`, errors);
  });
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
  });
  return errors;
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

function validateOnboardingState(state) {
  const errors = [];
  if (!requireObject(state, "onboarding-state", errors)) return errors;
  requireBoolean(state.setupComplete, "onboarding-state.setupComplete", errors);
  requireBoolean(state.materialIngested, "onboarding-state.materialIngested", errors);
  requireBoolean(state.firstRoleAdded, "onboarding-state.firstRoleAdded", errors);
  if (requireObject(state.sections, "onboarding-state.sections", errors)) {
    SECTIONS.forEach(({ key }) => {
      requireBoolean(state.sections[key], `onboarding-state.sections.${key}`, errors);
    });
  }
  return errors;
}

module.exports = { validateEvidence, validateOnboardingState, validateProfile, validateRoles, validateFeedback };
