"use strict";

const { appendJsonLines, readJsonLines } = require("./workspace");
const { hash, stableId } = require("./ids");

function snippet(text, maxLength = 1200) {
  return String(text || "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function createEvidenceEntry({ type, source, text, summary, metadata }) {
  const trimmed = snippet(text);
  const fingerprint = hash(`${type}|${source.kind}|${source.path || source.url || ""}|${trimmed}`);
  return {
    id: stableId("ev", [type, source.path || source.url || fingerprint]),
    type,
    source,
    fact: summary || `${type} evidence from ${source.path || source.url || source.kind}`,
    summary: summary || `${type} evidence from ${source.path || source.url || source.kind}`,
    snippet: trimmed,
    confidence: trimmed ? "source-text" : "metadata-only",
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
  };
}

const CHUNK_SNIPPET_CHARS = 600;

/**
 * One evidence entry for one resume piece (job header, bullet, or paragraph).
 * The id comes from the piece's own text, so re-ingesting the same file gives
 * the same ids. `occurrence` separates two identical pieces in one file.
 */
function createChunkEvidenceEntry({ type, source, chunk, occurrence = 0, metadata }) {
  const text = snippet(chunk.text, CHUNK_SNIPPET_CHARS);
  const place = [chunk.organization, chunk.dateRange].filter(Boolean).join(" ");
  const label = chunk.kind === "job-header" ? "job" : chunk.kind;
  const where = source.path || source.url || "";
  const entry = {
    id: stableId("ev", [type, where, `chunk:${hash(`${chunk.kind}|${place}|${text}`).slice(0, 16)}:${occurrence}`]),
    type,
    source,
    fact: text,
    summary: `${type} ${label}${chunk.section ? ` in ${chunk.section}` : ""}${place ? ` (${place})` : ""} from ${where}`,
    snippet: text,
    confidence: "source-text",
    metadata: { ...(metadata || {}), chunkKind: chunk.kind },
    createdAt: new Date().toISOString(),
  };
  if (chunk.section) entry.section = chunk.section;
  if (chunk.organization) entry.organization = chunk.organization;
  if (chunk.dateRange) entry.dateRange = chunk.dateRange;
  return entry;
}

function appendUniqueEvidence(file, entries) {
  const existingIds = new Set(readJsonLines(file).map((entry) => entry.id));
  const nextEntries = entries.filter((entry) => !existingIds.has(entry.id));
  appendJsonLines(file, nextEntries);
  return nextEntries.length;
}

module.exports = { CHUNK_SNIPPET_CHARS, appendUniqueEvidence, createChunkEvidenceEntry, createEvidenceEntry, snippet };
