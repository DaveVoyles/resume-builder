"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { DRAFT_FILENAME, writeFirstDraft } = require("../../src/core/first-draft");

function tempOutput() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-draft-"));
}

test("writeFirstDraft writes a stub draft that includes the required goal", () => {
  const outputDir = tempOutput();
  try {
    const result = writeFirstDraft({
      outputDir,
      answers: {
        name: "Jordan Sample",
        location: "Philadelphia, PA",
        goal: "Operations manager at a mid-size healthcare company",
        history: "Office Manager, Riverside Dental — 2019 to now",
      },
    });
    assert.equal(result.filename, DRAFT_FILENAME);
    const text = fs.readFileSync(result.filePath, "utf8");
    assert.match(text, /STUB FIRST DRAFT/);
    assert.match(text, /Goal: Operations manager at a mid-size healthcare company/);
    assert.match(text, /Name: Jordan Sample/);
    assert.match(text, /Riverside Dental/);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeFirstDraft rejects a missing or blank goal", () => {
  const outputDir = tempOutput();
  try {
    assert.throws(() => writeFirstDraft({ outputDir, answers: {} }), { code: "GOAL_REQUIRED" });
    assert.throws(() => writeFirstDraft({ outputDir, answers: { goal: "   " } }), { code: "GOAL_REQUIRED" });
    assert.equal(fs.existsSync(path.join(outputDir, DRAFT_FILENAME)), false);
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
