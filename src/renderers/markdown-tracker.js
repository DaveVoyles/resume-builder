"use strict";

function cell(value) {
  const text = String(value || "—").replace(/\|/gu, "\\|").replace(/\r?\n/gu, "<br>");
  return text.trim() || "—";
}

function link(label, url) {
  return url ? `[${label}](${url})` : "—";
}

function firstNonEmpty(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") || "";
}

function formatCurrency(amount, currency) {
  if (amount === undefined || amount === null || amount === "") return "";
  const number = Number(amount);
  if (!Number.isFinite(number)) return String(amount);
  if (currency === "USD" || currency === "$") return `$${number.toLocaleString("en-US")}`;
  return `${number.toLocaleString("en-US")} ${currency || ""}`.trim();
}

function formatCompensation(role) {
  const compensation = role.posting?.compensation || role.compensation;
  if (!compensation || typeof compensation !== "object") return compensation || "";
  const currency = compensation.currency || "";
  const minimum = formatCurrency(compensation.minimum ?? compensation.min, currency);
  const maximum = formatCurrency(compensation.maximum ?? compensation.max, currency);
  if (minimum && maximum) return `${minimum}–${maximum}`;
  return firstNonEmpty(minimum, maximum, compensation.summary, compensation.text);
}

function formatFit(role) {
  if (!role.fit || typeof role.fit !== "object") return role.fit || "";
  return [role.fit.level, role.fit.rationale].filter(Boolean).join(": ");
}

function formatApplied(role) {
  return firstNonEmpty(
    role.application?.appliedAt,
    role.application?.appliedDate,
    role.application?.status,
    role.applied,
    !["seed", "tracked"].includes(role.status) ? role.status : "",
  );
}

function formatNextAction(role) {
  const action = role.nextAction;
  if (!action || typeof action !== "object") return action || "";
  return [action.type, action.owner && `owner: ${action.owner}`, action.dueDate && `due: ${action.dueDate}`].filter(Boolean).join("; ");
}

function formatNotes(role) {
  const notes = Array.isArray(role.notes) ? role.notes : role.notes ? [role.notes] : [];
  const nextAction = formatNextAction(role);
  const actions = nextAction ? [`Next action: ${nextAction}`] : [];
  const questions = Array.isArray(role.followUpQuestions) ? role.followUpQuestions.map((question) => `Question: ${question}`) : [];
  return notes.concat(actions, questions).join("<br>");
}

function normalizeRole(role) {
  return {
    company: role.company,
    title: role.title || role.role,
    location: firstNonEmpty(role.posting?.location, role.location),
    compensation: formatCompensation(role),
    fit: formatFit(role),
    applied: formatApplied(role),
    jobUrl: role.urls?.job,
    applyUrl: role.urls?.apply,
    resume: firstNonEmpty(role.resume?.outputPath, role.output?.resume),
    notes: formatNotes(role),
    sortKey: `${role.company || ""} ${role.title || role.role || ""} ${role.id || ""}`,
  };
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
      cell(role.notes),
    ].join(" | "),
  );

  return [
    "# Application Tracker",
    "",
    "Generated from `roles.tracked.json`. Rebuild with `node src/cli/index.js build-tracker --workspace <workspace>`.",
    "",
    "| Company | Role | Location | Compensation | Fit | Applied | Job URL | Apply URL | Resume | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    rows.length === 0 ? "\n_No tracked roles yet._" : "",
    "",
  ]
    .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
    .join("\n");
}

module.exports = { renderTracker };
