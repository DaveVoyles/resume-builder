"use strict";

/**
 * Keyword coverage scoring engine (design plan 0004, D5 — see
 * docs/design-plans.md for full context).
 *
 * Walks the same claim-bearing text fields as collectConfigClaimSites
 * (summary, experience bullets, skills — both the name and description of
 * each skill row) and matches target keywords with word boundaries and an
 * alias map (src/core/keyword-match.js). For each keyword it records whether
 * it is covered and where (summary, bullet N of a job, a skills row).
 *
 * Keywords may be a plain list, or { required, preferred }. Required keywords
 * weigh 2, preferred 1, in the weighted score; the plain percent counts every
 * keyword once. A plain list counts every keyword as required.
 *
 * `classifyMissingKeywords` splits what is missing into "the ledger supports
 * it, so it could be added" and "no evidence, do not suggest adding it".
 */

const { matchKeyword } = require("./keyword-match");

const REQUIRED_WEIGHT = 2;
const PREFERRED_WEIGHT = 1;

function isNonBlankString(value) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Collects claim-bearing text from a resume config as labelled sites, walking
 * the same fields as collectConfigClaimSites in claim-audit.js.
 * Skill names (row[0]) render onto the resume as literal text, so a keyword
 * matching the name alone is a real, visible match (see #110).
 */
function collectSearchSites(config) {
  const sites = [];

  if (config.summary && isNonBlankString(config.summary.text)) {
    sites.push({ where: "summary", text: config.summary.text });
  }

  (config.experienceSections || []).forEach((section) => {
    (section.jobs || []).forEach((job) => {
      const jobLabel = [job.title, job.company].filter(isNonBlankString).join(" at ") || "job";
      (job.bullets || []).forEach((bullet, index) => {
        if (isNonBlankString(bullet)) {
          sites.push({ where: `bullet ${index + 1} of ${jobLabel}`, text: bullet });
        }
      });
    });
  });

  (config.skills || []).forEach((row) => {
    if (!Array.isArray(row)) return;
    const label = isNonBlankString(row[0]) ? row[0] : "skills";
    const text = [row[0], row[1]].filter(isNonBlankString).join(" ");
    if (text) sites.push({ where: `skills: ${label}`, text });
  });

  return sites;
}

/** Normalizes the keyword input into [{ keyword, importance }], deduped case-insensitively. */
function normalizeKeywords(keywords) {
  let required = [];
  let preferred = [];
  if (Array.isArray(keywords)) {
    required = keywords;
  } else if (keywords && typeof keywords === "object") {
    required = Array.isArray(keywords.required) ? keywords.required : [];
    preferred = Array.isArray(keywords.preferred) ? keywords.preferred : [];
  }
  const seen = new Set();
  const list = [];
  const add = (items, importance) => {
    items.forEach((keyword) => {
      if (!isNonBlankString(keyword)) return;
      const key = keyword.trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ keyword, importance });
    });
  };
  add(required, "required");
  add(preferred, "preferred");
  return list;
}

function emptyResult() {
  return { percent: 0, weightedScore: 0, present: [], missing: [], details: [] };
}

/**
 * Scores keyword coverage in a resume config.
 *
 * @param {string[]|{required?: string[], preferred?: string[]}} keywords
 * @param {object} resumeConfig - The resume configuration object
 * @returns {{
 *   percent: number, weightedScore: number, present: string[], missing: string[],
 *   details: Array<{ keyword: string, importance: "required"|"preferred", covered: boolean, matchedAs: string|null, locations: string[] }>
 * }}
 *   percent: 0-100, share of keywords found (each counts once)
 *   weightedScore: 0-100, required keywords count 2, preferred 1
 *   present / missing: keyword strings in input order
 *   details: per keyword, where it was found
 */
function scoreKeywordCoverage(keywords, resumeConfig) {
  const list = normalizeKeywords(keywords);
  if (list.length === 0) return emptyResult();
  if (!resumeConfig || typeof resumeConfig !== "object") {
    return {
      percent: 0,
      weightedScore: 0,
      present: [],
      missing: list.map((item) => item.keyword),
      details: list.map((item) => ({ ...item, covered: false, matchedAs: null, locations: [] })),
    };
  }

  const sites = collectSearchSites(resumeConfig);
  const details = list.map(({ keyword, importance }) => {
    const locations = [];
    let matchedAs = null;
    sites.forEach((site) => {
      const hit = matchKeyword(site.text, keyword);
      if (hit) {
        if (!matchedAs) matchedAs = hit;
        locations.push(site.where);
      }
    });
    return { keyword, importance, covered: locations.length > 0, matchedAs, locations };
  });

  const present = details.filter((item) => item.covered).map((item) => item.keyword);
  const missing = details.filter((item) => !item.covered).map((item) => item.keyword);
  const weight = (item) => (item.importance === "preferred" ? PREFERRED_WEIGHT : REQUIRED_WEIGHT);
  const totalWeight = details.reduce((sum, item) => sum + weight(item), 0);
  const coveredWeight = details.filter((item) => item.covered).reduce((sum, item) => sum + weight(item), 0);

  return {
    percent: Math.round((present.length / details.length) * 100),
    weightedScore: totalWeight > 0 ? Math.round((coveredWeight / totalWeight) * 100) : 0,
    present,
    missing,
    details,
  };
}

// --- Evidence support for missing keywords -------------------------------

const SKIP_PROFILE_KEYS = new Set(["id", "evidenceIds", "sha256", "path", "ingestedAt", "schemaVersion", "updatedAt", "createdAt", "sources", "email", "links", "contact"]);
const UNUSABLE_EVIDENCE_STATUS = new Set(["rejected", "superseded"]);

function collectStrings(value, out, key) {
  if (key && SKIP_PROFILE_KEYS.has(key)) return;
  if (typeof value === "string") {
    if (value.trim()) out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, out));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([childKey, child]) => collectStrings(child, out, childKey));
  }
}

/** Evidence entries that can support a claim: source text present, not rejected/superseded, not a job posting. */
function usableEvidence(evidence) {
  return (Array.isArray(evidence) ? evidence : []).filter((entry) => entry
    && !UNUSABLE_EVIDENCE_STATUS.has(entry.status)
    && entry.confidence !== "metadata-only"
    && entry.type !== "job-posting"
    && entry.sourceType !== "job-posting");
}

function evidenceText(entry) {
  return [entry.fact, entry.snippet, entry.quote, ...(Array.isArray(entry.tags) ? entry.tags : [])].filter(isNonBlankString).join(" ");
}

const UNSUPPORTED_NOTE = "no evidence of this in the ledger — ask the candidate before adding";

/**
 * For each keyword, does the candidate's own profile or evidence ledger
 * mention it? `supported: true` means it could be added to the resume (the
 * agent still checks the wording against the cited entries); `false` means do
 * NOT suggest adding it. Uses the same word-boundary and alias matching.
 *
 * @returns {Array<{ keyword: string, supported: boolean, evidenceIds: string[], inProfile: boolean, note: string }>}
 */
function classifyMissingKeywords(keywords, { profile, evidence } = {}) {
  const profileStrings = [];
  collectStrings(profile || {}, profileStrings);
  const profileText = profileStrings.join("\n");
  const entries = usableEvidence(evidence).map((entry) => ({ id: entry.id, text: evidenceText(entry) }));

  return (Array.isArray(keywords) ? keywords : []).filter(isNonBlankString).map((keyword) => {
    const evidenceIds = entries.filter((entry) => entry.id && matchKeyword(entry.text, keyword)).map((entry) => entry.id);
    const inProfile = Boolean(matchKeyword(profileText, keyword));
    const supported = evidenceIds.length > 0 || inProfile;
    return {
      keyword,
      supported,
      evidenceIds,
      inProfile,
      note: supported
        ? `appears in your ${evidenceIds.length > 0 ? "evidence" : "profile"} — could be added where it is true for this role`
        : UNSUPPORTED_NOTE,
    };
  });
}

/**
 * The record stored on a tracked role as role.resume.keywordCoverage:
 * { score, percent, covered: [...], missing: [...], checkedAt, source }.
 */
function buildCoverageRecord(result, support, { checkedAt, source } = {}) {
  const supportByKeyword = new Map((support || []).map((item) => [item.keyword, item]));
  return {
    score: result.weightedScore,
    percent: result.percent,
    covered: result.details.filter((item) => item.covered).map((item) => ({
      keyword: item.keyword,
      importance: item.importance,
      locations: item.locations,
    })),
    missing: result.details.filter((item) => !item.covered).map((item) => {
      const found = supportByKeyword.get(item.keyword);
      return {
        keyword: item.keyword,
        importance: item.importance,
        supported: found ? found.supported : false,
        evidenceIds: found ? found.evidenceIds : [],
      };
    }),
    checkedAt: checkedAt || new Date().toISOString(),
    ...(source ? { source } : {}),
  };
}

module.exports = {
  UNSUPPORTED_NOTE,
  buildCoverageRecord,
  classifyMissingKeywords,
  collectSearchSites,
  normalizeKeywords,
  scoreKeywordCoverage,
  usableEvidence,
};
