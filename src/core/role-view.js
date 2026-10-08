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
// funnel stages, in this order:
// 1. Text that is only an ISO date (whitespace allowed) is applied.
// 2. Exact phrase after lowercasing, stripping ISO dates, and collapsing
//    non-letters to spaces. "not applied" and "not yet" stay not-applied.
// 3. If still unmatched, the first word only: applied, interview/interviewing,
//    offer, rejected/denied, withdrawn, ghosted. A first word of "not" never
//    matches a stage.
// 4. Otherwise other.
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

const FIRST_WORD_TO_STAGE = {
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
  const raw = String(appliedText || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return "applied";
  }

  const normalized = raw
    .toLowerCase()
    .replace(/\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim();
  const firstWord = normalized.split(" ")[0];
  return STATUS_TO_STAGE[normalized] || FIRST_WORD_TO_STAGE[firstWord] || "other";
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
    // The same number the report shows (covered keywords out of all keywords). The weighted
    // `score` is only a fallback for roles saved before `percent` existed.
    keywordScore: Number.isFinite(role.resume?.keywordCoverage?.percent)
      ? role.resume.keywordCoverage.percent
      : Number.isFinite(role.resume?.keywordCoverage?.score)
        ? role.resume.keywordCoverage.score
        : null,
    keywordMissing: Array.isArray(role.resume?.keywordCoverage?.missing) ? role.resume.keywordCoverage.missing.length : null,
    reportPath: firstNonEmpty(role.resume?.reportPath),
    coverLetterStatus: role.coverLetter?.status || null,
    notes: formatNotes(role),
    sortKey: `${role.company || ""} ${role.title || role.role || ""} ${role.id || ""}`,
  };
}

const EMPTY_STATUS_BUCKETS = {
  applied: 0,
  rejected: 0,
  "not-applied": 0,
  ghosted: 0,
  other: 0,
  interview: 0,
  offer: 0,
  withdrawn: 0,
};

// Single counting path for the HTML tracker funnel/stat cards and the home
// Jobs tab. Always goes through normalizeRole → statusBucket so neither
// caller can invent its own buckets.
function countRoleStats(roles) {
  const list = Array.isArray(roles) ? roles : [];
  const normalized = list.map(normalizeRole);
  const buckets = normalized.reduce(
    (acc, role) => {
      acc[role.statusBucket] = (acc[role.statusBucket] || 0) + 1;
      return acc;
    },
    { ...EMPTY_STATUS_BUCKETS },
  );
  const total = normalized.length;
  const readyToApply = normalized.filter((role) => role.readyToApply).length;
  const notStarted = buckets["not-applied"] - readyToApply;
  const appliedOrBeyond = total - buckets["not-applied"] - buckets.other;
  return {
    total,
    buckets,
    readyToApply,
    notStarted,
    appliedOrBeyond,
    appliedFunnelPercent: total > 0 ? Math.round((appliedOrBeyond / total) * 100) : 0,
    applied: buckets.applied,
    interview: buckets.interview,
  };
}


module.exports = {
  compensationRange,
  countRoleStats,
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
