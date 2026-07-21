"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { Packer } = require("docx");
const { readTextSource, readDocx, readPptx, isCdfv2Compound } = require("../../src/adapters/freeform-notes");
const { renderResumeConfig } = require("../../src/renderers/docx-resume");
const command = require("../../src/cli/commands/ingest");
const { readJsonLines, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");
const { createDefaultProfile } = require("../../src/core/candidate-profile");

// Regression coverage for GitHub issue #96: encrypted/IRM-protected .docx
// files were silently ingested as empty ("metadata-only"), with the real
// unzip failure swallowed and never surfaced to the CLI user.

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fictionalConfig() {
  return {
    schemaVersion: "1.0",
    company: "Acme Corp",
    candidate: {
      name: "Sample Candidate",
      contact: [{ text: "sample.candidate@example.invalid", link: "mailto:sample.candidate@example.invalid" }],
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
            bullets: ["Led a fictional cross-team launch."],
          },
        ],
      },
    ],
    skills: [["Languages", "JavaScript, Python"]],
  };
}

async function writeRealDocx(dir, fileName) {
  const document = renderResumeConfig(fictionalConfig());
  const buffer = await Packer.toBuffer(document);
  const outputPath = path.join(dir, fileName);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

function writeCdfv2Fixture(dir, fileName) {
  // CDFV2 (OLE compound file) magic bytes, as seen in encrypted/IRM-protected
  // .docx files, padded out with filler bytes so it looks like a real file.
  const header = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const filler = Buffer.alloc(512, 0);
  const outputPath = path.join(dir, fileName);
  fs.writeFileSync(outputPath, Buffer.concat([header, filler]));
  return outputPath;
}

function writeCorruptDocxFixture(dir, fileName) {
  // Neither a valid zip nor a CDFV2 compound file — just garbage bytes with
  // a .docx extension, to exercise the generic corrupt-file branch.
  const outputPath = path.join(dir, fileName);
  fs.writeFileSync(outputPath, Buffer.from("not a real docx file, just plain garbage bytes"));
  return outputPath;
}

// Builds a minimal-but-real .pptx: an OOXML zip with one ppt/slides/slideN.xml
// part per entry in `slideTexts`, each containing a single DrawingML text run
// (<a:t>...</a:t>) so readPptx has real slide XML to parse. There's no
// pptx-generation library in this project's dependencies (unlike `docx` for
// .docx fixtures), so this hand-builds the archive with the `zip` CLI —
// mirroring the shell-out approach readPptx itself uses via `unzip`.
function writePptxFixture(dir, fileName, slideTexts) {
  const buildDir = fs.mkdtempSync(path.join(dir, "pptx-build-"));
  const slidesDir = path.join(buildDir, "ppt", "slides");
  fs.mkdirSync(slidesDir, { recursive: true });

  fs.writeFileSync(
    path.join(buildDir, "[Content_Types].xml"),
    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
      "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
      "<Default Extension=\"xml\" ContentType=\"application/xml\"/></Types>",
  );

  Object.entries(slideTexts).forEach(([slideNumber, text]) => {
    const slideXml =
      "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n" +
      "<p:sld xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" " +
      "xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\">" +
      "<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>" +
      text +
      "</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>";
    fs.writeFileSync(path.join(slidesDir, `slide${slideNumber}.xml`), slideXml);
  });

  const outputPath = path.join(dir, fileName);
  execFileSync("zip", ["-r", outputPath, "[Content_Types].xml", "ppt"], {
    cwd: buildDir,
    stdio: ["ignore", "ignore", "ignore"],
  });
  fs.rmSync(buildDir, { recursive: true, force: true });
  return outputPath;
}

function writeCorruptPptxFixture(dir, fileName) {
  // Neither a valid zip nor a CDFV2 compound file — exercises the generic
  // corrupt-file branch for .pptx, parallel to writeCorruptDocxFixture.
  const outputPath = path.join(dir, fileName);
  fs.writeFileSync(outputPath, Buffer.from("not a real pptx file, just plain garbage bytes"));
  return outputPath;
}

function writeFakePdfFixture(dir, fileName) {
  // A binary-ish blob with a .pdf extension — realistic enough (starts with
  // the real "%PDF-" magic bytes) to exercise the .pdf branch without needing
  // a genuine PDF or any PDF-parsing dependency.
  const outputPath = path.join(dir, fileName);
  const body = Buffer.concat([
    Buffer.from("%PDF-1.4\n"),
    Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]),
    Buffer.from("some binary PDF stream bytes\n"),
  ]);
  fs.writeFileSync(outputPath, body);
  return outputPath;
}

test("isCdfv2Compound detects the CDFV2 magic byte signature", () => {
  const dir = tmpDir("cdfv2-detect-");
  try {
    const encryptedPath = writeCdfv2Fixture(dir, "encrypted.docx");
    const corruptPath = writeCorruptDocxFixture(dir, "corrupt.docx");
    assert.equal(isCdfv2Compound(encryptedPath), true);
    assert.equal(isCdfv2Compound(corruptPath), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readDocx extracts text normally from a valid .docx", async () => {
  const dir = tmpDir("valid-docx-");
  try {
    const docxPath = await writeRealDocx(dir, "resume.docx");
    const text = readDocx(docxPath);
    assert.ok(text.includes("Senior Fictional Engineer"), "extracted text should contain resume content");
    assert.ok(text.includes("Northwind Widgets"), "extracted text should contain company name");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readDocx throws a distinct encrypted/IRM-protected error for CDFV2 files", () => {
  const dir = tmpDir("cdfv2-readdocx-");
  try {
    const encryptedPath = writeCdfv2Fixture(dir, "encrypted.docx");
    assert.throws(
      () => readDocx(encryptedPath),
      (error) => {
        assert.equal(error.code, "DOCX_ENCRYPTED_OR_IRM");
        assert.match(error.message, /encrypted\/IRM-protected/);
        return true;
      },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readDocx throws a generic error for a corrupt (non-CDFV2) .docx", () => {
  const dir = tmpDir("corrupt-readdocx-");
  try {
    const corruptPath = writeCorruptDocxFixture(dir, "corrupt.docx");
    assert.throws(
      () => readDocx(corruptPath),
      (error) => {
        assert.notEqual(error.code, "DOCX_ENCRYPTED_OR_IRM");
        return true;
      },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readTextSource: valid .docx still extracts text with no warning", async () => {
  const dir = tmpDir("readtextsource-valid-");
  try {
    const docxPath = await writeRealDocx(dir, "resume.docx");
    const result = readTextSource(docxPath);
    assert.equal(result.metadata.extractionMode, "docx-document-xml");
    assert.equal(result.warning, null);
    assert.ok(result.text.includes("Senior Fictional Engineer"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readTextSource: encrypted/IRM-protected .docx degrades to metadata-only with a branded warning", () => {
  const dir = tmpDir("readtextsource-encrypted-");
  try {
    const encryptedPath = writeCdfv2Fixture(dir, "encrypted.docx");
    const result = readTextSource(encryptedPath);
    assert.equal(result.text, "");
    assert.match(result.metadata.extractionMode, /^docx-metadata-only:/);
    assert.match(result.metadata.extractionMode, /encrypted\/IRM-protected/);
    assert.ok(result.warning, "warning should be set for a degraded docx source");
    assert.match(result.warning, /encrypted\/IRM-protected/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readTextSource: corrupt (non-CDFV2) .docx degrades to metadata-only with a generic warning", () => {
  const dir = tmpDir("readtextsource-corrupt-");
  try {
    const corruptPath = writeCorruptDocxFixture(dir, "corrupt.docx");
    const result = readTextSource(corruptPath);
    assert.equal(result.text, "");
    assert.match(result.metadata.extractionMode, /^docx-metadata-only:/);
    assert.doesNotMatch(result.metadata.extractionMode, /encrypted\/IRM-protected/);
    assert.ok(result.warning, "warning should be set for a degraded docx source");
    assert.doesNotMatch(result.warning, /encrypted\/IRM-protected/);
    assert.match(result.warning, /corrupt or unsupported/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// Regression coverage for GitHub issue #95: .pptx and .pdf sources fell
// through to the generic branch, which reads raw bytes as UTF-8 and bails to
// "" on binary content — silently recording "metadata-only" with no
// indication anything went wrong.

test("readPptx extracts and concatenates text from a single-slide .pptx", () => {
  const dir = tmpDir("valid-pptx-single-");
  try {
    const pptxPath = writePptxFixture(dir, "deck.pptx", { 1: "Solo Slide Title" });
    const text = readPptx(pptxPath);
    assert.ok(text.includes("Solo Slide Title"), "extracted text should contain the slide's text run");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readPptx concatenates slides in numeric order, not lexical (slide10 after slide9)", () => {
  const dir = tmpDir("valid-pptx-multi-");
  try {
    const pptxPath = writePptxFixture(dir, "deck.pptx", {
      1: "First Slide",
      2: "Second Slide",
      9: "Ninth Slide",
      10: "Tenth Slide",
    });
    const text = readPptx(pptxPath);
    const first = text.indexOf("First Slide");
    const second = text.indexOf("Second Slide");
    const ninth = text.indexOf("Ninth Slide");
    const tenth = text.indexOf("Tenth Slide");
    assert.ok([first, second, ninth, tenth].every((index) => index >= 0), "all four slides' text should be present");
    assert.ok(first < second, "slide1 text should appear before slide2 text");
    assert.ok(second < ninth, "slide2 text should appear before slide9 text");
    assert.ok(ninth < tenth, "slide9 text should appear before slide10 text (numeric, not lexical, order)");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readPptx throws for a corrupt (non-zip) .pptx", () => {
  const dir = tmpDir("corrupt-readpptx-");
  try {
    const corruptPath = writeCorruptPptxFixture(dir, "corrupt.pptx");
    assert.throws(() => readPptx(corruptPath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readTextSource: valid .pptx extracts slide text with no warning", () => {
  const dir = tmpDir("readtextsource-pptx-valid-");
  try {
    const pptxPath = writePptxFixture(dir, "deck.pptx", { 1: "Quarterly Roadmap", 2: "Team Wins" });
    const result = readTextSource(pptxPath);
    assert.equal(result.metadata.extractionMode, "pptx-slides-xml");
    assert.equal(result.warning, null);
    assert.ok(result.text.includes("Quarterly Roadmap"));
    assert.ok(result.text.includes("Team Wins"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readTextSource: corrupt (non-zip) .pptx degrades to metadata-only with a visible warning", () => {
  const dir = tmpDir("readtextsource-pptx-corrupt-");
  try {
    const corruptPath = writeCorruptPptxFixture(dir, "corrupt.pptx");
    const result = readTextSource(corruptPath);
    assert.equal(result.text, "");
    assert.match(result.metadata.extractionMode, /^pptx-metadata-only:/);
    assert.ok(result.warning, "warning should be set for a degraded pptx source");
    assert.match(result.warning, /corrupt or unsupported/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readTextSource: encrypted/IRM-protected .pptx degrades to metadata-only with a branded warning", () => {
  const dir = tmpDir("readtextsource-pptx-encrypted-");
  try {
    const encryptedPath = writeCdfv2Fixture(dir, "encrypted.pptx");
    const result = readTextSource(encryptedPath);
    assert.equal(result.text, "");
    assert.match(result.metadata.extractionMode, /^pptx-metadata-only:/);
    assert.match(result.metadata.extractionMode, /encrypted\/IRM-protected/);
    assert.ok(result.warning, "warning should be set for a degraded pptx source");
    assert.match(result.warning, /encrypted\/IRM-protected/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("readTextSource: .pdf source is honestly recorded as unsupported with a conversion-recommending warning", () => {
  const dir = tmpDir("readtextsource-pdf-");
  try {
    const pdfPath = writeFakePdfFixture(dir, "resume.pdf");
    const result = readTextSource(pdfPath);
    assert.equal(result.text, "");
    assert.equal(result.metadata.extractionMode, "pdf-not-supported");
    assert.ok(result.warning, "warning should be set for a .pdf source");
    assert.match(result.warning, /not supported yet/);
    assert.match(result.warning, /\.docx/);
    assert.match(result.warning, /\.md/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createFixtureWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-docx-workspace-"));
  const paths = workspacePaths(workspace);
  ensureDir(paths.inputs);
  ensureDir(paths.outputResumes);
  writeJson(paths.profile, createDefaultProfile());
  fs.writeFileSync(paths.evidence, "");
  return { workspace, paths };
}

test("ingest command prints a visible console.warn when a .docx source degrades to metadata-only", async () => {
  const { workspace, paths } = createFixtureWorkspace();
  const fixtureDir = tmpDir("ingest-encrypted-fixture-");
  const originalWarn = console.warn;
  const warnCalls = [];
  console.warn = (...args) => warnCalls.push(args.join(" "));

  try {
    const encryptedPath = writeCdfv2Fixture(fixtureDir, "encrypted-resume.docx");

    await command.run({ workspace, notes: encryptedPath });

    assert.ok(warnCalls.length > 0, "ingest should print at least one warning");
    const combined = warnCalls.join("\n");
    assert.match(combined, /⚠/);
    assert.match(combined, /encrypted-resume\.docx/);
    assert.match(combined, /encrypted\/IRM-protected/);

    // The evidence entry itself is still recorded (fallback behavior is
    // unchanged) — just now with a visible warning alongside it.
    const entries = readJsonLines(paths.evidence);
    assert.ok(entries.length > 0);
    assert.equal(entries[0].confidence, "metadata-only");
  } finally {
    console.warn = originalWarn;
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("ingest command does not warn for a valid .docx source", async () => {
  const { workspace, paths } = createFixtureWorkspace();
  const fixtureDir = tmpDir("ingest-valid-fixture-");
  const originalWarn = console.warn;
  const warnCalls = [];
  console.warn = (...args) => warnCalls.push(args.join(" "));

  try {
    const docxPath = await writeRealDocx(fixtureDir, "resume.docx");

    await command.run({ workspace, notes: docxPath });

    assert.equal(warnCalls.length, 0, "no warning expected for a valid, extractable .docx");

    const entries = readJsonLines(paths.evidence);
    assert.ok(entries.length > 0);
    assert.equal(entries[0].confidence, "source-text");
  } finally {
    console.warn = originalWarn;
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
