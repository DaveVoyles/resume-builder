"use strict";

/**
 * Contact schema validation. A contact represents a person in the candidate's
 * professional network for referral and networking tracking purposes.
 *
 * Shape:
 * {
 *   id: string,
 *   name: string,
 *   company?: string,
 *   relationship: "referral" | "former-colleague" | "recruiter" | "informational-interview" | "other",
 *   contactMethod?: string,
 *   linkedRoleIds: string[],
 *   status: "identified" | "reached-out" | "responded" | "meeting-scheduled" | "met" | "referred" | "no-response" | "dormant",
 *   notes: string[],
 *   nextAction?: object
 * }
 */

const CONTACT_STATUSES = [
  "identified",
  "reached-out",
  "responded",
  "meeting-scheduled",
  "met",
  "referred",
  "no-response",
  "dormant",
];

const CONTACT_RELATIONSHIPS = [
  "referral",
  "former-colleague",
  "recruiter",
  "informational-interview",
  "other",
];

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateContact(contact) {
  const errors = [];

  if (!isObject(contact)) {
    return { valid: false, errors: ["contact must be an object"] };
  }

  // Required fields
  if (!isNonEmptyString(contact.id)) {
    errors.push("contact.id: required non-empty string");
  }
  if (!isNonEmptyString(contact.name)) {
    errors.push("contact.name: required non-empty string");
  }
  if (contact.relationship === undefined || !CONTACT_RELATIONSHIPS.includes(contact.relationship)) {
    errors.push(
      `contact.relationship: required enum value (must be one of: ${CONTACT_RELATIONSHIPS.join(", ")})`
    );
  }
  if (contact.status === undefined || !CONTACT_STATUSES.includes(contact.status)) {
    errors.push(
      `contact.status: required enum value (must be one of: ${CONTACT_STATUSES.join(", ")})`
    );
  }

  // Optional fields
  if (contact.company !== undefined && !isNonEmptyString(contact.company)) {
    errors.push("contact.company: must be a non-empty string when present");
  }
  if (contact.contactMethod !== undefined && !isNonEmptyString(contact.contactMethod)) {
    errors.push("contact.contactMethod: must be a non-empty string when present");
  }

  // linkedRoleIds must be an array of strings (empty allowed — a contact may
  // not be linked to any tracked role yet)
  if (!Array.isArray(contact.linkedRoleIds)) {
    errors.push("contact.linkedRoleIds: required array");
  } else if (!contact.linkedRoleIds.every(isNonEmptyString)) {
    errors.push("contact.linkedRoleIds: every entry must be a non-empty string");
  }

  // notes must be an array of strings (empty allowed — a freshly identified
  // contact may not have any notes yet)
  if (!Array.isArray(contact.notes)) {
    errors.push("contact.notes: required array");
  } else if (!contact.notes.every(isNonEmptyString)) {
    errors.push("contact.notes: every entry must be a non-empty string");
  }

  // nextAction is optional but must be an object if present
  if (contact.nextAction !== undefined && !isObject(contact.nextAction)) {
    errors.push("contact.nextAction: must be an object when present");
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateContact,
  CONTACT_STATUSES,
  CONTACT_RELATIONSHIPS,
};
