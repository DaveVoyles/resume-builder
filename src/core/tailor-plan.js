"use strict";

/**
 * Deterministic tailoring plan. No LLM, no network.
 *
 * Reads a role's stored posting keywords (required / preferred), the
 * candidate's profile.json and evidence.jsonl, and ranks experience entries
 * and their bullets by weighted keyword overlap (required 2, preferred 1,
 * same word-boundary + alias matcher as the coverage score). The agent uses
 * the plan to write the resume config:
 *
 *   - which jobs to include and how many bullets each (resume-config limits),
 *   - skills worth listing first,
 *   - keywords with supporting evidence ids (for evidenceIds / bulletEvidenceIds),
 *   - keywords with no support at all (the do-not-claim list).
 *
 * The plan only reorders and cites what the candidate already has. It never
 * writes text for the resume.
 */

const { classifyMissingKeywords, normalizeKeywords, usableEvidence } = require("./keyword-coverage");
const { isConfirmationNote } = require("./confirmations");
const { matchKeyword } = require("./keyword-match");
const { findPossibleMatches } = require("./possible-matches");
const { LIMITS } = require("./resume-config");

const MAX_JOBS = 4;
const MIN_BULLETS_PER_INCLUDED_JOB = 2;
const SUMMARY_WORD_RESERVE = 120;
const MAX_EVIDENCE_IDS_PER_KEYWORD = 6;
const MAX_OTHER_EVIDENCE = 8;
const WEIGHT = { required: 2, preferred: 1 };

function isNonBlankString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function wordCount(text) {
  return String(text || "").split(/\s+/u).filter(Boolean).length;
}

function scoreText(text, keywords) {
  const matched = [];
  let score = 0;
  keywords.forEach((item) => {
    if (matchKeyword(text, item.keyword)) {
      matched.push(item.keyword);
      score += WEIGHT[item.importance] || WEIGHT.required;
    }
  });
  return { score, matched };
}

function highlightText(highlight) {
  if (typeof highlight === "string") return { text: highlight, evidenceIds: [] };
  if (highlight && isNonBlankString(highlight.text)) {
    return { text: highlight.text, evidenceIds: Array.isArray(highlight.evidenceIds) ? highlight.evidenceIds : [] };
  }
  return null;
}

function profileDates(entry) {
  if (isNonBlankString(entry.dates)) return entry.dates;
  const start = entry.startDate;
  if (!start) return "";
  return `${start} - ${entry.endDate || "Present"}`;
}

/** Experience entries from profile.json (highlights are the bullets). */
function profileJobs(profile) {
  const experience = profile && Array.isArray(profile.experience) ? profile.experience : [];
  return experience
    .map((entry) => ({
      source: "profile",
      title: isNonBlankString(entry.title) ? entry.title : "",
      organization: isNonBlankString(entry.organization) ? entry.organization : isNonBlankString(entry.company) ? entry.company : "",
      dates: profileDates(entry),
      bullets: (Array.isArray(entry.highlights) ? entry.highlights : []).map(highlightText).filter(Boolean),
    }))
    .filter((job) => job.title || job.organization);
}

/**
 * Jobs rebuilt from ingested resume pieces: bullets that share an
 * `organization` + `dateRange` (the job header text) belong to one job.
 */
function evidenceJobs(evidence) {
  const groups = new Map();
  usableEvidence(evidence).forEach((entry) => {
    const kind = entry.metadata && entry.metadata.chunkKind;
    if (!isNonBlankString(entry.organization) || (kind !== "bullet" && kind !== "job-header")) return;
    const key = `${entry.source && entry.source.path}|${entry.organization}|${entry.dateRange || ""}`;
    if (!groups.has(key)) {
      groups.set(key, { source: "evidence", title: entry.organization, organization: "", dates: entry.dateRange || "", bullets: [] });
    }
    if (kind === "bullet" && isNonBlankString(entry.snippet)) {
      groups.get(key).bullets.push({ text: entry.snippet, evidenceIds: [entry.id] });
    }
  });
  return [...groups.values()];
}

function sameJob(a, b) {
  const left = `${a.title} ${a.organization}`.toLowerCase();
  const org = b.organization.toLowerCase();
  return Boolean(org) && left.includes(org);
}

function collectJobs(profile, evidence) {
  const fromProfile = profileJobs(profile);
  const fromEvidence = evidenceJobs(evidence).filter((job) => !fromProfile.some((existing) => sameJob(job, existing) || sameJob(existing, job)));
  return [...fromProfile, ...fromEvidence];
}

function skillName(skill) {
  if (typeof skill === "string") return skill;
  if (skill && isNonBlankString(skill.name)) return skill.name;
  return "";
}

function rankSkills(profile, keywords, supportedKeywords) {
  const skills = (profile && Array.isArray(profile.skills) ? profile.skills : []).map(skillName).filter(Boolean);
  const scored = skills.map((name, index) => ({ name, index, ...scoreText(name, keywords) }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const order = scored.map((item) => ({ name: item.name, score: item.score, matchedKeywords: item.matched }));
  const listed = skills.join("\n");
  const suggestAdd = supportedKeywords.filter((item) => !matchKeyword(listed, item.keyword)).map((item) => item.keyword);
  return { order, suggestAdd };
}

/**
 * @param {object} input
 * @param {{ id: string, company: string, title: string, posting?: object }} input.role
 * @param {object|null} input.profile
 * @param {object[]} input.evidence
 * @returns {object} the plan (JSON-serialisable)
 */
function buildTailorPlan({ role, profile, evidence, now }) {
  const posting = role.posting || {};
  const keywords = normalizeKeywords(posting.keywords);
  const notes = [];
  if (keywords.length === 0) notes.push("This role has no stored posting keywords. Save the posting with add-role --jd-file first.");

  // Keyword support, using the same classifier as the coverage report.
  const support = classifyMissingKeywords(keywords.map((item) => item.keyword), { profile, evidence });
  const importanceOf = new Map(keywords.map((item) => [item.keyword, item.importance]));
  const entryRank = (id) => {
    const found = (evidence || []).find((entry) => entry.id === id);
    if (isConfirmationNote(found)) return -1;
    const kind = found && found.metadata && found.metadata.chunkKind;
    return kind === "bullet" ? 0 : kind ? 1 : 2;
  };
  const supported = support.filter((item) => item.supported).map((item) => ({
    keyword: item.keyword,
    importance: importanceOf.get(item.keyword),
    evidenceIds: [...item.evidenceIds].sort((a, b) => entryRank(a) - entryRank(b)).slice(0, MAX_EVIDENCE_IDS_PER_KEYWORD),
    inProfile: item.inProfile,
    ...(item.confirmed ? { confirmed: true } : {}),
  }));
  // Suggestions only: the person decides. A keyword with a suggestion is not on the do-not-claim list
  // until they say no, but it is not claimable either until they say yes.
  const possibleMatches = findPossibleMatches(support, { evidence }).map((item) => ({ ...item, importance: importanceOf.get(item.keyword) }));
  const suggested = new Set(possibleMatches.map((item) => item.keyword));
  const doNotClaim = support.filter((item) => !item.supported && !suggested.has(item.keyword)).map((item) => ({
    keyword: item.keyword,
    importance: importanceOf.get(item.keyword),
    note: item.note,
    ...(item.declined ? { declined: true } : {}),
  }));
  if (possibleMatches.length > 0) notes.push("keywords.possibleMatches are suggestions only. Ask the person about each one; never put one on the resume until they confirm it.");

  // Rank jobs and bullets.
  const jobs = collectJobs(profile, evidence).map((job, order) => {
    const bullets = job.bullets.map((bullet, position) => ({ ...bullet, position, ...scoreText(bullet.text, keywords) }));
    const header = scoreText(`${job.title} ${job.organization}`, keywords);
    const ranked = [...bullets].sort((a, b) => b.score - a.score || a.position - b.position);
    return { ...job, order, bullets, ranked, header, score: header.score + ranked.slice(0, LIMITS.maxLaterJobBullets).reduce((sum, b) => sum + b.score, 0) };
  });

  const ranking = [...jobs].sort((a, b) => b.score - a.score || a.order - b.order);
  const matching = ranking.filter((job) => job.score > 0).slice(0, MAX_JOBS);
  const chosen = matching.length > 0 ? matching : jobs.slice(0, 2);
  const includeKeys = new Set(chosen.map((job) => job.order));
  // Resume order stays as the profile / resume lists it (newest first), so the
  // first included job gets the larger bullet allowance.
  const inResumeOrder = jobs.filter((job) => includeKeys.has(job.order));

  const educationRows = profile && Array.isArray(profile.education) ? profile.education.length : 0;
  let wordBudget = LIMITS.maxProxyScore - SUMMARY_WORD_RESERVE - 20 * educationRows - 40 * inResumeOrder.length;
  const picks = new Map();
  inResumeOrder.forEach((job, index) => {
    const limit = index === 0 ? LIMITS.maxFirstJobBullets : LIMITS.maxLaterJobBullets;
    let chosenBullets = job.ranked.filter((bullet) => bullet.score > 0).slice(0, limit);
    if (chosenBullets.length < MIN_BULLETS_PER_INCLUDED_JOB) {
      const extra = job.bullets.filter((bullet) => !chosenBullets.includes(bullet)).slice(0, MIN_BULLETS_PER_INCLUDED_JOB - chosenBullets.length);
      chosenBullets = [...chosenBullets, ...extra];
    }
    const kept = [];
    chosenBullets.forEach((bullet) => {
      const words = wordCount(bullet.text);
      if (wordBudget - words >= 0 || kept.length === 0) {
        wordBudget -= words;
        kept.push(bullet);
      }
    });
    picks.set(job.order, { limit, kept: new Set(kept) });
  });

  const planJobs = ranking.map((job, index) => {
    const pick = picks.get(job.order);
    return {
      rank: index + 1,
      source: job.source,
      title: job.title,
      organization: job.organization,
      dates: job.dates,
      score: job.score,
      include: Boolean(pick),
      maxBullets: pick ? pick.limit : 0,
      matchedKeywords: [...new Set([...job.header.matched, ...job.bullets.flatMap((bullet) => bullet.matched)])],
      bullets: job.ranked.map((bullet) => ({
        text: bullet.text,
        score: bullet.score,
        matchedKeywords: bullet.matched,
        evidenceIds: bullet.evidenceIds,
        recommended: Boolean(pick && pick.kept.has(bullet)),
      })),
    };
  });
  if (jobs.length === 0) notes.push("No experience entries found in profile.json or in ingested resume pieces. Run ingest or the intake interview first.");

  // Notes and other evidence that is not part of a job.
  const jobEvidenceIds = new Set(jobs.flatMap((job) => job.bullets.flatMap((bullet) => bullet.evidenceIds)));
  const otherEvidence = usableEvidence(evidence)
    .filter((entry) => !jobEvidenceIds.has(entry.id) && !isConfirmationNote(entry) && !(entry.metadata && entry.metadata.chunkKind === "job-header") && isNonBlankString(entry.snippet))
    .map((entry) => ({ id: entry.id, snippet: entry.snippet.slice(0, 160), ...scoreText(entry.snippet, keywords) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, MAX_OTHER_EVIDENCE)
    .map((item) => ({ id: item.id, score: item.score, matchedKeywords: item.matched, snippet: item.snippet }));

  return {
    schemaVersion: "1.0",
    generatedAt: (now || new Date()).toISOString(),
    role: { id: role.id, company: role.company, title: role.title },
    posting: { path: posting.path || null, keywords: { required: (posting.keywords && posting.keywords.required) || [], preferred: (posting.keywords && posting.keywords.preferred) || [] } },
    limits: { maxFirstJobBullets: LIMITS.maxFirstJobBullets, maxLaterJobBullets: LIMITS.maxLaterJobBullets, maxProxyScore: LIMITS.maxProxyScore },
    jobs: planJobs,
    skills: rankSkills(profile, keywords, supported),
    keywords: { supported, possibleMatches, doNotClaim },
    otherEvidence,
    notes,
  };
}

module.exports = { buildTailorPlan, collectJobs };
