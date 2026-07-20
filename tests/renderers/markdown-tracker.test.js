"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderTracker } = require("../../src/renderers/markdown-tracker");

// Tests for the markdown tracker renderer, including the Cover Letter column.

test("markdown tracker renders a table with all columns including Cover Letter and Stale", () => {
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

  // Check that the header includes the Stale column
  assert.match(output, /Company.*Role.*Location.*Compensation.*Fit.*Applied.*Job URL.*Apply URL.*Resume.*Cover Letter.*Stale.*Notes/);

  // Check that separator row has the correct number of columns (12 now)
  assert.match(output, /\| --- \| --- \| --- \| --- \| --- \| --- \| --- \| --- \| --- \| --- \| --- \| --- \|/);

  // Check that the data row contains the cover letter status
  assert.match(output, /review-needed/);
});

test("markdown tracker shows empty/dash for missing Cover Letter status and Stale", () => {
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

  // The row should have dashes for the missing cover letter status and stale info
  // The normalizeRole function will return null for coverLetterStatus, which gets rendered as "—"
  assert.match(output, /\| Fabrikam AI \| Product Manager \| — \| — \| — \| Interested \| — \| — \| outputs\/resumes\/fabrikam-ai\.docx \| — \| — \| — \|/);
});

test("markdown tracker escapes pipes in values for Cover Letter and Stale columns", () => {
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
  assert.match(output, /Stale/);
});

test("markdown tracker displays stale flag for old applications", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "applied", appliedAt: "2026-07-01" }, // 19+ days old (threshold: 14)
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const today = "2026-07-20";
  const output = renderTracker(roles, { stalenessThresholds: { applied: 14 } });

  // Should show stale info: "Stale (19d) — Follow up on application status"
  assert.match(output, /Stale \(\d+d\) — Follow up on application status/);
});

test("markdown tracker shows dash for non-stale applications", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "applied", appliedAt: "2026-07-15" }, // 5 days old (threshold: 14)
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderTracker(roles, { stalenessThresholds: { applied: 14 } });

  // Should not show stale info in the data row (only in header)
  assert.match(output, /Fabrikam AI \| Product Manager \| — \| — \| — \| Applied 2026-07-15 \| — \| — \| outputs\/resumes\/fabrikam-ai\.docx \| — \| — \| — \|/);
});

test("markdown tracker never marks terminal statuses as stale", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "rejected", appliedAt: "2026-07-01" }, // 19 days old, but rejected
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderTracker(roles, { stalenessThresholds: { applied: 14 } });

  // Should not show stale info for rejected status (Stale column should be empty dash)
  assert.match(output, /Fabrikam AI \| Product Manager \| — \| — \| — \| Rejected 2026-07-01 \| — \| — \| outputs\/resumes\/fabrikam-ai\.docx \| — \| — \| — \|/);
});
