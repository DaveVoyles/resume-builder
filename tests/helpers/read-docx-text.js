"use strict";

// Minimal ZIP + WordprocessingML text extractor, used only by tests to
// perform the golden render-seam check (Testing Decisions, D2): "extracted
// text contains expected strings from the config." DOCX is a standard ZIP
// container; we read its central directory to locate word/document.xml,
// inflate it, and strip tags. No new dependency: relies on Node's built-in
// zlib and buffer APIs only.

const zlib = require("zlib");

const END_OF_CENTRAL_DIR_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(buffer) {
  const minLength = 22;
  for (let offset = buffer.length - minLength; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIR_SIGNATURE) {
      return offset;
    }
  }
  throw new Error("Not a valid ZIP/DOCX buffer: end-of-central-directory record not found");
}

function readCentralDirectoryEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  const entries = [];
  let offset = centralDirOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIR_SIGNATURE) {
      throw new Error(`Malformed ZIP central directory entry at offset ${offset}`);
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    entries.push({ fileName, compressionMethod, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }
  return entries;
}

function extractEntry(buffer, entry) {
  const localOffset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(`Malformed ZIP local file header at offset ${localOffset}`);
  }
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return zlib.inflateRawSync(compressed);
  throw new Error(`Unsupported ZIP compression method: ${entry.compressionMethod}`);
}

function readZipEntryText(buffer, entryName) {
  const entries = readCentralDirectoryEntries(buffer);
  const entry = entries.find((candidate) => candidate.fileName === entryName);
  if (!entry) throw new Error(`Entry not found in archive: ${entryName}`);
  return extractEntry(buffer, entry).toString("utf8");
}

function stripXmlTags(xml) {
  return xml
    .replace(/<w:p[ >]/gu, "\n$&")
    .replace(/<[^>]+>/gu, "")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/[ \t]+/gu, " ")
    .replace(/\n{2,}/gu, "\n")
    .trim();
}

/** Read a .docx file from disk and return its extracted plain text. */
function readDocxText(filePath) {
  const fs = require("fs");
  const buffer = fs.readFileSync(filePath);
  const documentXml = readZipEntryText(buffer, "word/document.xml");
  return stripXmlTags(documentXml);
}

module.exports = { readDocxText };
