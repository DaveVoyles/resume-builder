"use strict";

/**
 * A person's yes/no answers about posting keywords, kept in a notes file they
 * approved (candidate/inputs/notes/). Lines look like:
 *
 *   Confirmed (2026-10-08): release management. Resume line: "Led Fast Game ..."
 *   Not done (2026-10-08): RAID, agile, ServiceNow
 *
 * `ingest` reads those lines and stores them on the note's evidence entry as
 * metadata.confirmations, so the note is the source for the answer. A
 * confirmation counts as supporting evidence for that keyword only. A "Not
 * done" line never counts as support, even though the note names the keyword.
 * No LLM, no network.
 */

const { sameKeyword } = require("./keyword-match");

const LINE = /^\s*(?:[-*]|\d+[.)])?\s*(Confirmed|Not done)\s*(?:\((\d{4}-\d{2}-\d{2})\))?\s*:\s*(.+?)\s*$/iu;
const QUOTE_SPLIT = /\s*[.;—-]?\s*Resume lines?\s*:\s*/iu;

function splitKeywords(text) {
  return text
    .split(/\s*,\s*|\s+and\s+|\s+or\s+/iu)
    .map((part) => part.trim().replace(/^and\s+/iu, "").replace(/[.;]+$/u, "").trim())
    .filter(Boolean);
}

// Resume lines are quoted ("..."); several quoted lines are joined with " | ".
function quotedLines(text) {
  const quoted = [...text.matchAll(/["“]([^"”]+)["”]/gu)].map((match) => match[1].trim()).filter(Boolean);
  return quoted.length > 0 ? quoted.join(" | ") : text.trim().replace(/^["“”]+/u, "").replace(/["“”]+$/u, "").trim();
}

/** @returns {Array<{ keyword: string, status: "confirmed"|"declined", date: string, quote: string }>} */
function parseConfirmations(text) {
  const found = [];
  for (const raw of String(text || "").split(/\r?\n/u)) {
    const match = raw.match(LINE);
    if (!match) continue;
    const status = /^confirmed$/iu.test(match[1]) ? "confirmed" : "declined";
    const [list, ...quoteParts] = match[3].split(QUOTE_SPLIT);
    const quote = status === "confirmed" ? quotedLines(quoteParts.join(" ")) : "";
    for (const keyword of splitKeywords(list)) found.push({ keyword, status, date: match[2] || "", quote });
  }
  return found;
}

/** The note without its yes/no lines, so answers about keywords are not read as the person's own skills. */
function withoutConfirmationLines(text) {
  return String(text || "").split(/\r?\n/u).filter((line) => !LINE.test(line)).join("\n");
}

/** Evidence entries that carry the person's yes/no answers. Their text is never matched literally. */
function isConfirmationNote(entry) {
  return Boolean(entry && entry.metadata && Array.isArray(entry.metadata.confirmations) && entry.metadata.confirmations.length > 0);
}

/**
 * The latest answer per keyword (later date wins; same date, later in the ledger).
 * @returns {Array<{ keyword: string, status: string, date: string, quote: string, evidenceId: string }>}
 */
function collectConfirmations(evidence) {
  const all = [];
  (Array.isArray(evidence) ? evidence : []).forEach((entry, order) => {
    if (!isConfirmationNote(entry) || entry.status === "rejected" || entry.status === "superseded") return;
    entry.metadata.confirmations.forEach((item) => {
      if (item && typeof item.keyword === "string" && (item.status === "confirmed" || item.status === "declined")) {
        all.push({ ...item, date: item.date || "", quote: item.quote || "", evidenceId: entry.id, order });
      }
    });
  });
  all.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
  const latest = [];
  for (const item of all) {
    const at = latest.findIndex((other) => sameKeyword(other.keyword, item.keyword));
    if (at >= 0) latest.splice(at, 1);
    latest.push(item);
  }
  return latest;
}

/** The person's answer for a posting keyword, or null. */
function answerFor(keyword, confirmations) {
  return confirmations.find((item) => sameKeyword(item.keyword, keyword)) || null;
}

module.exports = { answerFor, collectConfirmations, isConfirmationNote, parseConfirmations, withoutConfirmationLines };
