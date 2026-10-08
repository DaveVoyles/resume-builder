"use strict";

/**
 * Word-boundary keyword matching with an alias map. No network, no LLM.
 *
 * - A term only matches as a whole token: "Java" does not match "JavaScript",
 *   "C" does not match "C++" or "Chicago", "Node" does not match "Node.js"
 *   unless the alias map says they are the same thing.
 * - Terms with + # . / (C++, C#, Node.js, CI/CD) are escaped and matched
 *   literally.
 * - A trailing plural "s"/"es" is allowed ("workflow" matches "workflows").
 * - Aliases (src/core/data/keyword-aliases.json) apply both ways.
 * - Two-letter all-caps terms (PM, ML, JS) match case-exactly so "pm" in
 *   "5 pm" or "js" in a file name does not count.
 */

const aliasData = require("./data/keyword-aliases.json");

function normalize(term) {
  return String(term).trim().replace(/\s+/gu, " ").toLowerCase();
}

const aliasIndex = new Map();
for (const group of aliasData.groups || []) {
  const terms = group.map((term) => String(term).trim()).filter(Boolean);
  for (const term of terms) {
    const key = normalize(term);
    const set = aliasIndex.get(key) || new Set();
    terms.forEach((other) => set.add(other));
    aliasIndex.set(key, set);
  }
}

/** The keyword itself first, then every alias from the map (deduped). */
function termVariants(keyword) {
  const own = String(keyword).trim();
  const seen = new Set([normalize(own)]);
  const variants = [own];
  for (const alias of aliasIndex.get(normalize(own)) || []) {
    const key = normalize(alias);
    if (!seen.has(key)) {
      seen.add(key);
      variants.push(alias);
    }
  }
  return variants;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\/]/gu, "\\$&");
}

const patternCache = new Map();

function termPattern(term) {
  const cached = patternCache.get(term);
  if (cached) return cached;
  const trimmed = term.trim();
  const body = escapeRegExp(trimmed).replace(/\s+/gu, "\\s+");
  const caseExact = /^[A-Z]{2}$/u.test(trimmed);
  const endsAlnum = /[A-Za-z0-9]$/u.test(trimmed);
  const plural = /[A-Za-z]{3}$/u.test(trimmed) ? "(?:es|s)?" : "";
  // Not preceded by a letter/digit, nor by "x." (so "js" is not found in "Node.js").
  const before = "(?<![A-Za-z0-9])(?<![A-Za-z0-9]\\.)";
  // Not followed by a letter/digit; alnum-ending terms also reject "+", "#" and ".x"
  // so "C" is not found in "C++" and "Node" is not found in "Node.js".
  const after = endsAlnum ? `${plural}(?![A-Za-z0-9+#]|\\.[A-Za-z0-9])` : "(?![A-Za-z0-9])";
  const regex = new RegExp(`${before}${body}${after}`, caseExact ? "u" : "iu");
  patternCache.set(term, regex);
  return regex;
}

/** Returns the first variant of `keyword` (itself or an alias) found in `text`, or null. */
function matchKeyword(text, keyword) {
  if (typeof text !== "string" || text === "") return null;
  for (const variant of termVariants(keyword)) {
    if (termPattern(variant).test(text)) return variant;
  }
  return null;
}

module.exports = { matchKeyword, termVariants };
