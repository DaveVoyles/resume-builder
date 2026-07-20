"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderHtmlTracker } = require("../../src/renderers/html-tracker");

// Tests for the HTML tracker renderer, including the Cover Letter column.

test("html tracker renders a table with all columns including Cover Letter", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      location: "Remote",
      compensation: { minimum: 150000, maximum: 200000, currency: "USD" },
      fit: { level: "High", rationale: "Great fit" },
      application: { status: "applied", appliedAt: "2026-07-01" },
      urls: { job: "https://jobs.example.com/fabrikam/pm", apply: "https://apply.example.com" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      coverLetter: { status: "review-needed" },
      notes: ["Test note"],
    },
  ];

  const output = renderHtmlTracker(roles);

  // Check that the HTML includes the Cover Letter header
  assert.match(output, /<th>Cover Letter<\/th>/);

  // Check that the data includes the cover letter status
  assert.match(output, /review-needed/);

  // Check that the script data includes coverLetterStatus
  assert.match(output, /"coverLetterStatus": "review-needed"/);
});

test("html tracker shows empty dash for missing Cover Letter status", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      location: "Remote",
      application: { status: "interested" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      // No coverLetter field
    },
  ];

  const output = renderHtmlTracker(roles);

  // The script data should include empty string for missing cover letter status
  assert.match(output, /"coverLetterStatus": ""/);

  // The JavaScript code should handle the empty status by showing a dash
  assert.match(output, /esc\(role\.coverLetterStatus \|\| "—"\)/);
});

test("html tracker HTML-escapes special characters in Cover Letter status when rendering", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      location: "Remote",
      application: { status: "interested" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      coverLetter: { status: "review & needed <urgently>" },
    },
  ];

  const output = renderHtmlTracker(roles);

  // The JSON data should contain the raw status (not escaped)
  assert.match(output, /"coverLetterStatus": "review & needed <urgently>"/);

  // When rendered as HTML, it should be escaped in the <td> cell
  assert.match(output, /esc\(role\.coverLetterStatus \|\| "—"\)/);
});

test("html tracker renders empty list correctly with Cover Letter header", () => {
  const output = renderHtmlTracker([]);

  assert.match(output, /<th>Cover Letter<\/th>/);
  assert.match(output, /No roles match your search\/filter/);
});

test("html tracker includes coverLetterStatus in rowsData object", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      location: "Remote",
      application: { status: "applied", appliedAt: "2026-07-01" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      coverLetter: { status: "submitted" },
    },
  ];

  const output = renderHtmlTracker(roles);

  // The JSON data embedded in the script should have the coverLetterStatus field
  assert.match(output, /"coverLetterStatus": "submitted"/);
});
