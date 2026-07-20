"use strict";

const { normalizeRole, statusBucket } = require("../core/role-view");
const { computeStaleness, DEFAULT_THRESHOLDS } = require("../core/staleness");

function cell(value) {
  const text = String(value || "—").replace(/\|/gu, "\\|").replace(/\r?\n/gu, "<br>");
  return text.trim() || "—";
}

function link(label, url) {
  return url ? `[${label}](${url})` : "—";
}

function renderTracker(roles, options = {}) {
  const stalenessThresholds = options.stalenessThresholds || DEFAULT_THRESHOLDS;
  const rolesWithNormalization = roles.map((role) => ({
    original: role,
    normalized: normalizeRole(role),
  }));

  const sortedRoles = rolesWithNormalization.sort((a, b) =>
    a.normalized.sortKey.localeCompare(b.normalized.sortKey)
  );

  const rows = sortedRoles.map(({ original, normalized: role }) => {
    // Enrich the original role with the computed statusBucket for staleness computation
    const roleWithBucket = {
      ...original,
      statusBucket: role.statusBucket,
    };
    const staleness = computeStaleness(roleWithBucket, stalenessThresholds);
    const staleInfo = staleness.isStale
      ? `Stale (${staleness.daysSinceTouch}d) — ${staleness.suggestedNextAction}`
      : "";

    return [
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
      cell(staleInfo),
      cell(role.notes),
    ].join(" | ");
  });

  return [
    "# Application Tracker",
    "",
    "Generated from `roles.tracked.json`. Rebuild with `node src/cli/index.js build-tracker --workspace <workspace>`.",
    "",
    "| Company | Role | Location | Compensation | Fit | Applied | Job URL | Apply URL | Resume | Cover Letter | Stale | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    rows.length === 0 ? "\n_No tracked roles yet._" : "",
    "",
  ]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n");
}

module.exports = { renderTracker };
