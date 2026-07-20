"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Packer } = require("docx");
const { renderResumeConfig } = require("../../src/renderers/docx-resume");
const { readDocxText } = require("../helpers/read-docx-text");
const fs = require("fs");
const os = require("os");
const path = require("path");

function fictionalConfig(overrides = {}) {
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
    summary: { text: "Fictional product leader focused on fictional developer workflows." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Fictional Engineer",
            company: "Northwind Widgets",
            dates: "2022 - Present",
            bullets: ["Led a fictional cross-team launch.", "Shipped a fictional platform migration."],
          },
        ],
      },
    ],
    skills: [["Languages", "JavaScript, Python"]],
    ...overrides,
  };
}

test("renderResumeConfig throws a DataError-style message for an invalid config", () => {
  assert.throws(() => renderResumeConfig({}), /Invalid resume config/);
});

test("renderResumeConfig produces a docx Document whose extracted text contains the config's own strings (golden render seam)", async () => {
  const config = fictionalConfig();
  const document = renderResumeConfig(config);
  const buffer = await Packer.toBuffer(document);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docx-resume-test-"));
  const outputPath = path.join(tmpDir, "golden.docx");
  fs.writeFileSync(outputPath, buffer);

  assert.ok(fs.existsSync(outputPath), "rendered docx file should exist at the expected path");

  const text = readDocxText(outputPath);
  assert.match(text, /Sample Candidate/);
  assert.match(text, /Fictional product leader focused on fictional developer workflows\./);
  assert.match(text, /Senior Fictional Engineer/);
  assert.match(text, /Northwind Widgets/);
  assert.match(text, /Led a fictional cross-team launch\./);
  assert.match(text, /JavaScript, Python/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("renderResumeConfig includes education, publications, and speaking sections only when provided", async () => {
  const config = fictionalConfig({
    education: [{ degree: "B.S. Fictional Studies", institution: "Example University", dates: "2010 - 2014" }],
    publications: [{ title: "A Fictional Whitepaper", publisher: "Fictional Press", dates: "2020" }],
  });
  const document = renderResumeConfig(config);
  const buffer = await Packer.toBuffer(document);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docx-resume-test-"));
  const outputPath = path.join(tmpDir, "sections.docx");
  fs.writeFileSync(outputPath, buffer);

  const text = readDocxText(outputPath);
  assert.match(text, /B\.S\. Fictional Studies/);
  assert.match(text, /Example University/);
  assert.match(text, /A Fictional Whitepaper/);
  assert.doesNotMatch(text, /Speaking/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("renderResumeConfig applies summary.fitOverride when present", async () => {
  const config = fictionalConfig({
    summary: {
      text: "Strong fit for developer platform roles.",
      fitOverride: "Exceptional fit for this fictional Acme Corp role.",
    },
  });
  const document = renderResumeConfig(config);
  const buffer = await Packer.toBuffer(document);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docx-resume-test-"));
  const outputPath = path.join(tmpDir, "fit-override.docx");
  fs.writeFileSync(outputPath, buffer);

  const text = readDocxText(outputPath);
  assert.match(text, /Exceptional fit for this fictional Acme Corp role\./);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
