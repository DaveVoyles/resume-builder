"use strict";

/**
 * The person's "general resume": a deterministic, config-shaped baseline built
 * only from their own data (profile.json, plus resume pieces in the evidence
 * ledger when the profile has no experience yet). No LLM, no network.
 *
 * The tailor report compares the tailored resume with this baseline so the
 * person can SEE what changed for the job, and scores the baseline against the
 * same posting keywords so the lift is a number.
 *
 * Shape (the parts of resume-config the comparison reads):
 *   { summary: { text }, experienceSections: [{ heading, jobs: [{ title, company,
 *     dates, bullets, bulletEvidenceIds }] }], skills: [[name, ""]] }
 */

const { buildCoverageRecord, classifyMissingKeywords, scoreKeywordCoverage } = require("./keyword-coverage");
const { collectJobs } = require("./tailor-plan");

const isText = (value) => typeof value === "string" && value.trim() !== "";
const asArray = (value) => (Array.isArray(value) ? value : []);
const norm = (value) => String(value || "").replace(/\s+/gu, " ").trim().toLowerCase();

const SUMMARY_PATTERN = /\bSummary\s+(.+?)\s+(?:Work history|Work experience|Professional experience|Experience|Employment|Skills|Education)\b/iu;

function summaryOf(profile, evidence) {
  const own = profile && (typeof profile.summary === "string" ? profile.summary : profile.summary && profile.summary.text);
  if (isText(own)) return own.replace(/\s+/gu, " ").trim();
  for (const entry of asArray(evidence)) {
    if (!entry || entry.type !== "resume" || (entry.metadata && entry.metadata.chunkKind) || !isText(entry.snippet)) continue;
    const match = entry.snippet.match(SUMMARY_PATTERN);
    if (match) return match[1].trim();
  }
  return "";
}

function skillName(skill) {
  if (typeof skill === "string") return skill;
  return skill && isText(skill.name) ? skill.name : "";
}

/**
 * @param {{ profile?: object|null, evidence?: object[], config?: object }} input
 *   `config` (the tailored resume) only aligns job names: an ingested job
 *   header like "Office Manager, Riverside Dental" takes the tailored job's
 *   title and company when it names the same employer.
 * @returns {object|null} a config-shaped baseline, or null when there is nothing to build from
 */
function buildGeneralResume({ profile, evidence, config } = {}) {
  const tailoredJobs = asArray(config && config.experienceSections).flatMap((section) => asArray(section && section.jobs));
  const jobs = collectJobs(profile || null, asArray(evidence))
    .filter((job) => job.bullets.length > 0)
    .map((job) => {
      const label = norm(`${job.title} ${job.organization}`);
      const aligned = tailoredJobs.find((tailored) => isText(tailored.company) && label.includes(norm(tailored.company)));
      return {
        title: aligned ? aligned.title : job.title,
        company: aligned ? aligned.company : job.organization,
        dates: job.dates,
        bullets: job.bullets.map((bullet) => bullet.text),
        bulletEvidenceIds: job.bullets.map((bullet) => asArray(bullet.evidenceIds)),
      };
    });

  const summary = summaryOf(profile, evidence);
  const skills = asArray(profile && profile.skills).map(skillName).filter(Boolean).map((name) => [name, ""]);
  if (!summary && jobs.length === 0 && skills.length === 0) return null;

  return {
    ...(summary ? { summary: { text: summary } } : {}),
    experienceSections: jobs.length ? [{ heading: "Experience", jobs }] : [],
    skills,
  };
}

/**
 * Keyword coverage of `baselineConfig` against the same keywords a stored
 * role.resume.keywordCoverage record covers, in the same record shape.
 * Returns null when there are no keywords or no baseline.
 */
function computeBaselineCoverage({ keywordCoverage, baselineConfig, profile, evidence, source, checkedAt }) {
  if (!baselineConfig || !keywordCoverage || typeof keywordCoverage !== "object") return null;
  const required = [];
  const preferred = [];
  for (const item of [...asArray(keywordCoverage.covered), ...asArray(keywordCoverage.missing)]) {
    const keyword = isText(item) ? item : item && item.keyword;
    if (!isText(keyword)) continue;
    (item && item.importance === "preferred" ? preferred : required).push(keyword);
  }
  if (required.length + preferred.length === 0) return null;
  const result = scoreKeywordCoverage({ required, preferred }, baselineConfig);
  const support = classifyMissingKeywords(result.missing, { profile, evidence });
  return buildCoverageRecord(result, support, { checkedAt, source });
}

module.exports = { buildGeneralResume, computeBaselineCoverage };
