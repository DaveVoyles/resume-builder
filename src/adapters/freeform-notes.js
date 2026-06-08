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

function readDocx(file) {
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

  if (extension === ".docx") {
    try {
      text = readDocx(fullPath);
      extractionMode = "docx-document-xml";
    } catch (error) {
      extractionMode = `docx-metadata-only: ${error.message}`;
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
    metadata: {
      bytes,
      sha256: hash(fs.readFileSync(fullPath)),
      extension: extension || "none",
      extractionMode,
    },
  };
}

module.exports = { readTextSource };
