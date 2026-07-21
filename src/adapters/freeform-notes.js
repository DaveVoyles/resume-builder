"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { hash } = require("../core/ids");

function xmlToText(xml) {
  return xml
    .replace(/<w:tab\/>/gu, "\t")
    .replace(/<\/w:p>/gu, "\n")
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

function readDocx(file) {
  if (isCdfv2Compound(file)) {
    const error = new Error(
      "appears to be encrypted/IRM-protected (CDFV2 compound file signature detected, not a valid OOXML zip)",
    );
    error.code = "DOCX_ENCRYPTED_OR_IRM";
    throw error;
  }
  const xml = execFileSync("unzip", ["-p", file, "word/document.xml"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return xmlToText(xml);
}

function readUtf8IfText(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) return "";
  return buffer.toString("utf8");
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
    try {
      text = readDocx(fullPath);
      extractionMode = "docx-document-xml";
    } catch (error) {
      extractionMode = `docx-metadata-only: ${error.message}`;
      warning =
        error.code === "DOCX_ENCRYPTED_OR_IRM"
          ? "could not extract text — appears to be encrypted/IRM-protected; recorded as metadata-only"
          : "could not extract text — corrupt or unsupported .docx; recorded as metadata-only";
    }
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

module.exports = { readTextSource, readDocx, isCdfv2Compound };
