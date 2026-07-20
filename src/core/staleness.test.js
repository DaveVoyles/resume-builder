"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { computeStaleness, DEFAULT_THRESHOLDS } = require("./staleness");

test("computeStaleness: returns not stale when no last-touch date available", () => {
  const role = { id: "role-001", statusBucket: "applied" };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS);
  assert.strictEqual(result.isStale, false);
  assert.strictEqual(result.daysSinceTouch, null);
});

test("computeStaleness: returns not stale for terminal status rejected", () => {
  const role = {
    id: "role-001",
    statusBucket: "rejected",
    application: { appliedAt: "2026-07-01" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, false);
  assert.strictEqual(result.daysSinceTouch, null);
});

test("computeStaleness: returns not stale for terminal status withdrawn", () => {
  const role = {
    id: "role-001",
    statusBucket: "withdrawn",
    application: { appliedAt: "2026-07-01" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, false);
  assert.strictEqual(result.daysSinceTouch, null);
});

test("computeStaleness: returns not stale for terminal status ghosted", () => {
  const role = {
    id: "role-001",
    statusBucket: "ghosted",
    application: { appliedAt: "2026-07-01" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, false);
  assert.strictEqual(result.daysSinceTouch, null);
});

test("computeStaleness: applied bucket, exactly on threshold, is stale", () => {
  // applied threshold is 14 days. If applied 14 days ago, should be stale.
  const role = {
    id: "role-001",
    statusBucket: "applied",
    application: { appliedAt: "2026-07-06" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.daysSinceTouch, 14);
  assert.match(result.suggestedNextAction, /follow.?up/i);
});

test("computeStaleness: applied bucket, one day before threshold, is not stale", () => {
  // 13 days ago
  const role = {
    id: "role-001",
    statusBucket: "applied",
    application: { appliedAt: "2026-07-07" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, false);
  assert.strictEqual(result.daysSinceTouch, 13);
});

test("computeStaleness: applied bucket, one day past threshold, is stale", () => {
  // 15 days ago
  const role = {
    id: "role-001",
    statusBucket: "applied",
    application: { appliedAt: "2026-07-05" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.daysSinceTouch, 15);
});

test("computeStaleness: interview bucket, exactly on threshold, is stale", () => {
  // interview threshold is 7 days
  const role = {
    id: "role-001",
    statusBucket: "interview",
    application: { appliedAt: "2026-07-13" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.daysSinceTouch, 7);
});

test("computeStaleness: interview bucket, one day before threshold, is not stale", () => {
  // 6 days ago
  const role = {
    id: "role-001",
    statusBucket: "interview",
    application: { appliedAt: "2026-07-14" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, false);
  assert.strictEqual(result.daysSinceTouch, 6);
});

test("computeStaleness: offer bucket, exactly on threshold, is stale", () => {
  // offer threshold is 3 days
  const role = {
    id: "role-001",
    statusBucket: "offer",
    application: { appliedAt: "2026-07-17" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.daysSinceTouch, 3);
});

test("computeStaleness: not-applied bucket, exactly on threshold, is stale", () => {
  // not-applied threshold is 30 days
  const role = {
    id: "role-001",
    statusBucket: "not-applied",
    application: { appliedAt: "2026-06-20" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.daysSinceTouch, 30);
});

test("computeStaleness: other bucket, exactly on threshold, is stale", () => {
  // other threshold is 21 days
  const role = {
    id: "role-001",
    statusBucket: "other",
    application: { appliedAt: "2026-06-29" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.daysSinceTouch, 21);
});

test("computeStaleness: prefers updatedAt over appliedAt when both present", () => {
  // updatedAt is more recent, so daysSinceTouch should be based on it
  const role = {
    id: "role-001",
    statusBucket: "applied",
    application: { appliedAt: "2026-07-01" },
    updatedAt: "2026-07-18", // only 2 days ago
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, false); // 2 days is not stale (threshold is 14)
  assert.strictEqual(result.daysSinceTouch, 2);
});

test("computeStaleness: uses updatedAt if appliedAt is missing", () => {
  const role = {
    id: "role-001",
    statusBucket: "applied",
    updatedAt: "2026-07-06", // 14 days ago
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.daysSinceTouch, 14);
});

test("computeStaleness: with custom thresholds", () => {
  const customThresholds = { applied: 5 };
  const role = {
    id: "role-001",
    statusBucket: "applied",
    application: { appliedAt: "2026-07-15" }, // 5 days ago
  };
  const result = computeStaleness(role, customThresholds, "2026-07-20");
  assert.strictEqual(result.isStale, true);
  assert.strictEqual(result.daysSinceTouch, 5);
});

test("computeStaleness: suggested nextAction for applied status", () => {
  const role = {
    id: "role-001",
    statusBucket: "applied",
    application: { appliedAt: "2026-07-01" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.match(result.suggestedNextAction, /follow.?up/i);
});

test("computeStaleness: suggested nextAction for interview status", () => {
  const role = {
    id: "role-001",
    statusBucket: "interview",
    application: { appliedAt: "2026-07-10" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.match(result.suggestedNextAction, /follow.?up/i);
});

test("computeStaleness: suggested nextAction for offer status", () => {
  const role = {
    id: "role-001",
    statusBucket: "offer",
    application: { appliedAt: "2026-07-15" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.match(result.suggestedNextAction, /respond|decide/i);
});

test("computeStaleness: today's date is treated as day 0", () => {
  const role = {
    id: "role-001",
    statusBucket: "applied",
    application: { appliedAt: "2026-07-20" }, // same day
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, false);
  assert.strictEqual(result.daysSinceTouch, 0);
});

test("computeStaleness: malformed date falls back to not stale", () => {
  const role = {
    id: "role-001",
    statusBucket: "applied",
    application: { appliedAt: "not-a-date" },
  };
  const result = computeStaleness(role, DEFAULT_THRESHOLDS, "2026-07-20");
  assert.strictEqual(result.isStale, false);
  assert.strictEqual(result.daysSinceTouch, null);
});

test("computeStaleness: missing threshold for bucket defaults to 0 (always stale if has date)", () => {
  const customThresholds = {}; // no applied threshold
  const role = {
    id: "role-001",
    statusBucket: "applied",
    application: { appliedAt: "2026-07-19" }, // yesterday
  };
  const result = computeStaleness(role, customThresholds, "2026-07-20");
  assert.strictEqual(result.isStale, true); // default to 0, so any age is stale
  assert.strictEqual(result.daysSinceTouch, 1);
});

test("DEFAULT_THRESHOLDS has sensible values for all active buckets", () => {
  assert.strictEqual(DEFAULT_THRESHOLDS.applied, 14);
  assert.strictEqual(DEFAULT_THRESHOLDS.interview, 7);
  assert.strictEqual(DEFAULT_THRESHOLDS.offer, 3);
  assert.strictEqual(DEFAULT_THRESHOLDS["not-applied"], 30);
  assert.strictEqual(DEFAULT_THRESHOLDS.other, 21);
  // Terminal statuses should not appear in thresholds
});
