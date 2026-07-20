"use strict";

// Per-status-bucket day thresholds for flagging roles as stale.
// A role becomes stale if its last-touch date (appliedAt or updatedAt,
// whichever is more recent) is ≥ the threshold for its status bucket.
// Terminal statuses (rejected, withdrawn, ghosted) are exempt.
const DEFAULT_THRESHOLDS = {
  applied: 14,
  interview: 7,
  offer: 3,
  "not-applied": 30,
  other: 21,
};

// Suggested follow-up actions per status bucket when stale.
const SUGGESTED_ACTIONS = {
  applied: "Follow up on application status",
  interview: "Follow up on interview process",
  offer: "Respond to offer or clarify timeline",
  "not-applied": "Consider applying if interested",
  other: "Follow up or clarify next steps",
};

// Terminal statuses that are never flagged as stale.
const TERMINAL_STATUSES = new Set(["rejected", "withdrawn", "ghosted"]);

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  // Basic ISO date validation (YYYY-MM-DD)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function daysBetween(fromDateStr, toDateStr) {
  const fromDate = parseDate(fromDateStr);
  const toDate = parseDate(toDateStr);
  if (!fromDate || !toDate) return null;
  const diffTime = toDate - fromDate;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getLastTouchDate(role) {
  // Prefer updatedAt if present, otherwise fall back to appliedAt.
  // Both are ISO date strings (YYYY-MM-DD).
  return role.updatedAt || (role.application && role.application.appliedAt);
}

function computeStaleness(role, thresholds, todayStr) {
  if (!todayStr) {
    todayStr = new Date().toISOString().split("T")[0];
  }

  const statusBucket = role.statusBucket;

  // Terminal statuses are never stale.
  if (TERMINAL_STATUSES.has(statusBucket)) {
    return {
      isStale: false,
      daysSinceTouch: null,
      suggestedNextAction: null,
    };
  }

  const lastTouchDate = getLastTouchDate(role);
  if (!lastTouchDate) {
    return {
      isStale: false,
      daysSinceTouch: null,
      suggestedNextAction: null,
    };
  }

  const daysSinceTouch = daysBetween(lastTouchDate, todayStr);
  if (daysSinceTouch === null) {
    return {
      isStale: false,
      daysSinceTouch: null,
      suggestedNextAction: null,
    };
  }

  // Get the threshold for this status bucket; default to 0 if not specified
  // (meaning any activity makes it stale).
  const threshold = thresholds[statusBucket] !== undefined ? thresholds[statusBucket] : 0;

  const isStale = daysSinceTouch >= threshold;
  const suggestedNextAction = isStale ? SUGGESTED_ACTIONS[statusBucket] || "Follow up" : null;

  return {
    isStale,
    daysSinceTouch,
    suggestedNextAction,
  };
}

module.exports = {
  computeStaleness,
  DEFAULT_THRESHOLDS,
  SUGGESTED_ACTIONS,
};
