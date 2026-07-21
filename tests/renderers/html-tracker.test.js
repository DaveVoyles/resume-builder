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

// #120 — the status badge previously showed a generic bucket label ("Not
// applied") with the raw free-text status ("Interested") stacked
// underneath in an unlabeled <small> line, reading as two unrelated pieces
// of information. The badge now shows the specific status text directly
// (it's always at least as informative as the bucket label), falling back
// to the bucket label only when there's no raw status text at all.
test("html tracker status badge shows the specific status text, not a disconnected bucket label + sub-line", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      location: "Remote",
      application: { status: "interested" },
    },
  ];

  const output = renderHtmlTracker(roles);

  // The row-data JSON still carries the raw applied text for the badge label to use.
  assert.match(output, /"applied": "Interested"/);
  // The old disconnected two-line markup (bucket label badge + unlabeled <small> raw text) is gone.
  assert.doesNotMatch(output, /<\/span><br><small>/);
  // The new label logic prefers the raw status text over the generic bucket label.
  assert.match(output, /let label = \(role\.applied \|\| ""\)\.trim\(\);/);
});

test("html tracker status badge falls back to the bucket label when there's no raw status text", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      location: "Remote",
      // No application/status/applied field at all.
    },
  ];

  const output = renderHtmlTracker(roles);

  // rowsData carries an empty applied string, so the client-side fallback to the bucket label applies.
  assert.match(output, /"applied": ""/);
  assert.match(output, /"statusBucket": "not-applied"/);
});

// #121 — scoped UI/UX improvements borrowed from a more polished reference dashboard.

test("html tracker marks a not-applied role with a rendered resume as ready to apply", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      // No application/status field — nothing to distinguish "ready" from "not started" except the resume.
    },
  ];

  const output = renderHtmlTracker(roles);

  assert.match(output, /"readyToApply": true/);
  assert.match(output, /data-filter="ready-to-apply"/);
});

test("html tracker does not mark a not-applied role without a resume as ready to apply", () => {
  const roles = [{ id: "role-001", company: "Fabrikam AI", title: "Product Manager" }];

  const output = renderHtmlTracker(roles);

  assert.match(output, /"readyToApply": false/);
});

test("html tracker splits the not-applied stat into Ready to apply and Not started, without double-counting", () => {
  const roles = [
    { id: "role-001", company: "Fabrikam AI", title: "PM", resume: { outputPath: "outputs/resumes/a.docx" } },
    { id: "role-002", company: "TechCorp", title: "Engineer" },
  ];

  const output = renderHtmlTracker(roles);

  assert.match(output, /<div class="stat-value">1<\/div><div class="stat-label">🎯 Ready to apply<\/div>/);
  assert.match(output, /<div class="stat-value">1<\/div><div class="stat-label">⏳ Not started<\/div>/);
  // The funnel's own "Not Applied" stage is untouched — it still reflects the full, undivided bucket count.
  assert.match(output, /funnel-stage">Not Applied<\/div><div class="funnel-count">2</);
});

test("html tracker shows an applied-funnel percentage stat", () => {
  const roles = [
    { id: "role-001", company: "A", title: "PM", application: { status: "applied", appliedAt: "2026-07-01" } },
    { id: "role-002", company: "B", title: "Eng" }, // not-applied
  ];

  const output = renderHtmlTracker(roles);

  // 1 of 2 roles reached "applied" (or beyond) → 50%.
  assert.match(output, /<div class="stat-value">50%<\/div><div class="stat-label">📈 Applied funnel<\/div>/);
});

test("html tracker renders a deterministic per-company color dot", () => {
  const output = renderHtmlTracker([{ id: "role-001", company: "Fabrikam AI", title: "PM" }]);

  assert.match(output, /function companyCell\(role\)/);
  assert.match(output, /class="company-dot"/);
});

test("html tracker renders location as a styled pill, colored by work mode", () => {
  const output = renderHtmlTracker([{ id: "role-001", company: "Fabrikam AI", title: "PM", location: "Remote" }]);

  assert.match(output, /function locationCell\(role\)/);
  assert.match(output, /loc-remote/);
});

test("html tracker renders the resume cell as a clickable link with the outputs\\/ prefix stripped", () => {
  const output = renderHtmlTracker([
    { id: "role-001", company: "Fabrikam AI", title: "PM", resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" } },
  ]);

  assert.match(output, /function resumeCell\(role\)/);
  // Strips the "outputs/" prefix so the link resolves relative to tracker.html's own location (inside outputs/).
  assert.match(output, /role\.resume\.replace\(\/\^outputs\\\/\/, ""\)/);
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
