"use strict";

function cell(value) {
  const text = String(value || "—").replace(/\|/gu, "\\|").replace(/\r?\n/gu, "<br>");
  return text.trim() || "—";
}

function formatDueDate(nextAction) {
  if (!nextAction || !nextAction.dueDate) return "—";
  return cell(nextAction.dueDate);
}

function formatNotes(notes) {
  if (!notes || notes.length === 0) return "—";
  return cell(notes.join("; "));
}

function sortContacts(contacts) {
  const withSort = contacts.map((contact) => ({
    original: contact,
    sortKey: contact.nextAction?.dueDate || "￿", // Use high unicode value for undefined
  }));

  return withSort
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((entry) => entry.original);
}

function renderContactsTracker(contacts, options = {}) {
  const sortedContacts = sortContacts(contacts);

  const rows = sortedContacts.map((contact) => {
    return [
      cell(contact.name),
      cell(contact.company || "—"),
      cell(contact.relationship),
      cell(contact.status),
      formatDueDate(contact.nextAction),
      formatNotes(contact.notes),
    ].join(" | ");
  });

  return [
    "# Contact Tracker",
    "",
    "Generated from `contacts.json`. Rebuild with `node src/cli/index.js build-contacts-tracker --workspace <workspace>`.",
    "",
    "| Name | Company | Relationship | Status | Next Action Due | Notes |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    rows.length === 0 ? "\n_No tracked contacts yet._" : "",
    "",
  ]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n");
}

module.exports = { renderContactsTracker };
