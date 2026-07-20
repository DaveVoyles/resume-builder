"use strict";

/**
 * Cover letter render config schema (design plan 0004, D2 — see
 * docs/workspace-schemas.md for the field-by-field reference). Follows the
 * same style as resume-config.js (isNonEmptyString/isObject helpers,
 * {valid, errors} return shape, one errors.push(...) per violation).
 *
 * Shape:
 * {
 *   schemaVersion: "1.0",       // optional, must be "1.0" when present
 *   company: string,            // required non-empty string
 *   candidate: {
 *     name: string,             // required non-empty string
 *     contact: [{ text: string, link?: string }]  // required non-empty array
 *   },
 *   salutation: string,         // required non-empty string, e.g. "Dear Hiring Manager,"
 *   bodyParagraphs: string[],   // required non-empty array of non-empty strings
 *   closing: string,            // required non-empty string, e.g. "Sincerely,"
 * }
 */

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

function validateCoverLetterConfig(config) {
  const errors = [];

  if (!isObject(config)) {
    return { valid: false, errors: ["cover letter config must be an object"] };
  }

  if (config.schemaVersion !== undefined && config.schemaVersion !== "1.0") {
    errors.push('schemaVersion: must be "1.0" when present');
  }

  if (!isNonEmptyString(config.company)) errors.push("company: required non-empty string");

  if (!isObject(config.candidate)) {
    errors.push("candidate: required object");
  } else {
    if (!isNonEmptyString(config.candidate.name)) errors.push("candidate.name: required non-empty string");
    validateContactEntries(config.candidate.contact, errors);
  }

  if (!isNonEmptyString(config.salutation)) errors.push("salutation: required non-empty string");

  if (!Array.isArray(config.bodyParagraphs) || config.bodyParagraphs.length === 0) {
    errors.push("bodyParagraphs: required non-empty array of strings");
  } else if (!config.bodyParagraphs.every(isNonEmptyString)) {
    errors.push("bodyParagraphs: every entry must be a non-empty string");
  }

  if (!isNonEmptyString(config.closing)) errors.push("closing: required non-empty string");

  return { valid: errors.length === 0, errors };
}

module.exports = { validateCoverLetterConfig };
