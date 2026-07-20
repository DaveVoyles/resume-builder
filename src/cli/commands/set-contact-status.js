"use strict";

const { readJson, resolveWorkspace, workspacePaths, writeJson } = require("../../core/workspace");
const { CONTACT_STATUSES } = require("../../core/contact");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Rule table for auto-generating nextAction on status transitions
const CONTACT_NEXT_ACTION_RULES = {
  "reached-out": {
    type: "follow-up",
    dueDateOffsetDays: 7,
    note: "check in if no response",
  },
  responded: {
    type: "follow-up",
    dueDateOffsetDays: 3,
    note: "schedule a call or meeting",
  },
  "meeting-scheduled": {
    type: "follow-up",
    dueDateOffsetDays: 1,
    note: "send thank-you",
  },
  met: {
    type: "follow-up",
    dueDateOffsetDays: 2,
    note: "send thank-you and follow up on next steps",
  },
  referred: {
    type: "follow-up",
    dueDateOffsetDays: 3,
    note: "check in on referral outcome",
  },
  "no-response": {
    type: "close",
    // no dueDate, no note
  },
  dormant: {
    type: "close",
    // no dueDate, no note
  },
  // "identified": untouched entirely — no rule, same as set-status.js's "interested"
};

function getCurrentDate() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function addDays(dateStr, days) {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

function validateStatus(status) {
  if (!CONTACT_STATUSES.includes(status)) {
    throw new Error(
      `Invalid status: ${status}. Must be one of: ${CONTACT_STATUSES.join(", ")}`
    );
  }
}

function validateDate(date) {
  if (date !== undefined && !DATE_PATTERN.test(date)) {
    throw new Error(`Invalid --date: ${date}. Expected YYYY-MM-DD format.`);
  }
}

async function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);

  // Validate inputs
  if (!options.id) {
    throw new Error("set-contact-status requires --id <contact-id>");
  }
  if (!options.status) {
    throw new Error("set-contact-status requires --status <status>");
  }

  validateStatus(options.status);
  validateDate(options.date);

  // Read contacts
  const contacts = readJson(paths.contacts, []);

  // Find the contact to update
  const contact = contacts.find((candidate) => candidate.id === options.id);
  if (!contact) {
    throw new Error(`Contact not found: no contact with id "${options.id}".`);
  }

  // Update the contact's status
  contact.status = options.status;

  // Auto-generate nextAction based on status transition, per the rule table.
  // "identified" has no entry in CONTACT_NEXT_ACTION_RULES, so nextAction is left
  // completely untouched for it.
  const rule = CONTACT_NEXT_ACTION_RULES[options.status];
  if (rule && (options.status === "no-response" || options.status === "dormant")) {
    contact.nextAction = { type: rule.type };
  } else if (rule) {
    const statusDate = options.date || getCurrentDate();
    const dueDate = addDays(statusDate, rule.dueDateOffsetDays);
    contact.nextAction = {
      type: rule.type,
      owner: "candidate",
      dueDate,
    };
    if (!Array.isArray(contact.notes)) {
      contact.notes = [];
    }
    // Guard against duplicate notes from a repeat call to the same status
    // (e.g. an idempotent re-run) — a genuine later re-cycle still gets a fresh
    // note since it won't be the immediately preceding entry.
    if (rule.note && contact.notes[contact.notes.length - 1] !== rule.note) {
      contact.notes.push(rule.note);
    }
  }

  // Write updated contacts
  writeJson(paths.contacts, contacts);

  console.log(`Updated contact "${contact.name}" to status: ${options.status}`);
}

module.exports = { run, CONTACT_STATUSES };
