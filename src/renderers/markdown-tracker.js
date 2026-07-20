"use strict";

const { normalizeRole } = require("../core/role-view");

function cell(value) {
  const text = String(value || "—").replace(/\|/gu, "\\|").replace(/\r?\n/gu, "<br>");
  return text.trim() || "—";
}

function link(label, url) {
  return url ? `[${label}](${url})` : "—";
}

function renderTracker(roles) {
  const sortedRoles = [...roles].map(normalizeRole).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const rows = sortedRoles.map((role) =>
    [
      cell(role.company),
      cell(role.title),
      cell(role.location),
      cell(role.compensation),
      cell(role.fit),
      cell(role.applied),
      link("Job", role.jobUrl),
      link("Apply", role.applyUrl),
      cell(role.resume),
      cell(role.coverLetterStatus),
      cell(role.notes),
    ].join(" | "),
  );

  return [
    "# Application Tracker",
    "",
    "Generated from `roles.tracked.json`. Rebuild with `node src/cli/index.js build-tracker --workspace <workspace>`.",
    "",
    "| Company | Role | Location | Compensation | Fit | Applied | Job URL | Apply URL | Resume | Cover Letter | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    rows.length === 0 ? "\n_No tracked roles yet._" : "",
    "",
  ]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n");
}

module.exports = { renderTracker };
