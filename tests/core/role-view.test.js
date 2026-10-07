"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { statusBucket, normalizeRole } = require("../../src/core/role-view");

test("statusBucket: a bare ISO date is applied", () => {
  assert.strictEqual(statusBucket("2026-06-08"), "applied");
  assert.strictEqual(statusBucket("  2026-06-08  "), "applied");
  assert.strictEqual(normalizeRole({ application: { appliedAt: "2026-06-08" } }).statusBucket, "applied");
});

test("statusBucket: first word Interview scheduled is interview, Applied via referral is applied", () => {
  assert.strictEqual(statusBucket("Interview scheduled"), "interview");
  assert.strictEqual(statusBucket("Applied via referral"), "applied");
});

test("statusBucket: Not applied is not Applied, Not yet is not-applied, Phone interview is other because interview is not the first word", () => {
  assert.strictEqual(statusBucket("Not applied"), "not-applied");
  assert.strictEqual(statusBucket("Not yet"), "not-applied");
  assert.strictEqual(statusBucket("Phone interview"), "other");
});
