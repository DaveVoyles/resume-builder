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
 *   extends?: string,                        // relative path to a base config; see loadResumeConfig
 *   roleTitle?: string,                     // used in the default output file name
 *   pageLimit?: 1 | 2 | 3,                  // default 1; page-count check warns above it
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

const fs = require("fs");
const path = require("path");
const { readJson } = require("./workspace");

const MAX_HEADLINE_CHARS = 80;
const MAX_SUMMARY_WORDS = 120;
const MAX_FIRST_JOB_BULLETS = 6;
const MAX_LATER_JOB_BULLETS = 4;
const MAX_PROXY_SCORE = 1000;

function wordCount(text) {
  return typeof text === "string" ? text.split(/\s+/u).filter(Boolean).length : 0;
}

// ResumeProxyScore = summary words + all bullet words + 40 per job + 20 per education row.
// Rough page-length proxy; a score over MAX_PROXY_SCORE fails validation.
function validateShortResume(config, errors) {
  const headline = config.candidate && config.candidate.headline;
  if (!isNonEmptyString(headline)) {
    errors.push("candidate.headline: required non-empty string");
  } else if (headline.length > MAX_HEADLINE_CHARS) {
    errors.push(`candidate.headline: must be ${MAX_HEADLINE_CHARS} characters or fewer (got ${headline.length})`);
  }

  const summaryWords = wordCount(config.summary && config.summary.text);
  if (summaryWords > MAX_SUMMARY_WORDS) {
    errors.push(`summary.text: must be ${MAX_SUMMARY_WORDS} words or fewer (got ${summaryWords})`);
  }

  let bulletWords = 0;
  let jobCount = 0;
  if (Array.isArray(config.experienceSections)) {
    config.experienceSections.forEach((section, i) => {
      if (!isObject(section) || !Array.isArray(section.jobs)) return;
      section.jobs.forEach((job, j) => {
        if (!isObject(job)) return;
        const limit = jobCount === 0 ? MAX_FIRST_JOB_BULLETS : MAX_LATER_JOB_BULLETS;
        jobCount += 1;
        if (!Array.isArray(job.bullets)) return;
        if (job.bullets.length > limit) {
          errors.push(`experienceSections[${i}].jobs[${j}].bullets: at most ${limit} bullets allowed for this job (got ${job.bullets.length})`);
        }
        job.bullets.forEach((bullet) => { bulletWords += wordCount(bullet); });
      });
    });
  }

  const educationRows = Array.isArray(config.education) ? config.education.length : 0;
  const score = summaryWords + bulletWords + 40 * jobCount + 20 * educationRows;
  if (score > MAX_PROXY_SCORE) {
    errors.push(`ResumeProxyScore ${score} is over ${MAX_PROXY_SCORE}; shorten the summary or bullets, or drop jobs`);
  }
}

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
  validateEvidenceIdList(job.evidenceIds, `${path}.evidenceIds`, errors);
  if (job.bulletEvidenceIds !== undefined) {
    if (!Array.isArray(job.bulletEvidenceIds)) {
      errors.push(`${path}.bulletEvidenceIds: must be an array with one list of evidence ids per bullet`);
    } else {
      if (Array.isArray(job.bullets) && job.bulletEvidenceIds.length > job.bullets.length) {
        errors.push(`${path}.bulletEvidenceIds: has ${job.bulletEvidenceIds.length} lists but the job has only ${job.bullets.length} bullets`);
      }
      job.bulletEvidenceIds.forEach((ids, i) => validateEvidenceIdList(ids, `${path}.bulletEvidenceIds[${i}]`, errors));
    }
  }
}

function validateEvidenceIdList(ids, path, errors) {
  if (ids === undefined) return;
  if (!Array.isArray(ids) || !ids.every(isNonEmptyString)) {
    errors.push(`${path}: must be a list of evidence ids (strings from evidence.jsonl)`);
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
  if (config.extends !== undefined && !isNonEmptyString(config.extends)) {
    errors.push("extends: must be a non-empty relative path to a base resume config when present");
  }
  if (config.outputFileName !== undefined && !isNonEmptyString(config.outputFileName)) {
    errors.push("outputFileName: must be a non-empty string when present");
  }

  if (config.roleTitle !== undefined && !isNonEmptyString(config.roleTitle)) {
    errors.push("roleTitle: must be a non-empty string when present");
  }
  if (config.pageLimit !== undefined && !(Number.isInteger(config.pageLimit) && config.pageLimit >= 1 && config.pageLimit <= 3)) {
    errors.push("pageLimit: must be a whole number from 1 to 3 when present (default 1)");
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
  } else {
    validateEvidenceIdList(config.summary.evidenceIds, "summary.evidenceIds", errors);
  }

  validateExperienceSections(config.experienceSections, errors);
  validateSkills(config.skills, errors);
  validateShortResume(config, errors);

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

const MAX_EXTENDS_DEPTH = 5;

function readConfigFile(file, label) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`extends: base config not found: ${label}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`extends: base config is not valid JSON: ${label}`);
  }
}

function resolveExtends(config, configPath, chain, label) {
  if (!isObject(config) || config.extends === undefined) return config;
  if (!isNonEmptyString(config.extends)) {
    throw new Error(`${label}: extends must be a non-empty relative path to a base resume config`);
  }
  if (path.isAbsolute(config.extends)) {
    throw new Error(`${label}: extends must be a relative path (got an absolute path)`);
  }
  const basePath = path.resolve(path.dirname(configPath), config.extends);
  if (chain.includes(basePath)) {
    throw new Error(`${label}: extends cycle: ${[...chain, basePath].map((file) => path.basename(file)).join(" -> ")}`);
  }
  if (chain.length >= MAX_EXTENDS_DEPTH) {
    throw new Error(`${label}: extends chain is longer than ${MAX_EXTENDS_DEPTH} configs`);
  }
  const baseLabel = config.extends;
  const base = resolveExtends(readConfigFile(basePath, baseLabel), basePath, [...chain, basePath], baseLabel);
  if (!isObject(base)) throw new Error(`extends: base config must be a JSON object: ${baseLabel}`);
  // Shallow merge: the child overrides whole top-level sections. The base's
  // outputFileName is not inherited, so two roles never render to one file.
  const { outputFileName: _baseOutputFileName, ...inherited } = base;
  const { extends: _extends, ...own } = config;
  return { ...inherited, ...own };
}

/**
 * Reads a resume config and resolves `extends` (a relative path, from this
 * file's folder, to a base config). The child's top-level sections replace the
 * base's whole; sections the child leaves out come from the base. Throws on a
 * missing or unreadable base, a cycle, or a chain longer than 5. The returned
 * object has no `extends` key. This is the one load point: render, tailor,
 * validate, and the study-guide bundle all go through it.
 */
function loadResumeConfig(configPath) {
  const absolute = path.resolve(configPath);
  const config = readJson(absolute);
  return resolveExtends(config, absolute, [absolute], path.basename(absolute));
}

const LIMITS = {
  maxHeadlineChars: MAX_HEADLINE_CHARS,
  maxSummaryWords: MAX_SUMMARY_WORDS,
  maxFirstJobBullets: MAX_FIRST_JOB_BULLETS,
  maxLaterJobBullets: MAX_LATER_JOB_BULLETS,
  maxProxyScore: MAX_PROXY_SCORE,
};

module.exports = { validateResumeConfig, loadResumeConfig, LAYOUTS, LIMITS };
