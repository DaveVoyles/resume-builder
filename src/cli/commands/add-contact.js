"use strict";

const { stableId } = require("../../core/ids");
const { validateContact, CONTACT_STATUSES } = require("../../core/contact");
const { asArray } = require("../args");
const { readJson, resolveWorkspace, workspacePaths, writeJson } = require("../../core/workspace");

function isDuplicate(existing, nextContact) {
  return existing.some((contact) => contact.id === nextContact.id);
}

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);

  // Generate stable ID based on name and company
  const contactId = stableId("contact", [options.name, options.company]);

  // Build contact object
  const linkedRoleIds = asArray(options.linkedRole);
  const notes = options.notes ? [options.notes] : [];
  const contact = {
    id: contactId,
    name: options.name,
    company: options.company,
    relationship: options.relationship,
    contactMethod: options.contactMethod,
    linkedRoleIds,
    status: CONTACT_STATUSES[0], // First status is "identified"
    notes,
  };

  // Validate contact against schema
  const validation = validateContact(contact);
  if (!validation.valid) {
    throw new Error(`Invalid contact:\n${validation.errors.map((error) => `  - ${error}`).join("\n")}`);
  }

  // Read existing contacts
  const contacts = readJson(paths.contacts, []);

  // Check for duplicate
  if (isDuplicate(contacts, contact)) {
    console.log(`Contact already exists: ${contact.name}${contact.company ? ` at ${contact.company}` : ""}`);
    return;
  }

  // Write updated contacts
  writeJson(paths.contacts, contacts.concat(contact));
  console.log(`Added contact: ${contact.name}${contact.company ? ` at ${contact.company}` : ""}`);
}

module.exports = { run };
