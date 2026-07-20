"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateCoverLetterConfig } = require("../../src/core/cover-letter-config");

function validConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Acme Corp",
    candidate: {
      name: "Sample Candidate",
      contact: [
        { text: "Remote, US" },
        { text: "sample@example.invalid", link: "mailto:sample@example.invalid" },
      ],
    },
    salutation: "Dear Hiring Manager,",
    bodyParagraphs: [
      "I am writing to express my interest in the role at Acme Corp.",
      "My experience aligns well with your needs.",
    ],
    closing: "Sincerely, Sample Candidate",
    ...overrides,
  };
}

test("validateCoverLetterConfig rejects non-object input", () => {
  const result = validateCoverLetterConfig("not an object");
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /must be an object/);
});

test("validateCoverLetterConfig rejects invalid schemaVersion", () => {
  const result = validateCoverLetterConfig(validConfig({ schemaVersion: "2.0" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('must be "1.0"')));
});

test("validateCoverLetterConfig accepts optional schemaVersion when 1.0", () => {
  const result = validateCoverLetterConfig(validConfig());
  assert.equal(result.valid, true);
});

test("validateCoverLetterConfig accepts config without schemaVersion", () => {
  const config = validConfig();
  delete config.schemaVersion;
  const result = validateCoverLetterConfig(config);
  assert.equal(result.valid, true);
});

test("validateCoverLetterConfig requires company", () => {
  const result = validateCoverLetterConfig(validConfig({ company: "" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("company: required")));
});

test("validateCoverLetterConfig requires candidate object", () => {
  const result = validateCoverLetterConfig(validConfig({ candidate: null }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("candidate: required object")));
});

test("validateCoverLetterConfig requires candidate.name", () => {
  const result = validateCoverLetterConfig(validConfig({ candidate: { name: "", contact: [] } }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("candidate.name: required")));
});

test("validateCoverLetterConfig requires candidate.contact as non-empty array", () => {
  const result = validateCoverLetterConfig(validConfig({ candidate: { name: "Test", contact: [] } }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("candidate.contact: required non-empty array")));
});

test("validateCoverLetterConfig rejects a non-object contact entry", () => {
  const result = validateCoverLetterConfig(
    validConfig({
      candidate: { name: "Test", contact: ["not-an-object"] },
    })
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("candidate.contact[0]: must be an object")));
});

test("validateCoverLetterConfig requires contact entries to have text field", () => {
  const result = validateCoverLetterConfig(
    validConfig({
      candidate: { name: "Test", contact: [{ text: "", link: "http://example.com" }] },
    })
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("candidate.contact[0].text: required")));
});

test("validateCoverLetterConfig accepts contact entries with optional link", () => {
  const result = validateCoverLetterConfig(
    validConfig({
      candidate: {
        name: "Test",
        contact: [{ text: "email@example.com", link: "mailto:email@example.com" }, { text: "No link here" }],
      },
    })
  );
  assert.equal(result.valid, true);
});

test("validateCoverLetterConfig rejects contact link that is not a string", () => {
  const result = validateCoverLetterConfig(
    validConfig({
      candidate: { name: "Test", contact: [{ text: "email", link: 123 }] },
    })
  );
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("candidate.contact[0].link: must be a non-empty string")));
});

test("validateCoverLetterConfig requires salutation", () => {
  const result = validateCoverLetterConfig(validConfig({ salutation: "" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("salutation: required")));
});

test("validateCoverLetterConfig requires bodyParagraphs as non-empty array", () => {
  const result = validateCoverLetterConfig(validConfig({ bodyParagraphs: [] }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("bodyParagraphs: required non-empty array")));
});

test("validateCoverLetterConfig requires each bodyParagraph to be non-empty string", () => {
  const result = validateCoverLetterConfig(validConfig({ bodyParagraphs: ["Valid paragraph", ""] }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("bodyParagraphs: every entry must be a non-empty string")));
});

test("validateCoverLetterConfig requires closing", () => {
  const result = validateCoverLetterConfig(validConfig({ closing: "" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("closing: required")));
});

test("validateCoverLetterConfig returns valid=true for a complete valid config", () => {
  const result = validateCoverLetterConfig(validConfig());
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validateCoverLetterConfig accumulates multiple errors", () => {
  const result = validateCoverLetterConfig({
    company: "",
    salutation: "",
    closing: "",
    bodyParagraphs: [],
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 1);
});
