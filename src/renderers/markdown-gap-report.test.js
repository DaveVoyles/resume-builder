"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderGapReport } = require("./markdown-gap-report");

test("markdown-gap-report: renders gap report with heading and intro", () => {
  const gaps = [
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "Mentioned in one project, but no production deployment experience",
      recommendedAction: "Add a concrete Kubernetes deployment story",
    },
  ];
  const roleTitle = "Senior Backend Engineer";
  const markdown = renderGapReport(gaps, roleTitle);

  assert.ok(markdown.includes(`# Gap Report: ${roleTitle}`), "Expected gap report title");
  assert.ok(markdown.includes("Gap classifications"), "Expected intro section");
});

test("markdown-gap-report: renders presentation gap", () => {
  const gaps = [
    {
      keyword: "TypeScript",
      type: "PresentationGap",
      rationale: "Used extensively but not explicitly called out",
      recommendedAction: "Add TypeScript to skills section",
    },
  ];
  const markdown = renderGapReport(gaps);

  assert.ok(markdown.includes("TypeScript"), "Expected keyword in output");
  assert.ok(markdown.includes("PresentationGap"), "Expected gap type in output");
  assert.ok(markdown.includes("Add TypeScript to skills section"), "Expected recommended action");
});

test("markdown-gap-report: renders weak evidence gap", () => {
  const gaps = [
    {
      keyword: "Docker",
      type: "WeakEvidence",
      rationale: "Mentioned once but lacking depth",
      recommendedAction: "Expand Docker experience with details",
    },
  ];
  const markdown = renderGapReport(gaps);

  assert.ok(markdown.includes("Docker"), "Expected keyword");
  assert.ok(markdown.includes("WeakEvidence"), "Expected gap type");
});

test("markdown-gap-report: renders adjacent skill gap", () => {
  const gaps = [
    {
      keyword: "Python",
      type: "AdjacentSkill",
      rationale: "JavaScript background transfers to Python",
      recommendedAction: "Mention scripting foundation in cover letter",
    },
  ];
  const markdown = renderGapReport(gaps);

  assert.ok(markdown.includes("Python"), "Expected keyword");
  assert.ok(markdown.includes("AdjacentSkill"), "Expected gap type");
});

test("markdown-gap-report: renders true gap", () => {
  const gaps = [
    {
      keyword: "Rust",
      type: "TrueGap",
      rationale: "Not found in resume or experience",
      recommendedAction: "Consider adding a small Rust project",
    },
  ];
  const markdown = renderGapReport(gaps);

  assert.ok(markdown.includes("Rust"), "Expected keyword");
  assert.ok(markdown.includes("TrueGap"), "Expected gap type");
});

test("markdown-gap-report: renders multiple gaps", () => {
  const gaps = [
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "Limited experience",
      recommendedAction: "Add deployment story",
    },
    {
      keyword: "TypeScript",
      type: "PresentationGap",
      rationale: "Not highlighted",
      recommendedAction: "Add to skills",
    },
    {
      keyword: "Go",
      type: "TrueGap",
      rationale: "Missing entirely",
      recommendedAction: "Learn or skip",
    },
  ];
  const markdown = renderGapReport(gaps);

  assert.ok(markdown.includes("Kubernetes"), "Expected first gap");
  assert.ok(markdown.includes("TypeScript"), "Expected second gap");
  assert.ok(markdown.includes("Go"), "Expected third gap");
});

test("markdown-gap-report: handles empty gaps list", () => {
  const markdown = renderGapReport([]);

  assert.ok(markdown.includes("# Gap Report"), "Expected heading");
  assert.ok(markdown.includes("No gaps"), "Expected message for empty list");
});

test("markdown-gap-report: includes rationale and recommended action", () => {
  const gaps = [
    {
      keyword: "Kubernetes",
      type: "WeakEvidence",
      rationale: "Mentioned in one project, but no production deployment experience shown",
      recommendedAction: "Add a concrete Kubernetes deployment story to experience section",
    },
  ];
  const markdown = renderGapReport(gaps);

  assert.ok(markdown.includes("Mentioned in one project"), "Expected rationale text");
  assert.ok(markdown.includes("Add a concrete Kubernetes"), "Expected recommended action text");
});

test("markdown-gap-report: returns markdown string", () => {
  const gaps = [
    {
      keyword: "Test",
      type: "PresentationGap",
      rationale: "Test",
      recommendedAction: "Test",
    },
  ];
  const markdown = renderGapReport(gaps);

  assert.strictEqual(typeof markdown, "string", "Expected markdown string return");
  assert.ok(markdown.length > 0, "Expected non-empty markdown");
});

test("markdown-gap-report: handles gaps with special characters", () => {
  const gaps = [
    {
      keyword: "C++",
      type: "PresentationGap",
      rationale: "C++ (systems programming) needs better showcase",
      recommendedAction: "Add C++ project | experience",
    },
  ];
  const markdown = renderGapReport(gaps);

  assert.ok(markdown.includes("C++"), "Expected keyword with special characters");
});

test("markdown-gap-report: accepts optional role title parameter", () => {
  const gaps = [
    {
      keyword: "Test",
      type: "PresentationGap",
      rationale: "Test",
      recommendedAction: "Test",
    },
  ];
  const roleTitle = "Director of Engineering";
  const markdown = renderGapReport(gaps, roleTitle);

  assert.ok(markdown.includes(roleTitle), "Expected custom role title in output");
});

test("markdown-gap-report: uses default role title when not provided", () => {
  const gaps = [
    {
      keyword: "Test",
      type: "PresentationGap",
      rationale: "Test",
      recommendedAction: "Test",
    },
  ];
  const markdown = renderGapReport(gaps);

  assert.ok(markdown.includes("# Gap Report"), "Expected heading with default title");
});
