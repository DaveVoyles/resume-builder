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

function appendUniqueEvidence(file, entries) {
  const existingIds = new Set(readJsonLines(file).map((entry) => entry.id));
  const nextEntries = entries.filter((entry) => !existingIds.has(entry.id));
  appendJsonLines(file, nextEntries);
  return nextEntries.length;
}

module.exports = { appendUniqueEvidence, createEvidenceEntry, snippet };
