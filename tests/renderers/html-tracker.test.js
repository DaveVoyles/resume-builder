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
  assert.match(output, /<th.*?data-sortable=["']coverLetterStatus["'].*?>Cover Letter<\/th>/i);

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

  assert.match(output, /<th.*?data-sortable=["']coverLetterStatus["'].*?>Cover Letter<\/th>/i);
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

test("html tracker renders a pipeline funnel section with stage counts", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "PM",
      application: { status: "interested" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-002",
      company: "TechCorp",
      title: "Engineer",
      application: { status: "applied", appliedAt: "2026-07-15" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-003",
      company: "StartupXYZ",
      title: "Lead",
      application: { status: "interview", appliedAt: "2026-07-10" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-004",
      company: "BigCorp",
      title: "Manager",
      application: { status: "offer", appliedAt: "2026-07-08" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-005",
      company: "NopeInc",
      title: "Rejected",
      application: { status: "rejected", appliedAt: "2026-07-01" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-006",
      company: "WithdrawnLLC",
      title: "Withdrawn",
      application: { status: "withdrawn", appliedAt: "2026-07-02" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-007",
      company: "GhostedCo",
      title: "Ghosted",
      application: { status: "ghosted", appliedAt: "2026-06-15" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
  ];

  const output = renderHtmlTracker(roles);

  // Check that the funnel section exists and contains stage counts
  assert.match(output, /<.*class=["']funnel/i);

  // Check for stage counts (not-applied, applied, interview, offer, rejected, withdrawn, ghosted)
  // Use regex that matches the funnel div structure
  assert.match(output, /funnel-stage.*?Not Applied[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Applied[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Interview[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Offer[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Rejected[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Withdrawn[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Ghosted[\s\S]*?funnel-count.*?>1</i);
});

test("html tracker displays stale badges for old applications", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "applied", appliedAt: "2026-07-01" }, // 19 days old (threshold: 14)
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderHtmlTracker(roles, {
    stalenessThresholds: { applied: 14, interview: 7, offer: 3, "not-applied": 30, other: 21 },
  });

  // Check for stale badge markup in the embedded JSON
  assert.match(output, /"isStale":\s*true/);
  assert.match(output, /"daysSinceTouch":\s*\d+/);
  assert.match(output, /"suggestedNextAction":\s*"Follow up on application status"/);
});

test("html tracker shows no stale badge for recent applications", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "applied", appliedAt: "2026-07-15" }, // 5 days old (threshold: 14)
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderHtmlTracker(roles, {
    stalenessThresholds: { applied: 14, interview: 7, offer: 3, "not-applied": 30, other: 21 },
  });

  // Check for non-stale status in embedded JSON
  assert.match(output, /"isStale":\s*false/);
  assert.match(output, /"daysSinceTouch":\s*\d+/);
  assert.match(output, /"suggestedNextAction":\s*null/);
});

test("html tracker never marks terminal statuses as stale", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "ghosted", appliedAt: "2026-07-01" }, // 19 days old, but ghosted
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderHtmlTracker(roles, {
    stalenessThresholds: { applied: 14, interview: 7, offer: 3, "not-applied": 30, other: 21 },
  });

  // Even though it's old, ghosted should never be marked stale
  assert.match(output, /"isStale":\s*false/);
  assert.match(output, /"suggestedNextAction":\s*null/);
});

test("html tracker includes Stale filter button", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "applied", appliedAt: "2026-07-01" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderHtmlTracker(roles);

  // Check for the Stale filter button
  assert.match(output, /data-filter="stale"/i);
});

test("html tracker table has sortable stale column with data attributes", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "applied", appliedAt: "2026-07-01" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderHtmlTracker(roles, {
    stalenessThresholds: { applied: 14, interview: 7, offer: 3, "not-applied": 30, other: 21 },
  });

  // Check for a Stale column in the table with sortable attribute
  assert.match(output, /<th.*?data-sortable=["']stale["'].*?>Stale<\/th>/i);

  // Check that stale row data is included
  assert.match(output, /"isStale":/);
  assert.match(output, /"daysSinceTouch":/);
  assert.match(output, /"suggestedNextAction":/);
});
