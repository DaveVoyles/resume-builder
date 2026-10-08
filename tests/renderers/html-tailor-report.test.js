"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderHtmlTailorReport } = require("../../src/renderers/html-tailor-report");

// Fictional data only.
function model(overrides = {}) {
  return {
    title: "Operations <manager>",
    company: "Harborview & Co",
    status: "Ready to review",
    statusKind: "ready",
    date: "2026-10-08",
    resumeFile: "sample.docx",
    intro: "The resume is made and nothing has been sent.",
    blocked: false,
    changes: {
      hasBase: true,
      kind: "general",
      baselineLabel: "Your general resume",
      lines: [],
      keywordLines: [],
      diff: {
        summary: { type: "reworded", before: "Before text", after: "After <b>text</b>", why: { keywords: ["scheduling"], evidenceIds: [], sources: [] } },
        jobs: [{ label: "Office Manager at Riverside", items: [{ type: "reworded", before: "Old bullet", after: "New bullet by 20%", why: { keywords: [], evidenceIds: ["ev-1"], sources: ["notes.md"] } }, { type: "removed", before: "Dropped bullet" }] }],
        jobsAdded: [],
        jobsLeftOut: [],
        skills: null,
      },
    },
    lift: {
      kind: "general",
      label: "Your general resume",
      baseline: { covered: 2, total: 5, percent: 40 },
      tailored: { covered: 5, total: 5, percent: 100 },
      liftPoints: 60,
      gained: [{ keyword: "scheduling", where: "summary", supported: true, evidenceIds: [], sources: [] }, { keyword: "x\"y", where: "skills", supported: false, evidenceIds: [], sources: [] }],
      lost: [],
      stillMissing: [],
    },
    liftSentence: "Your general resume covers 2 of 5 keywords (40%). This resume covers 5 of 5 (100%).",
    coverage: { covered: [], missing: [], percent: 100, total: 5 },
    confirm: [],
    checks: [{ text: "Writing style: nothing stood out.", sub: [] }],
    fit: "Fits on 1 page.",
    notDone: [],
    gaps: [],
    ...overrides,
  };
}

test("renders a standalone page with before/after blocks and a coverage bar", () => {
  const html = renderHtmlTailorReport(model());
  assert.match(html, /^<!doctype html>/u);
  assert.match(html, /<meta name="viewport"/u);
  assert.match(html, /Your general resume covers 2 of 5 keywords \(40%\)/u);
  assert.match(html, /style="width:40%"/u);
  assert.match(html, /style="width:100%"/u);
  assert.match(html, /\+60 points/u);
  assert.match(html, /Backed by your note: notes\.md/u);
  assert.match(html, /class="chip chip-warn"/u);
  assert.match(html, /prefers-color-scheme: dark/u);
});

test("escapes all text and loads nothing external", () => {
  const html = renderHtmlTailorReport(model());
  assert.ok(!html.includes("<manager>"));
  assert.ok(!html.includes("<b>text</b>"));
  assert.match(html, /Operations &lt;manager&gt; at Harborview &amp; Co/u);
  assert.match(html, /x&quot;y/u);
  assert.doesNotMatch(html, /<script|<link|https?:\/\//u);
});

test("with no baseline it says there is nothing to compare, and a blocked report shows no coverage", () => {
  const none = renderHtmlTailorReport(model({ lift: null, changes: { hasBase: false, kind: "none", lines: [], keywordLines: ["roadmap: now in summary"], diff: null } }));
  assert.match(none, /nothing to compare yet/u);
  assert.match(none, /roadmap: now in summary/u);
  const blocked = renderHtmlTailorReport(model({ blocked: true, statusKind: "blocked", status: "Blocked", confirm: ["Where does \"500%\" come from?"] }));
  assert.match(blocked, /pill-blocked/u);
  assert.doesNotMatch(blocked, /Proof it was tailored/u);
  assert.match(blocked, /Where does &quot;500%&quot; come from\?/u);
});
