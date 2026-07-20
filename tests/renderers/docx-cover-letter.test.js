"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Packer } = require("docx");
const { renderCoverLetterConfig } = require("../../src/renderers/docx-cover-letter");
const { readDocxText } = require("../helpers/read-docx-text");
const fs = require("fs");
const os = require("os");
const path = require("path");

function fictionalCoverLetterConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Acme Corp",
    candidate: {
      name: "Sample Candidate",
      contact: [
        { text: "Remote, US" },
        { text: "sample.candidate@example.invalid", link: "mailto:sample.candidate@example.invalid" },
      ],
    },
    salutation: "Dear Hiring Manager,",
    bodyParagraphs: [
      "I am writing to express my strong interest in the Software Engineer role at Acme Corp.",
      "With 5 years of experience in building scalable systems, I am confident I can make a meaningful contribution to your team.",
    ],
    closing: "Sincerely, Sample Candidate",
    ...overrides,
  };
}

async function renderToTmpFile(config, fileName) {
  const document = renderCoverLetterConfig(config);
  const buffer = await Packer.toBuffer(document);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docx-cover-letter-test-"));
  const outputPath = path.join(tmpDir, fileName);
  fs.writeFileSync(outputPath, buffer);
  return { tmpDir, outputPath };
}

async function withRenderedFile(config, fileName, fn) {
  const { tmpDir, outputPath } = await renderToTmpFile(config, fileName);
  try {
    await fn(outputPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test("renderCoverLetterConfig throws a DataError-style message for an invalid config", () => {
  assert.throws(() => renderCoverLetterConfig({}), /Invalid cover letter config/);
});

test("renderCoverLetterConfig produces a docx Document whose extracted text contains the config's own strings (golden render seam)", async () => {
  await withRenderedFile(fictionalCoverLetterConfig(), "golden.docx", (outputPath) => {
    assert.ok(fs.existsSync(outputPath), "rendered docx file should exist at the expected path");

    const text = readDocxText(outputPath);
    assert.match(text, /Sample Candidate/);
    assert.match(text, /Dear Hiring Manager,/);
    assert.match(text, /I am writing to express my strong interest in the Software Engineer role at Acme Corp\./);
    assert.match(text, /With 5 years of experience in building scalable systems/);
    assert.match(text, /Sincerely, Sample Candidate/);
  });
});

test("renderCoverLetterConfig renders header, salutation, body, and closing in order", async () => {
  const config = fictionalCoverLetterConfig();
  await withRenderedFile(config, "structure.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    // Verify the structure by checking that elements appear in expected order
    const nameIndex = text.indexOf("Sample Candidate");
    const salutationIndex = text.indexOf("Dear Hiring Manager,");
    const bodyIndex = text.indexOf("I am writing to express");
    const closingIndex = text.indexOf("Sincerely, Sample Candidate");

    assert.ok(nameIndex >= 0, "name should be present");
    assert.ok(salutationIndex > nameIndex, "salutation should come after name");
    assert.ok(bodyIndex > salutationIndex, "body should come after salutation");
    assert.ok(closingIndex > bodyIndex, "closing should come after body");
  });
});

test("renderCoverLetterConfig includes contact information", async () => {
  const config = fictionalCoverLetterConfig();
  await withRenderedFile(config, "contact.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    assert.match(text, /Remote, US/);
    assert.match(text, /sample\.candidate@example\.invalid/);
  });
});

test("renderCoverLetterConfig renders all body paragraphs", async () => {
  const config = fictionalCoverLetterConfig({
    bodyParagraphs: [
      "First paragraph of the cover letter.",
      "Second paragraph with more details.",
      "Third paragraph concluding the main points.",
    ],
  });
  await withRenderedFile(config, "paragraphs.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    assert.match(text, /First paragraph of the cover letter\./);
    assert.match(text, /Second paragraph with more details\./);
    assert.match(text, /Third paragraph concluding the main points\./);
  });
});

test("renderCoverLetterConfig does NOT include date or recipient address block", async () => {
  const config = fictionalCoverLetterConfig();
  await withRenderedFile(config, "no-date-or-address.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    // Verify no date-like pattern (e.g., "January 1, 2024" or similar)
    assert.doesNotMatch(text, /[A-Z][a-z]+\s+\d{1,2},\s+202\d/); // typical date format

    // The structure should be: name, contact, salutation, body, closing
    // No recipient address block (like "Hiring Manager, Acme Corp, ...")
    // before the salutation line
    const lines = text.split("\n").map((l) => l.trim());
    const salutationIdx = lines.findIndex((l) => l.startsWith("Dear Hiring"));
    assert.ok(salutationIdx >= 0, "salutation should be present");

    // Lines before salutation should only be name and contact, not recipient address
    // Recipient address would be multi-line, so we check for that pattern
    const beforeSalutation = lines.slice(0, salutationIdx);
    const expectedMaxLinesBefore = 2; // name line + contact line
    assert.ok(beforeSalutation.length <= expectedMaxLinesBefore + 1, "should have minimal content before salutation");
  });
});

test("renderCoverLetterConfig handles single body paragraph", async () => {
  const config = fictionalCoverLetterConfig({
    bodyParagraphs: ["This is a brief cover letter with just one paragraph."],
  });
  await withRenderedFile(config, "single-paragraph.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    assert.match(text, /This is a brief cover letter with just one paragraph\./);
  });
});

test("renderCoverLetterConfig handles multiple contact entries", async () => {
  const config = fictionalCoverLetterConfig({
    candidate: {
      name: "Multi Contact Person",
      contact: [
        { text: "San Francisco, CA" },
        { text: "person@example.com", link: "mailto:person@example.com" },
        { text: "linkedin.com/in/person", link: "https://linkedin.com/in/person" },
        { text: "(555) 123-4567" },
      ],
    },
  });
  await withRenderedFile(config, "multi-contact.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    assert.match(text, /San Francisco, CA/);
    assert.match(text, /person@example\.com/);
    assert.match(text, /linkedin\.com\/in\/person/);
    assert.match(text, /\(555\)\s*123-4567/);
  });
});
