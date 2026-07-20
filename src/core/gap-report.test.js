"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateGapClassifications } = require("./gap-report");

test("gap-report schema validation: accepts valid gap classifications", () => {
  const validInput = [
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "Mentioned in one project, but no production deployment experience shown",
      recommendedAction: "Add a concrete Kubernetes deployment story to experience section",
    },
    {
      keyword: "TypeScript",
      type: "PresentationGap",
      rationale: "Used extensively but not explicitly called out in summary or skills section",
      recommendedAction: "Add TypeScript to the top-level skills section",
    },
    {
      keyword: "Go",
      type: "TrueGap",
      rationale: "Not found in resume or experience. Required by job description",
      recommendedAction: "Consider adding a small Go project or learning objective to skills section",
    },
    {
      keyword: "Rust",
      type: "AdjacentSkill",
      rationale: "Systems programming background (C++) transfers well to Rust expectations",
      recommendedAction: "Highlight C++ experience; mention systems-programming foundation in cover letter",
    },
  ];

  const errors = validateGapClassifications(validInput);
  assert.strictEqual(errors.length, 0, "Expected no validation errors for valid input");
});

test("gap-report schema validation: requires array", () => {
  const errors = validateGapClassifications({ gaps: [] });
  assert.ok(errors.length > 0, "Expected validation error for non-array input");
  assert.match(errors[0], /must be an array/i);
});

test("gap-report schema validation: requires each gap to be an object", () => {
  const errors = validateGapClassifications([
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "test",
      recommendedAction: "test",
    },
    "not an object",
  ]);
  assert.ok(errors.length > 0, "Expected validation error for non-object gap");
  assert.match(errors[0], /gap line 2.*object/i);
});

test("gap-report schema validation: requires keyword string", () => {
  const errors = validateGapClassifications([
    {
      type: "WeakEvidence",
      rationale: "test",
      recommendedAction: "test",
    },
  ]);
  assert.ok(errors.length > 0, "Expected validation error for missing keyword");
  assert.match(errors[0], /keyword/i);
});

test("gap-report schema validation: rejects empty keyword string", () => {
  const errors = validateGapClassifications([
    {
      keyword: "  ",
      type: "WeakEvidence",
      rationale: "test",
      recommendedAction: "test",
    },
  ]);
  assert.ok(errors.length > 0, "Expected validation error for empty keyword");
  assert.match(errors[0], /keyword/i);
});

test("gap-report schema validation: requires type field", () => {
  const errors = validateGapClassifications([
    {
      keyword: "Kubernetes",
      rationale: "test",
      recommendedAction: "test",
    },
  ]);
  assert.ok(errors.length > 0, "Expected validation error for missing type");
  assert.match(errors[0], /type/i);
});

test("gap-report schema validation: validates type is one of allowed values", () => {
  const errors = validateGapClassifications([
    {
      keyword: "Kubernetes",
      type: "InvalidType",
      rationale: "test",
      recommendedAction: "test",
    },
  ]);
  assert.ok(errors.length > 0, "Expected validation error for invalid type");
  assert.match(errors[0], /InvalidType.*PresentationGap.*WeakEvidence.*AdjacentSkill.*TrueGap/i);
});

test("gap-report schema validation: requires rationale string", () => {
  const errors = validateGapClassifications([
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      recommendedAction: "test",
    },
  ]);
  assert.ok(errors.length > 0, "Expected validation error for missing rationale");
  assert.match(errors[0], /rationale/i);
});

test("gap-report schema validation: rejects empty rationale string", () => {
  const errors = validateGapClassifications([
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "   ",
      recommendedAction: "test",
    },
  ]);
  assert.ok(errors.length > 0, "Expected validation error for empty rationale");
  assert.match(errors[0], /rationale/i);
});

test("gap-report schema validation: requires recommendedAction string", () => {
  const errors = validateGapClassifications([
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "test",
    },
  ]);
  assert.ok(errors.length > 0, "Expected validation error for missing recommendedAction");
  assert.match(errors[0], /recommendedAction/i);
});

test("gap-report schema validation: rejects empty recommendedAction string", () => {
  const errors = validateGapClassifications([
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "test",
      recommendedAction: "  ",
    },
  ]);
  assert.ok(errors.length > 0, "Expected validation error for empty recommendedAction");
  assert.match(errors[0], /recommendedAction/i);
});

test("gap-report schema validation: reports multiple errors with line numbers", () => {
  const errors = validateGapClassifications([
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "test",
      // missing recommendedAction
    },
    {
      // missing keyword
      type: "WeakEvidence",
      rationale: "test",
      recommendedAction: "test",
    },
  ]);
  assert.ok(errors.length >= 2, "Expected multiple validation errors");
  assert.ok(errors.some((e) => e.includes("line 1") || e.includes("recommendedAction")));
  assert.ok(errors.some((e) => e.includes("line 2") || e.includes("keyword")));
});

test("gap-report schema validation: handles all four gap types", () => {
  const gapTypes = ["PresentationGap", "WeakEvidence", "AdjacentSkill", "TrueGap"];
  for (const type of gapTypes) {
    const errors = validateGapClassifications([
      {
        keyword: "Test",
        type,
        rationale: "Test rationale",
        recommendedAction: "Test action",
      },
    ]);
    assert.strictEqual(errors.length, 0, `Expected no errors for valid type "${type}"`);
  }
});

test("gap-report schema validation: allows empty array (no gaps)", () => {
  const errors = validateGapClassifications([]);
  assert.strictEqual(errors.length, 0, "Expected no errors for empty array");
});
