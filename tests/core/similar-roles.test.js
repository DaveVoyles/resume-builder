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
});
