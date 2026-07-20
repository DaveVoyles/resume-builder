"use strict";

/**
 * Resume render config schema (design plan 0001, D2 — see
 * docs/workspace-schemas.md for the field-by-field reference). Ported from
 * the private upstream implementation's role-config schema and genericized:
 * candidate identity, contact, education, publications, and speaking are all
 * config-driven fields instead of engine-hardcoded constants, so the render
 * engine carries no candidate-specific data of its own.
 *
 * Shape:
 * {
 *   schemaVersion: "1.0",
 *   company: string,
 *   outputFileName?: string,
 *   candidate: { name: string, contact: [{ text: string, link?: string }] },
 *   summary: { text: string, fitOverride?: string|null },
 *   experienceSections: [
 *     { heading: string, jobs: [{ title, company, dates, subHeader?, bullets: string[] }] }
 *   ],
 *   skills: [[label, value], ...],
 *   education?: [{ degree, institution, dates, details? }],
 *   publications?: [{ title, publisher, dates, details? }],
 *   speaking?: [{ heading, organizations, dates, details? }],
 *   includeEducation?: boolean,             // default true
 *   includePublicationsSpeaking?: boolean,  // default true
 *   publicationsSpeakingLayout?: "combined" | "speaking-then-publications" | "combined-speaking-only" | "publications-only"
 * }
 */

const LAYOUTS = ["combined", "speaking-then-publications", "combined-speaking-only", "publications-only"];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateContactEntries(contact, errors) {
  if (!Array.isArray(contact) || contact.length === 0) {
    errors.push("candidate.contact: required non-empty array of {text, link?} entries");
    return;
  }
  contact.forEach((entry, index) => {
    const path = `candidate.contact[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    if (!isNonEmptyString(entry.text)) errors.push(`${path}.text: required non-empty string`);
    if (entry.link !== undefined && !isNonEmptyString(entry.link)) {
      errors.push(`${path}.link: must be a non-empty string when present`);
    }
  });
}

function validateJob(job, path, errors) {
  if (!isObject(job)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  for (const field of ["title", "company", "dates"]) {
    if (!isNonEmptyString(job[field])) errors.push(`${path}.${field}: required non-empty string`);
  }
  if (job.subHeader !== undefined && typeof job.subHeader !== "string") {
    errors.push(`${path}.subHeader: must be a string when present`);
  }
  if (!Array.isArray(job.bullets) || job.bullets.length === 0) {
    errors.push(`${path}.bullets: required non-empty array of strings`);
  } else if (!job.bullets.every(isNonEmptyString)) {
    errors.push(`${path}.bullets: every entry must be a non-empty string`);
  }
}

function validateExperienceSections(sections, errors) {
  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push("experienceSections: required non-empty array");
    return;
  }
  sections.forEach((section, i) => {
    const path = `experienceSections[${i}]`;
    if (!isObject(section)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    if (!isNonEmptyString(section.heading)) errors.push(`${path}.heading: required non-empty string`);
    if (!Array.isArray(section.jobs) || section.jobs.length === 0) {
      errors.push(`${path}.jobs: required non-empty array`);
    } else {
      section.jobs.forEach((job, j) => validateJob(job, `${path}.jobs[${j}]`, errors));
    }
  });
}

function validateSkills(skills, errors) {
  if (!Array.isArray(skills) || skills.length === 0) {
    errors.push("skills: required non-empty array of [label, value] pairs");
    return;
  }
  skills.forEach((row, i) => {
    if (!Array.isArray(row) || row.length !== 2 || !row.every(isNonEmptyString)) {
      errors.push(`skills[${i}]: must be a [label, value] pair of non-empty strings`);
    }
  });
}

function validateEntryList(list, label, requiredFields, errors) {
  if (list === undefined) return;
  if (!Array.isArray(list)) {
    errors.push(`${label}: must be an array when present`);
    return;
  }
  list.forEach((entry, i) => {
    const path = `${label}[${i}]`;
    if (!isObject(entry)) {
      errors.push(`${path}: must be an object`);
      return;
    }
    requiredFields.forEach((field) => {
      if (!isNonEmptyString(entry[field])) errors.push(`${path}.${field}: required non-empty string`);
    });
    if (entry.details !== undefined && typeof entry.details !== "string") {
      errors.push(`${path}.details: must be a string when present`);
    }
  });
}

function validateResumeConfig(config) {
  const errors = [];

  if (!isObject(config)) {
    return { valid: false, errors: ["resume config must be an object"] };
  }

  if (config.schemaVersion !== undefined && config.schemaVersion !== "1.0") {
    errors.push('schemaVersion: must be "1.0" when present');
  }

  if (!isNonEmptyString(config.company)) errors.push("company: required non-empty string");
  if (config.outputFileName !== undefined && !isNonEmptyString(config.outputFileName)) {
    errors.push("outputFileName: must be a non-empty string when present");
  }

  if (!isObject(config.candidate)) {
    errors.push("candidate: required object");
  } else {
    if (!isNonEmptyString(config.candidate.name)) errors.push("candidate.name: required non-empty string");
    validateContactEntries(config.candidate.contact, errors);
  }

  if (!isObject(config.summary)) {
    errors.push("summary: required object");
  } else if (!isNonEmptyString(config.summary.text)) {
    errors.push("summary.text: required non-empty string");
  }

  validateExperienceSections(config.experienceSections, errors);
  validateSkills(config.skills, errors);

  validateEntryList(config.education, "education", ["degree", "institution", "dates"], errors);
  validateEntryList(config.publications, "publications", ["title", "publisher", "dates"], errors);
  validateEntryList(config.speaking, "speaking", ["heading", "organizations", "dates"], errors);

  if (config.includeEducation !== undefined && typeof config.includeEducation !== "boolean") {
    errors.push("includeEducation: must be a boolean when present");
  }
  if (config.includePublicationsSpeaking !== undefined && typeof config.includePublicationsSpeaking !== "boolean") {
    errors.push("includePublicationsSpeaking: must be a boolean when present");
  }
  if (config.publicationsSpeakingLayout !== undefined && !LAYOUTS.includes(config.publicationsSpeakingLayout)) {
    errors.push(`publicationsSpeakingLayout: must be one of ${LAYOUTS.join(", ")} when present`);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateResumeConfig };
