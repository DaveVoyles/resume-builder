"use strict";

/**
 * "Possible matches": for a posting keyword the ledger does not state in so
 * many words, find evidence lines that may show the same work under different
 * words (a small related-terms map in src/core/data/related-terms.json, plus
 * whole-word overlap with the keyword). Deterministic. No LLM, no network.
 *
 * These are SUGGESTIONS for the person to accept or reject. Nothing here is
 * ever added to a resume: a keyword only becomes supported evidence when the
 * person confirms it in a notes file (src/core/confirmations.js).
 */

const related = require("./data/related-terms.json");
const { isConfirmationNote } = require("./confirmations");
const { matchKeyword, termVariants } = require("./keyword-match");
const { usableEvidence } = require("./keyword-coverage");

const MAX_MATCHES_PER_KEYWORD = 3;
const MAX_QUOTE_CHARS = 220;
// A weaker line is dropped when the best one scores more than twice as high.
const MIN_SCORE_SHARE = 0.5;
// Words that say what kind of work it is, not which work. Every other word of the keyword has to appear in the line.
const GENERIC_WORDS = new Set(["management", "manager", "managing", "and", "of", "the", "for", "with"]);

const relatedIndex = new Map(Object.entries(related.related || {}).map(([key, terms]) => [key.trim().toLowerCase(), terms]));

function relatedTerms(keyword) {
  for (const variant of termVariants(keyword)) {
    const found = relatedIndex.get(variant.trim().toLowerCase());
    if (found) return found;
  }
  return [];
}

/** Whole words of the keyword that carry meaning. Empty when the keyword is all generic words. */
function distinctiveWords(keyword) {
  return String(keyword).toLowerCase().split(/[^a-z0-9]+/u).filter((word) => word.length > 2 && !GENERIC_WORDS.has(word));
}

function sentenceWithHit(text, hits) {
  if (text.length <= MAX_QUOTE_CHARS) return text;
  const sentences = text.split(/(?<=[.!?])\s+/u);
  return sentences.find((sentence) => hits.some((term) => matchKeyword(sentence, term))) || text;
}

function toQuote(text, hits) {
  const clean = sentenceWithHit(String(text).replace(/\s+/gu, " ").trim(), hits);
  if (clean.length <= MAX_QUOTE_CHARS) return clean;
  const cut = clean.slice(0, MAX_QUOTE_CHARS);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[\s,;:—-]+$/u, "")}…`;
}

function entryText(entry) {
  return [entry.snippet, entry.fact].find((value) => typeof value === "string" && value.trim() !== "") || "";
}

/** Entries worth quoting: the person's own source lines, not job headers, the whole-resume blob, or the yes/no note. */
function quotableEntries(evidence) {
  const usable = usableEvidence(evidence).filter((entry) => entry.id && !isConfirmationNote(entry));
  const chunked = new Set(usable.filter((entry) => entry.metadata && entry.metadata.chunkKind).map((entry) => entry.source && entry.source.path));
  return usable.filter((entry) => {
    const kind = entry.metadata && entry.metadata.chunkKind;
    if (kind === "job-header") return false;
    if (!kind && entry.type === "resume" && chunked.has(entry.source && entry.source.path)) return false;
    // Contact blocks ("name | email | links") are not work.
    return entryText(entry) !== "" && !/@/u.test(entryText(entry).slice(0, 200));
  });
}

/**
 * @param {Array<{ keyword: string, importance?: string, supported?: boolean, declined?: boolean }>} support
 *   classifyMissingKeywords() output; only keywords that are neither supported
 *   nor declined by the person are searched.
 * @param {{ evidence?: object[] }} source
 * @returns {Array<{ keyword: string, importance?: string, matches: Array<{ evidenceId: string, quote: string, source: string }> }>}
 *   in the order of `support`; keywords with no suggestion are left out.
 */
function findPossibleMatches(support, { evidence } = {}) {
  const entries = quotableEntries(evidence);
  const found = [];
  for (const item of Array.isArray(support) ? support : []) {
    if (!item || item.supported || item.declined || typeof item.keyword !== "string") continue;
    const terms = relatedTerms(item.keyword);
    const words = distinctiveWords(item.keyword);
    const scored = [];
    entries.forEach((entry, order) => {
      const text = entryText(entry);
      const hits = terms.filter((term) => matchKeyword(text, term));
      const overlap = words.length > 0 && words.every((word) => matchKeyword(text, word));
      if (hits.length === 0 && !overlap) return;
      const firstTerm = hits.length ? terms.indexOf(hits[0]) : terms.length;
      const kind = entry.metadata && entry.metadata.chunkKind;
      const score = hits.length * 2 + (hits.length ? (terms.length - firstTerm) / (terms.length + 1) : 0) + (overlap ? 1.5 : 0) + (kind === "bullet" ? 1.5 : kind === "paragraph" ? 0.5 : 0);
      scored.push({ entry, order, score, hits: overlap ? [...hits, ...words] : hits });
    });
    scored.sort((a, b) => b.score - a.score || a.order - b.order);
    const seen = new Set();
    const matches = [];
    const floor = scored.length ? scored[0].score * MIN_SCORE_SHARE : 0;
    for (const { entry, hits, score } of scored) {
      if (score < floor) break;
      const quote = toQuote(entryText(entry), hits);
      if (seen.has(quote)) continue;
      seen.add(quote);
      const file = entry.source && typeof entry.source.path === "string" ? entry.source.path.split(/[\\/]/u).pop() : "";
      matches.push({ evidenceId: entry.id, quote, source: file });
      if (matches.length >= MAX_MATCHES_PER_KEYWORD) break;
    }
    if (matches.length > 0) found.push({ keyword: item.keyword, ...(item.importance ? { importance: item.importance } : {}), matches });
  }
  return found;
}

module.exports = { findPossibleMatches };
