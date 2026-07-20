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

async function renderToTmpFile(config, fileName) {
  const document = renderResumeConfig(config);
  const buffer = await Packer.toBuffer(document);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docx-resume-test-"));
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

test("renderResumeConfig throws a DataError-style message for an invalid config", () => {
  assert.throws(() => renderResumeConfig({}), /Invalid resume config/);
});

test("renderResumeConfig produces a docx Document whose extracted text contains the config's own strings (golden render seam)", async () => {
  await withRenderedFile(fictionalConfig(), "golden.docx", (outputPath) => {
    assert.ok(fs.existsSync(outputPath), "rendered docx file should exist at the expected path");

    const text = readDocxText(outputPath);
    assert.match(text, /Sample Candidate/);
    assert.match(text, /Fictional product leader focused on fictional developer workflows\./);
    assert.match(text, /Senior Fictional Engineer/);
    assert.match(text, /Northwind Widgets/);
    assert.match(text, /Led a fictional cross-team launch\./);
    assert.match(text, /JavaScript, Python/);
  });
});

test("renderResumeConfig includes education, publications, and speaking sections only when provided", async () => {
  const config = fictionalConfig({
    education: [{ degree: "B.S. Fictional Studies", institution: "Example University", dates: "2010 - 2014" }],
    publications: [{ title: "A Fictional Whitepaper", publisher: "Fictional Press", dates: "2020" }],
  });
  await withRenderedFile(config, "sections.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    assert.match(text, /B\.S\. Fictional Studies/);
    assert.match(text, /Example University/);
    assert.match(text, /A Fictional Whitepaper/);
    assert.doesNotMatch(text, /Speaking/);
  });
});

test("renderResumeConfig applies summary.fitOverride when present", async () => {
  const config = fictionalConfig({
    summary: {
      text: "Strong fit for developer platform roles.",
      fitOverride: "Exceptional fit for this fictional Acme Corp role.",
    },
  });
  await withRenderedFile(config, "fit-override.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    assert.match(text, /Exceptional fit for this fictional Acme Corp role\./);
  });
});

function publicationsSpeakingConfig(overrides) {
  return fictionalConfig({
    publications: [{ title: "A Fictional Whitepaper", publisher: "Fictional Press", dates: "2020" }],
    speaking: [{ heading: "Fictional Conference Talks", organizations: "ExampleConf", dates: "2021" }],
    ...overrides,
  });
}

// sectionHeading() upper-cases its text (docx-helpers.js), so headings render
// as e.g. "PUBLICATIONS & SPEAKING" — these assertions match case-insensitively.

test('renderResumeConfig "combined" layout (default) renders one "Publications & Speaking" heading with both', async () => {
  await withRenderedFile(publicationsSpeakingConfig({}), "combined.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    assert.match(text, /publications & speaking/iu);
    assert.match(text, /A Fictional Whitepaper/);
    assert.match(text, /Fictional Conference Talks/);
  });
});

test('renderResumeConfig "speaking-then-publications" layout renders two separate headings', async () => {
  const config = publicationsSpeakingConfig({ publicationsSpeakingLayout: "speaking-then-publications" });
  await withRenderedFile(config, "speaking-then-publications.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    assert.match(text, /^SPEAKING$/mu);
    assert.match(text, /^PUBLICATIONS$/mu);
    assert.doesNotMatch(text, /publications & speaking/iu);
    assert.match(text, /Fictional Conference Talks/);
    assert.match(text, /A Fictional Whitepaper/);
  });
});

test('renderResumeConfig "combined-speaking-only" layout renders "Publications & Speaking" with only speaking content', async () => {
  const config = publicationsSpeakingConfig({ publicationsSpeakingLayout: "combined-speaking-only" });
  await withRenderedFile(config, "combined-speaking-only.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    assert.match(text, /publications & speaking/iu);
    assert.match(text, /Fictional Conference Talks/);
    assert.doesNotMatch(text, /A Fictional Whitepaper/);
  });
});

test('renderResumeConfig "publications-only" layout renders a standalone "Publications" heading with only publication content', async () => {
  const config = publicationsSpeakingConfig({ publicationsSpeakingLayout: "publications-only" });
  await withRenderedFile(config, "publications-only.docx", (outputPath) => {
    const text = readDocxText(outputPath);
    assert.match(text, /^PUBLICATIONS$/mu);
    assert.match(text, /A Fictional Whitepaper/);
    assert.doesNotMatch(text, /Fictional Conference Talks/);
  });
});
