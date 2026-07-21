"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { buildDiscovery } = require("../../src/core/similar-roles");

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
