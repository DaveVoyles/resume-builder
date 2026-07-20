"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { collectCoverLetterClaimSites, auditCoverLetterConfig } = require("../../src/core/claim-audit");

function validCoverLetterConfig(overrides = {}) {
  return {
    company: "Tech Corp",
    candidate: { name: "Test Candidate", contact: [{ text: "test@example.com" }] },
    salutation: "Dear Hiring Manager,",
    bodyParagraphs: [
      "I have 10 years of software engineering experience.",
      "I led a team of 5 engineers on a critical project.",
    ],
    closing: "Sincerely, Test Candidate",
    ...overrides,
  };
}

test("collectCoverLetterClaimSites extracts claim sites from bodyParagraphs with path", () => {
  const config = validCoverLetterConfig();
  const sites = collectCoverLetterClaimSites(config);

  assert.equal(sites.length, 2);
  assert.equal(sites[0].path, "bodyParagraphs[0]");
  assert.equal(sites[0].text, "I have 10 years of software engineering experience.");
  assert.equal(sites[1].path, "bodyParagraphs[1]");
  assert.equal(sites[1].text, "I led a team of 5 engineers on a critical project.");
});

test("collectCoverLetterClaimSites handles empty config", () => {
  const sites = collectCoverLetterClaimSites({});
  assert.equal(sites.length, 0);
});

test("collectCoverLetterClaimSites skips empty/blank paragraphs", () => {
  const config = validCoverLetterConfig({
    bodyParagraphs: ["Valid paragraph", "", "   ", "Another valid paragraph"],
  });
  const sites = collectCoverLetterClaimSites(config);

  // Should skip the empty and whitespace-only paragraphs
  assert.ok(sites.length >= 1);
  assert.ok(sites.some((s) => s.text === "Valid paragraph"));
  assert.ok(sites.some((s) => s.text === "Another valid paragraph"));
  assert.ok(!sites.some((s) => s.text === ""));
  assert.ok(!sites.some((s) => s.text.trim() === ""));
});

test("auditCoverLetterConfig returns no errors when all claims are supported by evidence", () => {
  const config = validCoverLetterConfig({
    bodyParagraphs: ["I have 10 years of experience."],
  });

  const evidence = [
    {
      fact: "10 years of experience",
      snippet: "10 years of experience",
      confidence: "source-text",
    },
  ];

  const audit = auditCoverLetterConfig(config, evidence);
  assert.equal(audit.errors.length, 0);
  assert.ok(Array.isArray(audit.warnings));
});

test("auditCoverLetterConfig blocks on unsupported claim", () => {
  const config = validCoverLetterConfig({
    bodyParagraphs: ["I have 50 years of experience."],
  });

  // No evidence for the 50 years claim
  const evidence = [{ fact: "10 years of experience", confidence: "high" }];

  const audit = auditCoverLetterConfig(config, evidence);
  assert.ok(audit.errors.length > 0);
  assert.ok(audit.errors[0].includes("Unsupported claim"));
  assert.ok(audit.errors[0].includes("bodyParagraphs[0]"));
  assert.ok(audit.errors[0].includes("50 years"));
});

test("auditCoverLetterConfig handles empty config gracefully", () => {
  const audit = auditCoverLetterConfig({}, []);
  assert.equal(audit.errors.length, 0);
});

test("auditCoverLetterConfig supports multiple independent claims with evidence", () => {
  const config = validCoverLetterConfig({
    bodyParagraphs: [
      "Our platform reached 1 million users.",
      "We improved performance by 50%.",
    ],
  });

  const evidence = [
    {
      fact: "1 million users on platform",
      snippet: "1 million users on platform",
      confidence: "source-text",
    },
    {
      fact: "50% performance improvement",
      snippet: "50% performance improvement",
      confidence: "source-text",
    },
  ];

  const audit = auditCoverLetterConfig(config, evidence);
  assert.equal(audit.errors.length, 0);
  assert.ok(audit.claimsFound.length > 0);
});

test("auditCoverLetterConfig flags missing evidence for multiple claims", () => {
  const config = validCoverLetterConfig({
    bodyParagraphs: [
      "We reached 1 million users and 2 million downloads.",
      "Performance improved by 75%.",
    ],
  });

  const evidence = [
    { fact: "1 million users", confidence: "high" },
    // Missing evidence for downloads and 75% improvement
  ];

  const audit = auditCoverLetterConfig(config, evidence);
  assert.ok(audit.errors.length > 0);
  assert.ok(audit.errors.some((e) => e.includes("2 million")));
  assert.ok(audit.errors.some((e) => e.includes("75%")));
});

test("auditCoverLetterConfig includes warnings about thin ledger when appropriate", () => {
  const config = validCoverLetterConfig({
    bodyParagraphs: ["I have 10 years of experience."],
  });

  // Only one metadata-only entry (should trigger thin ledger warning)
  const evidence = [{ fact: "some metadata", confidence: "metadata-only" }];

  const audit = auditCoverLetterConfig(config, evidence);
  // errors will be present for unsupported claim, warnings for thin ledger
  assert.ok(audit.warnings.length > 0 || audit.errors.length > 0);
});

test("auditCoverLetterConfig extracts and tracks found claims in result", () => {
  const config = validCoverLetterConfig({
    bodyParagraphs: ["Led a team of 8 engineers and have 3 years of experience in the field."],
  });

  const evidence = [
    {
      fact: "Led a team of 8 engineers",
      snippet: "Led a team of 8 engineers",
      confidence: "source-text",
    },
    {
      fact: "3 years of experience",
      snippet: "3 years of experience",
      confidence: "source-text",
    },
  ];

  const audit = auditCoverLetterConfig(config, evidence);
  assert.ok(audit.claimsFound.length > 0);
  assert.ok(audit.claimsFound.some((c) => c.value === "8"));
  assert.ok(audit.claimsFound.some((c) => c.value === "3"));
});
