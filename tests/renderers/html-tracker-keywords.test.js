"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderHtmlTracker } = require("../../src/renderers/html-tracker");

function role(resume) {
  return {
    id: "r1",
    company: "Example Co",
    title: "Operations manager",
    application: { status: "interested" },
    resume,
  };
}

test("tracker row data carries the saved keyword score and missing count", () => {
  const html = renderHtmlTracker([role({ outputPath: "outputs/resumes/x.docx", keywordCoverage: { score: 72, missing: [{ keyword: "a" }, { keyword: "b" }] } })]);
  assert.match(html, /"keywordScore": 72/u);
  assert.match(html, /"keywordMissing": 2/u);
  assert.match(html, /Keywords ' \+ esc\(String\(role\.keywordScore\)\)/u);
});

test("tracker row data has no keyword score for roles without saved coverage", () => {
  const html = renderHtmlTracker([role({ outputPath: "outputs/resumes/x.docx" })]);
  assert.match(html, /"keywordScore": null/u);
});
