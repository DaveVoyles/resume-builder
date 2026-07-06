"use strict";

// Shared role-normalization logic used by every tracker renderer (markdown,
// HTML, and any future format). Keeping this in one place means renderers
// stay thin and always agree on how a `roles.tracked.json` entry maps to
// display fields.

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

function compensationRange(role) {
  const compensation = role.posting?.compensation || role.compensation;
  if (!compensation || typeof compensation !== "object") return { minimum: undefined, maximum: undefined };
  const minimum = Number(compensation.minimum ?? compensation.min);
  const maximum = Number(compensation.maximum ?? compensation.max);
  return {
    minimum: Number.isFinite(minimum) ? minimum : undefined,
    maximum: Number.isFinite(maximum) ? maximum : undefined,
  };
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

// Buckets a role's free-text "applied" status into a small, stable set of
// statuses so renderers can filter/color consistently regardless of the
// exact wording a candidate or agent used (e.g. "Applied 2026-06-08",
// "Rejected", "not yet").
function statusBucket(appliedText) {
  const status = String(appliedText || "").toLowerCase();
  if (status.includes("rejected") || status.includes("denied")) return "rejected";
  if (status.includes("applied")) return "applied";
  if (status === "" || status === "not yet" || status.includes("ready") || status.includes("interested")) return "not-applied";
  return "other";
}

function normalizeRole(role) {
  const applied = formatApplied(role);
  return {
    id: role.id,
    company: role.company,
    title: role.title || role.role,
    location: firstNonEmpty(role.posting?.location, role.location),
    compensation: formatCompensation(role),
    compensationRange: compensationRange(role),
    fit: formatFit(role),
    applied,
    statusBucket: statusBucket(applied),
    jobUrl: role.urls?.job,
    applyUrl: role.urls?.apply,
    resume: firstNonEmpty(role.resume?.outputPath, role.output?.resume),
    notes: formatNotes(role),
    sortKey: `${role.company || ""} ${role.title || role.role || ""} ${role.id || ""}`,
  };
}

module.exports = {
  compensationRange,
  formatApplied,
  formatCompensation,
  formatCurrency,
  formatFit,
  formatNextAction,
  formatNotes,
  normalizeRole,
  statusBucket,
};
