"use strict";

/**
 * Keyword coverage scoring engine (design plan 0004, D5 — see
 * docs/design-plans.md for full context).
 *
 * Walks the same claim-bearing text fields as collectConfigClaimSites
 * (summary, experience bullets, skills — both the name and description of
 * each skill row) and performs case-insensitive substring matching against a
 * list of target keywords. Returns a coverage report: the percentage of
 * keywords found, plus the lists of present and missing keywords.
 *
 * Deliberately no stemming or fuzzy matching — exact substring only.
 * This ensures keywords like "React" match exactly, avoiding false positives
 * from partial words like "reactive" or "reacted".
 */

function isNonBlankString(value) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Collects all claim-bearing text from a resume config, walking the same
 * fields as collectConfigClaimSites in claim-audit.js. Returns a single
 * concatenated string of all text to search against.
 */
function collectSearchText(config) {
  const textParts = [];

  if (config.summary && isNonBlankString(config.summary.text)) {
    textParts.push(config.summary.text);
  }

  (config.experienceSections || []).forEach((section) => {
    (section.jobs || []).forEach((job) => {
      (job.bullets || []).forEach((bullet) => {
        if (isNonBlankString(bullet)) {
          textParts.push(bullet);
        }
      });
    });
  });

  (config.skills || []).forEach((row) => {
    if (!Array.isArray(row)) return;
    // Skill names (row[0]) render onto the resume as literal text, so a
    // keyword matching the name alone (e.g. "program management" against a
    // skill named "Enterprise program management") is a real, visible match
    // — not just the description column. See #110.
    if (isNonBlankString(row[0])) {
      textParts.push(row[0]);
    }
    if (isNonBlankString(row[1])) {
      textParts.push(row[1]);
    }
  });

  return textParts.join(" ");
}

/**
 * Scores keyword coverage in a resume config.
 *
 * @param {string[]} keywords - List of keywords to search for (case-insensitive)
 * @param {object} resumeConfig - The resume configuration object
 * @returns {{ percent: number, present: string[], missing: string[] }}
 *          percent: 0-100 percentage of keywords found (excluding empty strings)
 *          present: Keywords that were found (case-insensitive substring match)
 *          missing: Keywords that were not found
 */
function scoreKeywordCoverage(keywords, resumeConfig) {
  if (!Array.isArray(keywords)) {
    return { percent: 0, present: [], missing: [] };
  }
  if (!resumeConfig || typeof resumeConfig !== "object") {
    return { percent: 0, present: [], missing: [...keywords] };
  }

  const searchText = collectSearchText(resumeConfig);
  const searchTextLower = searchText.toLowerCase();

  const present = [];
  const missing = [];

  keywords.forEach((keyword) => {
    if (typeof keyword !== "string" || keyword.trim() === "") {
      return;
    }

    const keywordLower = keyword.toLowerCase();
    if (searchTextLower.includes(keywordLower)) {
      present.push(keyword);
    } else {
      missing.push(keyword);
    }
  });

  const validKeywordCount = present.length + missing.length;
  const percent = validKeywordCount > 0 ? Math.round((present.length / validKeywordCount) * 100) : 0;

  return { percent, present, missing };
}

module.exports = { scoreKeywordCoverage };
