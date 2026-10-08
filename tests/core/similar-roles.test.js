"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { buildDiscovery, scoreCandidate } = require("../../src/core/similar-roles");

describe("buildDiscovery compensation context", () => {
  test("exposes both a base-salary floor and a total-comp floor when both are set", () => {
    const preferences = {
      compensation: {
        currency: "USD",
        baseMinimum: 160000,
        totalMinimum: 250000,
        totalTarget: 300000,
      },
    };

    const { context } = buildDiscovery([], preferences, [], []);

    assert.equal(context.compensationMinimum, 160000);
    assert.equal(context.compensationTotalMinimum, 250000);
  });

  test("leaves the total-comp floor undefined when the candidate only gave a base floor", () => {
    const preferences = {
      compensation: {
        currency: "USD",
        baseMinimum: 160000,
      },
    };

    const { context } = buildDiscovery([], preferences, [], []);

    assert.equal(context.compensationMinimum, 160000);
    assert.equal(context.compensationTotalMinimum, undefined);
  });

  test("exposes only a total-comp floor when the candidate framed their answer entirely in total-comp terms (the primary motivating case for #102)", () => {
    const preferences = {
      compensation: {
        currency: "USD",
        totalMinimum: 250000,
        totalTarget: 300000,
      },
    };

    const { context } = buildDiscovery([], preferences, [], []);

    assert.equal(context.compensationMinimum, undefined);
    assert.equal(context.compensationTotalMinimum, 250000);
  });

  test("does not throw when preferences.compensation is entirely absent", () => {
    const { context } = buildDiscovery([], {}, [], []);

    assert.equal(context.compensationMinimum, undefined);
    assert.equal(context.compensationTotalMinimum, undefined);
  });
});

function scoreWorkMode(preferredModes, jobWorkMode) {
  return scoreCandidate(
    {
      company: "Acme",
      title: "Operations manager",
      workMode: jobWorkMode,
    },
    {
      keywords: [],
      phrases: [],
      seniority: [],
      employmentTypes: [],
      workModes: preferredModes,
      avoided: [],
    },
  );
}

function hasWorkModeMismatch(result) {
  return result.fit.risks.some((risk) => risk.startsWith("Work mode differs from preferences"));
}

describe("scoreCandidate work modes", () => {
  test("flexible matches remote, hybrid, and on-site with no work-mode penalty", () => {
    for (const jobWorkMode of ["remote", "hybrid", "on-site"]) {
      const flexible = scoreWorkMode(["flexible"], jobWorkMode);
      const empty = scoreWorkMode([], jobWorkMode);
      assert.equal(hasWorkModeMismatch(flexible), false);
      assert.equal(hasWorkModeMismatch(empty), false);
      assert.ok(flexible.fit.score >= empty.fit.score);
    }
  });

  test("exact non-matching work mode still gets the penalty and reason", () => {
    const mismatched = scoreWorkMode(["remote"], "on-site");
    const empty = scoreWorkMode([], "on-site");
    assert.ok(mismatched.fit.risks.includes("Work mode differs from preferences: on-site."));
    assert.ok(mismatched.fit.score < empty.fit.score);
  });
});
