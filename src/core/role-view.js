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
  // An explicit application.status (set by the `set-status` command) is the
  // deterministic source of truth once present — combine it with the date so
  // statusBucket()'s explicit status-to-stage map (below) still classifies
  // "Applied 2026-06-08" as applied, instead of letting a bare appliedAt date
  // shadow the status entirely.
  const status = role.application?.status;
  if (status) {
    const date = firstNonEmpty(role.application?.appliedAt, role.application?.appliedDate);
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return date ? `${label} ${date}` : label;
  }
  return firstNonEmpty(
    role.application?.appliedAt,
    role.application?.appliedDate,
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

// Maps a role's free-text or enum application status onto a closed set of
// funnel stages. Exact phrases only (after lowercasing and stripping an ISO
// date) so "Not applied" cannot match applied. interview/offer/withdrawn/ghosted
// stay their own buckets (not "other") so set-status's whole point —
// deterministic, visible status — actually shows up distinctly in the tracker UI.
const STATUS_TO_STAGE = {
  "": "not-applied",
  interested: "not-applied",
  "not applied": "not-applied",
  "not yet": "not-applied",
  ready: "not-applied",
  "ready to apply": "not-applied",
  applied: "applied",
  interview: "interview",
  interviewing: "interview",
  offer: "offer",
  rejected: "rejected",
  denied: "rejected",
  withdrawn: "withdrawn",
  ghosted: "ghosted",
};

function statusBucket(appliedText) {
  const normalized = String(appliedText || "")
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim();
  return STATUS_TO_STAGE[normalized] || "other";
}

// A "not-applied" role with a rendered resume already has everything it
// needs to submit — a meaningfully more actionable state than a role that
// hasn't been worked on at all. Lives here (not inlined per-renderer) so
// every renderer that wants this distinction agrees on its definition;
// display-only, and independent of statusBucket itself, which stays the
// stable, closed classification that staleness.js and every renderer
// already key off of.
function isReadyToApply(bucket, resume) {
  return bucket === "not-applied" && Boolean(resume);
}

function normalizeRole(role) {
  const applied = formatApplied(role);
  const bucket = statusBucket(applied);
  const resume = firstNonEmpty(role.resume?.outputPath, role.output?.resume);
  return {
    id: role.id,
    company: role.company,
    title: role.title || role.role,
    location: firstNonEmpty(role.posting?.location, role.location),
    compensation: formatCompensation(role),
    compensationRange: compensationRange(role),
    fit: formatFit(role),
    applied,
    statusBucket: bucket,
    readyToApply: isReadyToApply(bucket, resume),
    jobUrl: role.urls?.job,
    applyUrl: role.urls?.apply,
    resume,
    coverLetterStatus: role.coverLetter?.status || null,
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
  isReadyToApply,
  normalizeRole,
  statusBucket,
};
