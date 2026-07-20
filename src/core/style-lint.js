"use strict";

/**
 * De-AI style lint (design plan 0005, D7 — see docs/design/0005-lucidresume-adoption.md).
 *
 * Deterministic lint over resume and cover-letter text to detect AI-generated writing:
 * - Wordlist/cliché matching against common AI-generated buzzwords
 * - Sentence-uniformity heuristic (flags suspiciously uniform sentence lengths/structures)
 * - Repetition heuristic (flags repeated words/phrases/sentence-openers)
 *
 * Returns a list of advisory findings (never blocks). Pure function: text in,
 * list of findings out.
 */

const aiStyleWordlist = require("./data/ai-style-wordlist.json");

/**
 * Normalize text for case-insensitive matching.
 */
function normalizeText(text) {
  return text.toLowerCase().trim();
}

/**
 * Extract sentences from text. Splits on common sentence-ending punctuation.
 * Filters out empty sentences and normalizes whitespace.
 */
function extractSentences(text) {
  if (!text || typeof text !== "string") return [];

  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Checks for buzzword/cliché matches in text.
 * Returns an array of findings.
 *
 * @param {string} text - The text to check
 * @returns {object[]} Array of findings with { type: "buzzword", word: string, count: number }
 */
function checkBuzzwords(text) {
  const normalized = normalizeText(text);
  const findings = [];
  const matched = new Set();

  for (const word of aiStyleWordlist) {
    // Case-insensitive substring match with word boundary or phrase matching
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = [...normalized.matchAll(regex)];

    if (matches.length > 0 && !matched.has(word.toLowerCase())) {
      findings.push({
        type: "buzzword",
        word,
        count: matches.length,
      });
      matched.add(word.toLowerCase());
    }
  }

  return findings;
}

/**
 * Checks for sentence-uniformity patterns (a known AI-writing tell).
 * Flags when most sentences fall within a narrow length range.
 *
 * @param {string} text - The text to check
 * @returns {object[]} Array of findings with { type: "uniformity", description: string }
 */
function checkSentenceUniformity(text) {
  const sentences = extractSentences(text);
  if (sentences.length < 3) return []; // Need at least 3 sentences to detect a pattern

  // Measure sentence length in words
  const lengths = sentences.map((s) => s.split(/\s+/).length);

  // Calculate mean and standard deviation
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / lengths.length;
  const stdDev = Math.sqrt(variance);

  // Low standard deviation (less than 2 words) suggests uniform sentence lengths
  // This is a heuristic: a real threshold depends on overall text length, but 2 words
  // is a reasonable conservative flag for "suspiciously uniform"
  if (stdDev < 2 && lengths.length >= 3) {
    const lengthRange = `${Math.min(...lengths)}-${Math.max(...lengths)} words`;
    return [
      {
        type: "uniformity",
        description: `Sentences are suspiciously uniform in length (${lengthRange}, avg ${Math.round(mean)} words)`,
      },
    ];
  }

  return [];
}

/**
 * Checks for repetition patterns: repeated words, repeated phrases, repeated sentence openers.
 * Flags when repetition exceeds expected baselines.
 *
 * @param {string} text - The text to check
 * @returns {object[]} Array of findings with { type: "repetition", description: string }
 */
function checkRepetition(text) {
  const findings = [];
  const normalized = normalizeText(text);
  const sentences = extractSentences(text);

  if (sentences.length < 2) return findings;

  // Check for repeated words (common words filtered, ratio-based)
  const commonWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "of",
    "is",
    "are",
    "was",
    "were",
    "been",
    "be",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "can",
    "for",
    "with",
    "by",
  ]);

  const words = normalized.split(/\s+/);
  const wordFreq = {};
  for (const word of words) {
    if (!commonWords.has(word) && word.length > 3) {
      // Only count non-common words longer than 3 chars
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }

  // Flag words that appear 3+ times (likely repetition in a short text)
  const repeatedWords = Object.entries(wordFreq)
    .filter(([, count]) => count >= 3)
    .map(([word]) => word);

  if (repeatedWords.length > 0) {
    findings.push({
      type: "repetition",
      description: `Repeated words: "${repeatedWords.slice(0, 3).join('", "')}"${repeatedWords.length > 3 ? ` and ${repeatedWords.length - 3} more` : ""}`,
    });
  }

  // Check for repeated sentence openers (first 2-3 words of each sentence)
  if (sentences.length >= 3) {
    const openerFreq = {};
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);
      const opener = words.slice(0, 2).join(" ");
      if (opener.length > 3) {
        openerFreq[opener] = (openerFreq[opener] || 0) + 1;
      }
    }

    const repeatedOpeners = Object.entries(openerFreq).filter(([, count]) => count >= 3);
    if (repeatedOpeners.length > 0) {
      findings.push({
        type: "repetition",
        description: `Repeated sentence starters: "${repeatedOpeners.map(([opener]) => opener).slice(0, 2).join('", "')}"${repeatedOpeners.length > 2 ? " and more" : ""}`,
      });
    }
  }

  return findings;
}

/**
 * Lints text for AI-generated style patterns.
 * Returns an array of advisory findings (warning-level, never blocking).
 *
 * @param {string} text - The text to lint
 * @returns {object[]} Array of findings with { type, description, ... }
 */
function lintText(text) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return [];
  }

  const findings = [];

  // Check buzzwords (flattened to descriptions for consistency)
  const buzzwords = checkBuzzwords(text);
  if (buzzwords.length > 0) {
    const buzzwordList = buzzwords.map((b) => `"${b.word}"`).join(", ");
    findings.push({
      type: "buzzword",
      description: `AI-style buzzwords detected: ${buzzwordList}`,
    });
  }

  // Check sentence uniformity
  findings.push(...checkSentenceUniformity(text));

  // Check repetition
  findings.push(...checkRepetition(text));

  return findings;
}

/**
 * Lints a resume or cover-letter config for AI-generated style patterns.
 * Walks all text-bearing fields and aggregates findings.
 *
 * @param {object} config - Resume or cover-letter config object
 * @param {string} configType - "resume" or "cover-letter" (for labeling)
 * @returns {object} { findings: array, summary: string }
 *          findings: array of { type, description, source?, sourceLabel? }
 *          summary: human-readable one-liner
 */
function lintConfig(config, configType = "resume") {
  if (!config || typeof config !== "object") {
    return { findings: [], summary: "" };
  }

  const findings = [];
  let fieldCount = 0;

  // Lint resume-specific fields
  if (configType === "resume") {
    // Summary
    if (config.summary?.text) {
      const summaryFindings = lintText(config.summary.text);
      summaryFindings.forEach((f) => {
        findings.push({
          ...f,
          source: "summary",
          sourceLabel: "Professional summary",
        });
      });
      fieldCount++;
    }

    // Experience bullets
    if (config.experienceSections) {
      config.experienceSections.forEach((section, sectionIdx) => {
        if (section.jobs) {
          section.jobs.forEach((job, jobIdx) => {
            if (job.bullets) {
              job.bullets.forEach((bullet, bulletIdx) => {
                const bulletFindings = lintText(bullet);
                bulletFindings.forEach((f) => {
                  findings.push({
                    ...f,
                    source: `experience[${sectionIdx}].jobs[${jobIdx}].bullets[${bulletIdx}]`,
                    sourceLabel: `Job ${jobIdx + 1} bullet ${bulletIdx + 1}`,
                  });
                });
              });
            }
            fieldCount++;
          });
        }
      });
    }

    // Skills values
    if (config.skills) {
      config.skills.forEach((row, idx) => {
        if (Array.isArray(row) && row[1]) {
          const skillFindings = lintText(row[1]);
          skillFindings.forEach((f) => {
            findings.push({
              ...f,
              source: `skills[${idx}][1]`,
              sourceLabel: `Skill category "${row[0]}"`,
            });
          });
        }
      });
      fieldCount++;
    }
  }

  // Lint cover-letter specific fields
  if (configType === "cover-letter") {
    // Body paragraphs
    if (config.bodyParagraphs) {
      config.bodyParagraphs.forEach((paragraph, idx) => {
        const parFindings = lintText(paragraph);
        parFindings.forEach((f) => {
          findings.push({
            ...f,
            source: `bodyParagraphs[${idx}]`,
            sourceLabel: `Paragraph ${idx + 1}`,
          });
        });
      });
      fieldCount++;
    }
  }

  // Create summary
  const summary =
    findings.length === 0
      ? ""
      : `${findings.length} style issue(s) detected across ${fieldCount} field(s)`;

  return { findings, summary };
}

module.exports = {
  lintText,
  lintConfig,
  checkBuzzwords,
  checkSentenceUniformity,
  checkRepetition,
  extractSentences,
};
