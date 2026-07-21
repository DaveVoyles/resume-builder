"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { hash } = require("../core/ids");

// Strips OOXML markup down to plain text. DOCX (WordprocessingML) and PPTX
// (DrawingML) use different tag vocabularies for the same two constructs —
// an explicit tab and a paragraph/line boundary — so those two tags are
// parameterized; everything else (generic tag stripping, entity decoding,
// whitespace collapsing) is identical between formats.
function ooxmlToText(xml, { tabTag, paragraphCloseTag }) {
  return xml
    .replace(new RegExp(`<${tabTag}\\s*/>`, "gu"), "\t")
    .replace(new RegExp(`<${paragraphCloseTag}>`, "gu"), "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&#39;/gu, "'")
    .replace(/[ \t]+/gu, " ")
    .replace(/\n\s+/gu, "\n")
    .trim();
}

function xmlToText(xml) {
  return ooxmlToText(xml, { tabTag: "w:tab", paragraphCloseTag: "/w:p" });
}

function pptxXmlToText(xml) {
  return ooxmlToText(xml, { tabTag: "a:tab", paragraphCloseTag: "/a:p" });
}

// CDFV2 (Compound File Binary Format) magic bytes. Encrypted/IRM-protected
// .docx files (e.g. password-protected via Word, or Azure Information
// Protection) are stored as an OLE compound file wrapper rather than a plain
// OOXML zip, so they have this signature instead of the "PK\x03\x04" zip
// signature. Detecting it lets us give a specific, actionable error instead
// of an opaque "unzip failed" message.
const CDFV2_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

function isCdfv2Compound(file) {
  const fd = fs.openSync(file, "r");
  try {
    const header = Buffer.alloc(CDFV2_SIGNATURE.length);
    const bytesRead = fs.readSync(fd, header, 0, header.length, 0);
    return bytesRead === header.length && header.equals(CDFV2_SIGNATURE);
  } finally {
    fs.closeSync(fd);
  }
}

// Throws a branded error if `file` is an encrypted/IRM-protected compound
// file rather than a real OOXML zip. Shared by every OOXML-based reader
// (currently .docx and .pptx) so the check and error shape can't drift
// between formats.
function assertNotEncrypted(file, encryptedCode) {
  if (!isCdfv2Compound(file)) return;
  const error = new Error(
    "appears to be encrypted/IRM-protected (CDFV2 compound file signature detected, not a valid OOXML zip)",
  );
  error.code = encryptedCode;
  throw error;
}

function readDocx(file) {
  assertNotEncrypted(file, "DOCX_ENCRYPTED_OR_IRM");
  const xml = execFileSync("unzip", ["-p", file, "word/document.xml"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return xmlToText(xml);
}

// Lists the ppt/slides/slideN.xml parts of a .pptx archive, in slide order.
// Slide count varies per deck, so we discover the actual part names rather
// than assuming a fixed range, and sort numerically (slide2 before slide10)
// rather than lexically (which would put slide10 right after slide1).
function listPptxSlideParts(file) {
  const listing = execFileSync("unzip", ["-Z1", file], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return listing
    .split("\n")
    .map((line) => line.trim())
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/u.test(name))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml$/u)[1]);
      const numB = Number(b.match(/slide(\d+)\.xml$/u)[1]);
      return numA - numB;
    });
}

function readPptx(file) {
  // PPTX is, like DOCX, an OOXML zip — the same CDFV2 compound-file check
  // used for encrypted/IRM-protected .docx applies here.
  assertNotEncrypted(file, "PPTX_ENCRYPTED_OR_IRM");
  const slideParts = listPptxSlideParts(file);
  if (slideParts.length === 0) {
    const error = new Error("no ppt/slides/slideN.xml parts found in archive");
    error.code = "PPTX_NO_SLIDES";
    throw error;
  }
  const slideTexts = slideParts.map((part) => {
    const xml = execFileSync("unzip", ["-p", file, part], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return pptxXmlToText(xml);
  });
  return slideTexts.filter(Boolean).join("\n\n");
}

function readUtf8IfText(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) return "";
  return buffer.toString("utf8");
}

// Runs an OOXML reader (readDocx/readPptx) and normalizes every possible
// outcome into { text, extractionMode, warning }: real extracted text,
// structurally valid but empty content (e.g. an image-only deck/doc — the
// same silent-failure shape issue #95 was filed over, so it always gets a
// warning rather than reading as a normal success), or a caught extraction
// error. Shared by every OOXML format so the dispatch logic in
// readTextSource can't drift between formats as more are added.
function attemptOoxmlExtraction(readFn, file, { label, successMode, encryptedCode, noContentCode }) {
  try {
    const text = readFn(file);
    if (!text) {
      return {
        text: "",
        extractionMode: `${label}-empty`,
        warning: `no extractable text found in this .${label} file (e.g. image-only content); recorded as metadata-only`,
      };
    }
    return { text, extractionMode: successMode, warning: null };
  } catch (error) {
    const reason =
      error.code === encryptedCode
        ? "appears to be encrypted/IRM-protected"
        : noContentCode && error.code === noContentCode
          ? "a valid archive but no slide content was found"
          : "corrupt or unsupported";
    return {
      text: "",
      extractionMode: `${label}-metadata-only: ${error.message}`,
      warning: `could not extract text — ${reason} .${label}; recorded as metadata-only`,
    };
  }
}

function readTextSource(file) {
  const fullPath = path.resolve(file);
  if (!fs.existsSync(fullPath)) throw new Error(`Source file not found: ${file}`);
  const extension = path.extname(fullPath).toLowerCase();
  let text = "";
  let extractionMode = "utf8";
  // Non-null only when text extraction degraded to metadata-only; carries a
  // human-readable reason so callers (e.g. the CLI) can surface a visible
  // warning instead of silently swallowing the failure.
  let warning = null;

  if (extension === ".docx") {
    ({ text, extractionMode, warning } = attemptOoxmlExtraction(readDocx, fullPath, {
      label: "docx",
      successMode: "docx-document-xml",
      encryptedCode: "DOCX_ENCRYPTED_OR_IRM",
    }));
  } else if (extension === ".pptx") {
    ({ text, extractionMode, warning } = attemptOoxmlExtraction(readPptx, fullPath, {
      label: "pptx",
      successMode: "pptx-slides-xml",
      encryptedCode: "PPTX_ENCRYPTED_OR_IRM",
      noContentCode: "PPTX_NO_SLIDES",
    }));
  } else if (extension === ".pdf") {
    // No PDF-parsing dependency exists in this project (and none is added
    // here without a decision to do so) — always record PDFs as
    // metadata-only rather than fabricating extraction via a raw-byte UTF-8
    // sniff, which would misrepresent binary PDF bytes as "text".
    text = "";
    extractionMode = "pdf-not-supported";
    warning =
      "PDF text extraction is not supported yet; recorded as metadata-only. " +
      "Convert the PDF to .docx/.txt, or paste its text into a .md note, for full extraction.";
  } else if ([".md", ".markdown", ".txt", ".json", ".csv", ".tsv"].includes(extension)) {
    text = readUtf8IfText(fullPath);
  } else {
    text = readUtf8IfText(fullPath);
    extractionMode = text ? "utf8-untyped" : "metadata-only";
  }

  const bytes = fs.statSync(fullPath).size;
  return {
    path: fullPath,
    text,
    warning,
    metadata: {
      bytes,
      sha256: hash(fs.readFileSync(fullPath)),
      extension: extension || "none",
      extractionMode,
    },
  };
}

module.exports = { readTextSource, readDocx, readPptx, isCdfv2Compound };
