"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderTracker } = require("../../src/renderers/markdown-tracker");

// Tests for the markdown tracker renderer, including the Cover Letter column.

test("markdown tracker renders a table with all columns including Cover Letter", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      location: "Remote",
      compensation: "$150K-$200K",
      fit: "High",
      application: { status: "applied", appliedAt: "2026-07-01" },
      urls: { job: "https://jobs.example.com/fabrikam/pm", apply: "https://apply.example.com" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      coverLetter: { status: "review-needed" },
      notes: ["Test note"],
    },
  ];

  const output = renderTracker(roles);

  // Check that the header includes the Cover Letter column
  assert.match(output, /Company.*Role.*Location.*Compensation.*Fit.*Applied.*Job URL.*Apply URL.*Resume.*Cover Letter.*Notes/);

  // Check that separator row has the correct number of columns (11 now)
  assert.match(output, /\| --- \| --- \| --- \| --- \| --- \| --- \| --- \| --- \| --- \| --- \| --- \|/);

  // Check that the data row contains the cover letter status
  assert.match(output, /review-needed/);
});

test("markdown tracker shows empty/dash for missing Cover Letter status", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "interested" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      // No coverLetter field
    },
  ];

  const output = renderTracker(roles);

  // The row should have a dash for the missing cover letter status
  // The normalizeRole function will return null for coverLetterStatus, which gets rendered as "—"
  assert.match(output, /\| Fabrikam AI \| Product Manager \| — \| — \| — \| Interested \| — \| — \| outputs\/resumes\/fabrikam-ai\.docx \| — \| — \|/);
});

test("markdown tracker escapes pipes in values for Cover Letter column", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam | AI",
      title: "Product Manager",
      application: { status: "interested" },
      resume: { outputPath: "outputs/resumes/fabrikam.docx" },
      coverLetter: { status: "review | needed" },
    },
  ];

  const output = renderTracker(roles);

  // Pipes should be escaped with backslash
  assert.match(output, /Fabrikam \\\| AI/);
  assert.match(output, /review \\\| needed/);
});

test("markdown tracker renders empty list correctly", () => {
  const output = renderTracker([]);

  assert.match(output, /# Application Tracker/);
  assert.match(output, /No tracked roles yet/);
  assert.match(output, /Cover Letter/);
});
