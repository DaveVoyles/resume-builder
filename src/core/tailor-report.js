"use strict";

/**
 * Plain-language per-role report written after `tailor`:
 * <workspace>/outputs/tailor-reports/<role-id>.md
 *
 * buildTailorReport() is a pure function from stored data to markdown. The
 * person reading it is a working professional, not a developer: no command
 * names, no file formats they have to know, workspace-relative paths only.
 * Every warning that needs a yes/no from the candidate is phrased as a
 * question. See docs/playbooks/tailor.md.
 *
 * Stored data it reads defensively (either may be absent):
 *   role.resume.keywordCoverage = { score, weightedScore?, covered: [{ keyword, where }],
 *                                   missing: [{ keyword, supported }], checkedAt }
 *   role.resume.pageCount       = { pages, checkedAt }
 */

const fs = require("fs");
const path = require("path");
const { auditResumeConfig, collectConfigClaimSites } = require("./claim-audit");
const { auditFacts } = require("./fact-audit");
const { buildGeneralResume, computeBaselineCoverage } = require("./general-resume");
const { classifyMissingKeywords } = require("./keyword-coverage");
const { matchKeyword } = require("./keyword-match");
const { renderHtmlTailorReport } = require("../renderers/html-tailor-report");
const { loadResumeConfig } = require("./resume-config");
const { lintConfig } = require("./style-lint");
const { readJson, readJsonLines } = require("./workspace");

const REPORT_DIR = "outputs/tailor-reports";
const STATUS = { ready: "Ready to review", draft: "Draft made; job match not checked yet", confirm: "Needs your confirmation", blocked: "Blocked" };
const MAX_CHANGES = 8;
const LOW_CONFIDENCE = new Set(["low", "medium", "uncertain", "unverified", "inferred"]);

const isText = (value) => typeof value === "string" && value.trim() !== "";
const asArray = (value) => (Array.isArray(value) ? value : []);

function reportRelativePath(roleId, extension = "md") {
  const safe = String(roleId || "role").replace(/[^A-Za-z0-9._-]+/gu, "-").replace(/^\.+/u, "") || "role";
  return `${REPORT_DIR}/${safe}.${extension}`;
}

// Keeps the person's record out of file-name jargon.
function plain(text) {
  return String(text || "")
    .replace(/\bevidence\.jsonl\b/gu, "your record")
    .replace(/\bprofile\.json\b/gu, "your profile")
    .replace(/\bbulletEvidenceIds\b|\bevidenceIds\b/gu, "the source link")
    .replace(/\bEvidence ledger\b/gu, "Your record")
    .replace(/\bevidence entr(y|ies)\b/gu, (m, end) => (end === "y" ? "note" : "notes"))
    .replace(/\s+/gu, " ")
    .trim();
}

function oneLine(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function quoteList(list) {
  return list.map((item) => `"${item}"`).join(", ");
}

// ---------------------------------------------------------------------------
// Locations in plain words
// ---------------------------------------------------------------------------

const PATH_PATTERN = /(summary\.text|experienceSections\[\d+\]\.jobs\[\d+\](?:\.bullets\[\d+\])?|skills\[\d+\]\.(?:name|description)|education\[\d+\])/u;

function describeWhere(location, config) {
  const text = String(location || "");
  if (text === "summary.text") return "your summary";
  let match = text.match(/^experienceSections\[(\d+)\]\.jobs\[(\d+)\](?:\.bullets\[(\d+)\])?/u);
  if (match) {
    const job = asArray(asArray(config && config.experienceSections)[Number(match[1])]?.jobs)[Number(match[2])] || {};
    const role = [job.title, job.company].filter(isText).join(" at ");
    const label = role ? `your ${role} job` : `job ${Number(match[2]) + 1}`;
    return match[3] !== undefined ? `bullet ${Number(match[3]) + 1} under ${label}` : label;
  }
  match = text.match(/^skills\[(\d+)\]/u);
  if (match) {
    const row = asArray(config && config.skills)[Number(match[1])];
    return Array.isArray(row) && isText(row[0]) ? `the skills line "${row[0]}"` : `skills line ${Number(match[1]) + 1}`;
  }
  match = text.match(/^education\[(\d+)\]/u);
  if (match) {
    const entry = asArray(config && config.education)[Number(match[1])];
    return entry && isText(entry.institution) ? `your education entry for ${entry.institution}` : "your education section";
  }
  return "the resume";
}

function whereFromMessage(message, config) {
  const match = String(message).match(PATH_PATTERN);
  return { path: match ? match[1] : "", where: match ? describeWhere(match[1], config) : "the resume" };
}

function quotedParts(text) {
  return [...String(text).matchAll(/"([^"]+)"/gu)].map((m) => m[1]);
}

// ---------------------------------------------------------------------------
// Problems that stop the resume (claim audit and fact audit errors)
// ---------------------------------------------------------------------------

// The profile's wording in "... but profile.json says "A" or "B"; ..." messages.
function profileSays(text) {
  const segment = (String(text).split("profile.json says ")[1] || "").split(/;|\.\s/u)[0];
  return quotedParts(segment).map((q) => `"${q}"`).join(" or ");
}

function explainError(message, config) {
  const text = String(message);
  const { where } = whereFromMessage(text, config);
  const quoted = quotedParts(text);

  if (/^Unsupported claim at /u.test(text) || /^Claim not backed by its listed evidence at /u.test(text)) {
    const figure = quoted.find((q) => /\d/u.test(q)) || quoted[0] || "a figure";
    return {
      type: "unsupported-claim",
      question: `Where does "${figure}" in ${where} come from? I can't find it in your past resumes or notes. If it's true, tell me where it's from and I'll record it. If not, I'll reword the line without the number.`,
    };
  }
  if (/^Unknown evidence id at /u.test(text)) {
    const ids = (text.match(/:\s*([^\s].*?) is not in/u) || [])[1] || "a note";
    return {
      type: "unknown-source",
      question: `${where.charAt(0).toUpperCase()}${where.slice(1)} points to a note I can't find (${ids}). I'll fix the link. Is that the right note, or did you mean a different one?`,
    };
  }
  if (/^Employer not found /u.test(text)) {
    return {
      type: "employer",
      question: `Your resume lists ${quoted[0] ? `"${quoted[0]}"` : "an employer"} (${where}), but I can't find it in your profile or notes. Did you work there? If yes, tell me the dates and I'll add it to your record. If not, I'll take it off the resume.`,
    };
  }
  if (/^Job title does not match /u.test(text)) {
    return {
      type: "title",
      question: `The resume says your title was "${quoted[0] || ""}" (${where}), but your profile says ${profileSays(text) || "something different"}. Which one is right?`,
    };
  }
  if (/^(Start date|End date|Dates fall outside)/u.test(text)) {
    return {
      type: "dates",
      question: `The dates "${quoted[0] || ""}" on ${where} don't match your profile. Which dates are right? I'll fix whichever one is wrong.`,
    };
  }
  if (/^Education not found /u.test(text)) {
    return {
      type: "education",
      question: `Your resume lists ${quoted[0] ? `"${quoted[0]}"` : "a school"} (${where}), but I can't find it in your profile or notes. Is it right? If yes, tell me the degree and year. If not, I'll remove it.`,
    };
  }
  if (/^Degree does not match /u.test(text)) {
    return {
      type: "degree",
      question: `The resume says "${quoted[0] || ""}" for ${quoted[1] || "your school"}, but your profile says ${profileSays(text) || "something different"}. Which degree is right?`,
    };
  }
  if (/^Unsupported scope claim /u.test(text)) {
    const verb = quoted[0] || "that";
    const soften = (text.match(/soften to "([^"]+)"/u) || [])[1] || "contributed to";
    return {
      type: "scope",
      question: `Did you really ${verb === "that" ? "do" : `"${verb}"`} this work (${where})? I can't find anything that backs it up. If yes, tell me a little about it and I'll record it. If not, I'll soften it to "${soften}".`,
    };
  }
  return { type: "other", question: `${plain(text)} What would you like me to do about this?` };
}

// ---------------------------------------------------------------------------
// Warnings that need the candidate's yes/no
// ---------------------------------------------------------------------------

function explainWarning(message, config) {
  const text = String(message);
  const { where } = whereFromMessage(text, config);

  if (/^Not tied to specific evidence at /u.test(text)) {
    const claims = quotedParts((text.split(" matches something")[0] || "").replace(/^.*?: /u, ""));
    return {
      type: "unbound-claim",
      question: `Which job or note backs ${claims.length ? quoteList(claims) : "the number"} in ${where}? It matches something in your record, but I can't tell which entry it came from. Tell me which one and I'll tie the number to it.`,
    };
  }
  if (/^Tool or technology not found /u.test(text)) {
    const tools = quotedParts(text.replace(/^[^:]*: /u, "").split(" — ")[0]);
    return {
      type: "tool",
      question: `Have you used ${tools.length ? quoteList(tools) : "the tool named"} in ${where}? I can't find ${tools.length === 1 ? "it" : "them"} in your profile or past material. If yes, tell me where and roughly when. If not, I'll take ${tools.length === 1 ? "it" : "them"} out.`,
    };
  }
  return null;
}

function lowConfidenceQuestions(config, evidence) {
  const byId = new Map(asArray(evidence).map((entry) => [entry && entry.id, entry]));
  const seen = new Set();
  const questions = [];
  for (const site of collectConfigClaimSites(config || {})) {
    for (const id of site.evidenceIds || []) {
      const entry = byId.get(id);
      if (!entry || seen.has(`${id}|${site.path}`)) continue;
      const reviewNeeded = entry.status === "needs-confirmation" || asArray(entry.restrictions).some((r) => r && r.type === "candidate-review");
      if (!LOW_CONFIDENCE.has(String(entry.confidence || "").toLowerCase()) && !reviewNeeded) continue;
      seen.add(`${id}|${site.path}`);
      const said = oneLine(entry.snippet || entry.fact).slice(0, 120);
      questions.push({
        type: "low-confidence",
        question: `${describeWhere(site.path, config).replace(/^./u, (c) => c.toUpperCase())} rests on a note I'm not fully sure about${said ? ` ("${said}")` : ""}. Is it accurate as written?`,
      });
    }
  }
  return questions;
}

// ---------------------------------------------------------------------------
// Style findings
// ---------------------------------------------------------------------------

function styleFinding(finding, config) {
  const quoted = quotedParts(finding.description);
  const field = finding.source && PATH_PATTERN.test(String(finding.source).replace(/^experience\[/u, "experienceSections["))
    ? describeWhere(String(finding.source).replace(/^experience\[/u, "experienceSections["), config)
    : oneLine(finding.sourceLabel) || "the resume";
  const label = field.replace(/^./u, (c) => c.toUpperCase());
  if (finding.type === "buzzword") {
    return `${label}: stock phrases that read like boilerplate (${quoteList(quoted)}). Fix: say what you actually did, in the words you'd use out loud.`;
  }
  if (finding.type === "uniformity") {
    return `${label}: the sentences are all about the same length, which reads as machine-written. Fix: mix one short sentence with a longer one.`;
  }
  if (/starters/u.test(finding.description || "")) {
    return `${label}: several lines open the same way (${quoteList(quoted)}). Fix: start each line with a different action.`;
  }
  return `${label}: some words repeat (${quoteList(quoted)}). Fix: use a different word or combine the lines.`;
}

// ---------------------------------------------------------------------------
// Keyword coverage and page count (stored on the role by other steps)
// ---------------------------------------------------------------------------

function keywordName(item) {
  return isText(item) ? item.trim() : item && isText(item.keyword) ? item.keyword.trim() : "";
}

// Stored coverage locations look like "summary", "bullet 2 of <job>", "skills: <row>".
// The person only needs the kind of place, once each.
function placeKind(location) {
  const text = String(location).trim();
  if (/^summary/iu.test(text)) return "summary";
  if (/^bullet\s+\d/iu.test(text)) return "bullet";
  if (/^skills:/iu.test(text)) return "skills";
  return text;
}

function coveragePlaces(where) {
  const list = Array.isArray(where) ? where : [where];
  return [...new Set(list.filter(isText).map(placeKind))];
}

function readKeywordCoverage(input) {
  const stored = input.keywordCoverage !== undefined ? input.keywordCoverage : input.role && input.role.resume && input.role.resume.keywordCoverage;
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return null;
  const covered = asArray(stored.covered)
    .map((item) => ({ keyword: keywordName(item), places: coveragePlaces(item && (item.where !== undefined ? item.where : item.locations)) }))
    .filter((item) => item.keyword);
  const missing = asArray(stored.missing)
    .map((item) => ({ keyword: keywordName(item), supported: Boolean(item && typeof item === "object" && item.supported) }))
    .filter((item) => item.keyword);
  // `percent` is the plain share of keywords found (the number shown everywhere);
  // `score` is the weighted one, used only when no plain percent was stored.
  const raw = stored.percent !== undefined ? Number(stored.percent) : Number(stored.score);
  const percent = Number.isFinite(raw) ? Math.round(raw <= 1 && stored.percent === undefined ? raw * 100 : raw) : null;
  return { percent, covered, missing, checkedAt: isText(stored.checkedAt) ? stored.checkedAt : "" };
}

function readPageCount(input) {
  const stored = input.pageCount !== undefined ? input.pageCount : input.role && input.role.resume && input.role.resume.pageCount;
  const pages = stored && typeof stored === "object" ? Number(stored.pages) : Number(stored);
  return Number.isFinite(pages) && pages > 0 ? { pages, checkedAt: stored && isText(stored.checkedAt) ? stored.checkedAt : "" } : null;
}

// ---------------------------------------------------------------------------
// What changed for this job (deterministic comparison with a baseline)
//
// The baseline is the resume's own `extends` parent / base.json when there is
// one, else the person's general resume (src/core/general-resume.js).
// ---------------------------------------------------------------------------

function snippet(text, words = 8) {
  const parts = oneLine(text).replace(/[.;,]+$/u, "").split(" ");
  return parts.length > words ? `${parts.slice(0, words).join(" ")}...` : parts.join(" ");
}

const normText = (text) => oneLine(text).toLowerCase();

function jobsOf(config) {
  const jobs = [];
  for (const section of asArray(config && config.experienceSections)) {
    for (const job of asArray(section && section.jobs)) jobs.push(job || {});
  }
  return jobs;
}

const jobKey = (job) => `${normText(job.title)}|${normText(job.company)}`;
const jobLabel = (job) => [job.title, job.company].filter(isText).join(" at ") || "a job";

function skillItems(config) {
  const items = new Map();
  for (const row of asArray(config && config.skills)) {
    if (!Array.isArray(row)) continue;
    if (isText(row[0])) items.set(normText(row[0]), oneLine(row[0]));
    if (isText(row[1])) row[1].split(/[,;]/u).map(oneLine).filter(Boolean).forEach((item) => items.set(normText(item), item));
  }
  return items;
}

function summaryTextOf(config) {
  return config && config.summary && isText(config.summary.text) ? oneLine(config.summary.text) : "";
}

const wordSet = (text) => new Set(normText(text).replace(/[^a-z0-9% ]+/gu, " ").split(" ").filter((word) => word.length > 2));

// Share of words two lines have in common: how we tell a reworded bullet from a new one.
function similarity(a, b) {
  const left = wordSet(a);
  const right = wordSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  left.forEach((word) => { if (right.has(word)) shared += 1; });
  return shared / (left.size + right.size - shared);
}

const REWORD_THRESHOLD = 0.5;
const MAX_WHY_KEYWORDS = 3;

/**
 * Why an edit was made, from data we hold: posting keywords the new text uses
 * (that the old text did not), and the notes behind it. `ctx` carries
 * { keywords: string[], evidenceById: Map }.
 */
function whyFor(text, previous, evidenceIds, ctx) {
  const used = ctx.keywords.filter((keyword) => matchKeyword(text, keyword));
  const fresh = previous ? used.filter((keyword) => !matchKeyword(previous, keyword)) : used;
  const ids = [...new Set(asArray(evidenceIds).filter(isText))];
  const sources = [...new Set(ids.map((id) => {
    const entry = ctx.evidenceById.get(id);
    const file = entry && entry.source && entry.source.path;
    return isText(file) ? path.basename(file) : "";
  }).filter(Boolean))];
  return { keywords: (fresh.length ? fresh : used).slice(0, MAX_WHY_KEYWORDS), evidenceIds: ids.slice(0, 2), sources };
}

function whyText(why) {
  if (!why) return "";
  const parts = [];
  if (why.keywords.length) parts.push(`uses ${quoteList(why.keywords)} from the posting`);
  if (why.evidenceIds.length) parts.push(`backed by evidence ${why.evidenceIds.join(", ")}`);
  return parts.join("; ");
}

function jobDiff(job, before, ctx) {
  const label = jobLabel(job);
  const nowBullets = asArray(job.bullets).map((text, index) => ({ text, ids: asArray(asArray(job.bulletEvidenceIds)[index]) })).filter((b) => isText(b.text));
  const beforeBullets = asArray(before.bullets).map((text, index) => ({ text, ids: asArray(asArray(before.bulletEvidenceIds)[index]) })).filter((b) => isText(b.text));
  const beforeSet = new Set(beforeBullets.map((b) => normText(b.text)));
  const nowSet = new Set(nowBullets.map((b) => normText(b.text)));
  const added = nowBullets.filter((b) => !beforeSet.has(normText(b.text)));
  const removed = beforeBullets.filter((b) => !nowSet.has(normText(b.text)));

  const items = [];
  const unpaired = [...removed];
  const fresh = [];
  for (const bullet of added) {
    let best = -1;
    let bestScore = REWORD_THRESHOLD;
    unpaired.forEach((candidate, index) => {
      const score = similarity(bullet.text, candidate.text);
      if (score >= bestScore) { best = index; bestScore = score; }
    });
    if (best === -1) { fresh.push(bullet); continue; }
    const [old] = unpaired.splice(best, 1);
    items.push({ type: "reworded", before: old.text, after: bullet.text, why: whyFor(bullet.text, old.text, bullet.ids.length ? bullet.ids : old.ids, ctx) });
  }
  fresh.forEach((bullet) => items.push({ type: "added", after: bullet.text, why: whyFor(bullet.text, "", bullet.ids, ctx) }));

  const keptNow = nowBullets.filter((b) => beforeSet.has(normText(b.text)));
  const keptBefore = beforeBullets.filter((b) => nowSet.has(normText(b.text)));
  keptNow.forEach((bullet, index) => {
    const was = keptBefore.findIndex((b) => normText(b.text) === normText(bullet.text));
    if (was > index) {
      const source = keptBefore[was];
      items.push({ type: "promoted", position: index, after: bullet.text, why: whyFor(bullet.text, "", bullet.ids.length ? bullet.ids : source.ids, ctx) });
    }
  });
  unpaired.forEach((bullet) => items.push({ type: "removed", before: bullet.text }));
  return { label, items };
}

/**
 * Structured edits of `config` against `baseConfig`. `ctx` is
 * { keywords: string[], evidenceById: Map }.
 */
function buildDiff(config, baseConfig, ctx) {
  const diff = { summary: null, jobs: [], jobsAdded: [], jobsLeftOut: [], skills: null };

  const before = summaryTextOf(baseConfig);
  const now = summaryTextOf(config);
  if (now && !before) diff.summary = { type: "added", before: "", after: now, why: whyFor(now, "", [], ctx) };
  else if (now && normText(now) !== normText(before)) diff.summary = { type: "reworded", before, after: now, why: whyFor(now, before, [], ctx) };
  else if (!now && before) diff.summary = { type: "removed", before, after: "" };

  const baseJobs = new Map(jobsOf(baseConfig).map((job) => [jobKey(job), job]));
  for (const job of jobsOf(config)) {
    const match = baseJobs.get(jobKey(job));
    const bullets = asArray(job.bullets).filter(isText);
    if (!match) {
      if (bullets.length) diff.jobsAdded.push({ label: jobLabel(job), count: bullets.length });
      continue;
    }
    const jobChanges = jobDiff(job, match, ctx);
    if (jobChanges.items.length) diff.jobs.push(jobChanges);
  }
  const nowKeys = new Set(jobsOf(config).map(jobKey));
  for (const job of jobsOf(baseConfig)) {
    if (!nowKeys.has(jobKey(job))) diff.jobsLeftOut.push(jobLabel(job));
  }

  const baseSkills = skillItems(baseConfig);
  const addedSkills = [...skillItems(config)].filter(([key]) => !baseSkills.has(key)).map(([, label]) => label);
  const commonNow = asArray(config && config.skills).map((row) => normText(Array.isArray(row) ? row[0] : "")).filter((name) => name && baseSkills.has(name));
  const commonBefore = asArray(baseConfig && baseConfig.skills).map((row) => normText(Array.isArray(row) ? row[0] : "")).filter((name) => name && commonNow.includes(name));
  const reordered = commonNow.length > 1 && commonNow.join("|") !== commonBefore.join("|");
  if (addedSkills.length || reordered) {
    const why = { keywords: ctx.keywords.filter((keyword) => addedSkills.some((skill) => matchKeyword(skill, keyword))).slice(0, MAX_WHY_KEYWORDS), evidenceIds: [], sources: [] };
    diff.skills = { added: addedSkills, reordered, why };
  }
  return diff;
}

function isEmptyDiff(diff) {
  return !diff.summary && diff.jobs.length === 0 && diff.jobsAdded.length === 0 && diff.jobsLeftOut.length === 0 && !diff.skills;
}

// One plain line per edit (grouped per job), each with its reason when known.
function diffLines(diff) {
  const lines = [];
  const withWhy = (line, why) => {
    const reason = whyText(why);
    return reason ? `${line} Why: ${reason}.` : line;
  };
  if (diff.summary) {
    const { type, after, why } = diff.summary;
    if (type === "added") lines.push(withWhy(`Added a summary: "${snippet(after, 14)}".`, why));
    else if (type === "reworded") lines.push(withWhy(`Reworded the summary to: "${snippet(after, 14)}".`, why));
    else lines.push("Removed the summary.");
  }
  for (const job of diff.jobs) {
    const of = (type) => job.items.filter((item) => item.type === type);
    for (const item of of("reworded")) lines.push(withWhy(`Reworded a bullet under ${job.label}: "${snippet(item.before)}" became "${snippet(item.after, 12)}".`, item.why));
    const added = of("added");
    if (added.length) lines.push(withWhy(`Added ${added.length === 1 ? "a bullet" : `${added.length} bullets`} under ${job.label}: "${snippet(added[0].after)}".`, added[0].why));
    const removed = of("removed");
    if (removed.length) lines.push(`Removed ${removed.length === 1 ? "a bullet" : `${removed.length} bullets`} under ${job.label}: "${snippet(removed[0].before)}".`);
    const promoted = of("promoted");
    if (promoted.length) lines.push(withWhy(`Reordered the bullets under ${job.label} so "${snippet(promoted[0].after)}" comes ${promoted[0].position === 0 ? "first" : "earlier"}.`, promoted[0].why));
  }
  diff.jobsAdded.forEach((job) => lines.push(`Added ${job.label} with ${job.count} ${job.count === 1 ? "bullet" : "bullets"}.`));
  diff.jobsLeftOut.forEach((label) => lines.push(`Left out ${label}.`));
  if (diff.skills) {
    const { added, reordered, why } = diff.skills;
    if (added.length) lines.push(withWhy(`Added to skills: ${added.slice(0, 6).join(", ")}${added.length > 6 ? ", and more" : ""}.`, why));
    if (reordered) lines.push("Reordered the skills lines.");
  }
  return lines;
}

function keywordPlaces(coverage) {
  const label = { summary: "summary", bullet: "a bullet", skills: "skills" };
  return (coverage ? coverage.covered : []).map((item) => ({
    keyword: item.keyword,
    where: item.places.length ? item.places.map((kind) => label[kind] || kind).join(" and ") : "the resume",
  }));
}

/**
 * Plain-language edits of `config` against its baseline.
 * `baseline` is { config, kind: "base" | "general" } or null.
 * Returns { hasBase, kind, baselineLabel, diff, lines, keywordLines }.
 */
function describeChanges(config, baseline, coverage, ctx) {
  const keywordLines = keywordPlaces(coverage).slice(0, 8).map((p) => `${p.keyword}: now in ${p.where}`);
  if (!baseline) return { hasBase: false, kind: "none", baselineLabel: "", diff: null, lines: [], keywordLines };
  const diff = buildDiff(config, baseline.config, ctx);
  const lines = diffLines(diff);
  if (lines.length === 0) {
    lines.push(baseline.kind === "general"
      ? "No wording changes: this resume matches your general resume."
      : "No wording changes: this resume matches the one it was based on.");
  }
  return {
    hasBase: true,
    kind: baseline.kind,
    baselineLabel: baseline.kind === "general" ? "Your general resume" : "The resume this one was based on",
    diff,
    lines: lines.slice(0, MAX_CHANGES),
    keywordLines,
  };
}

// ---------------------------------------------------------------------------
// Coverage lift: baseline vs tailored, against the posting's keywords
// ---------------------------------------------------------------------------

const PLACE_WORDS = { summary: "summary", bullet: "a bullet", skills: "skills" };

function evidenceSources(ids, evidenceById) {
  return [...new Set(ids.map((id) => {
    const entry = evidenceById.get(id);
    const file = entry && entry.source && entry.source.path;
    return isText(file) ? path.basename(file) : "";
  }).filter(Boolean))];
}

function coverageNumbers(read, fallbackTotal) {
  const total = read.covered.length + read.missing.length || fallbackTotal;
  const percent = read.percent !== null ? read.percent : total ? Math.round((read.covered.length / total) * 100) : 0;
  return { covered: read.covered.length, total, percent };
}

/**
 * Null unless both a tailored coverage and a baseline coverage record exist.
 * A keyword is only listed as gained; `supported` says whether the person's own
 * record backs it (an unsupported gain becomes a question in the report).
 */
function buildLift(coverage, baselineRecord, baseline, profile, evidence, evidenceById) {
  if (!coverage || !baselineRecord || !baseline) return null;
  const base = readKeywordCoverage({ keywordCoverage: baselineRecord });
  if (!base) return null;
  const baseCovered = new Set(base.covered.map((item) => item.keyword.toLowerCase()));
  const nowCovered = new Set(coverage.covered.map((item) => item.keyword.toLowerCase()));
  const gainedItems = coverage.covered.filter((item) => !baseCovered.has(item.keyword.toLowerCase()));
  const support = new Map(classifyMissingKeywords(gainedItems.map((item) => item.keyword), { profile, evidence }).map((item) => [item.keyword, item]));
  const tailored = coverageNumbers(coverage);
  const original = coverageNumbers(base, tailored.total);
  return {
    kind: baseline.kind,
    label: baseline.kind === "general" ? "Your general resume" : "The resume this one was based on",
    baseline: original,
    tailored,
    liftPoints: tailored.percent - original.percent,
    gained: gainedItems.map((item) => {
      const found = support.get(item.keyword);
      const ids = found ? found.evidenceIds.slice(0, 2) : [];
      return {
        keyword: item.keyword,
        where: item.places.length ? item.places.map((kind) => PLACE_WORDS[kind] || kind).join(" and ") : "the resume",
        supported: found ? found.supported : false,
        evidenceIds: ids,
        sources: evidenceSources(ids, evidenceById),
      };
    }),
    lost: base.covered.filter((item) => !nowCovered.has(item.keyword.toLowerCase())).map((item) => item.keyword),
    stillMissing: coverage.missing.map((item) => ({ keyword: item.keyword, supported: item.supported })),
  };
}

function liftSentence(lift) {
  const who = lift.kind === "general" ? "Your general resume" : "The resume this one was based on";
  return `${who} covers ${lift.baseline.covered} of ${lift.baseline.total} keywords (${lift.baseline.percent}%). This resume covers ${lift.tailored.covered} of ${lift.tailored.total} (${lift.tailored.percent}%).`;
}

// Where to cut when the resume runs long: the oldest job with the most bullets.
function trimSuggestion(config) {
  let pick = null;
  jobsOf(config).forEach((job) => {
    const count = asArray(job.bullets).length;
    if (count > 1 && (!pick || count >= pick.count)) pick = { job, count };
  });
  return pick ? `the weakest bullets under ${jobLabel(pick.job)} first, then the summary` : "the summary and the longest bullets";
}

// ---------------------------------------------------------------------------
// Analysis and rendering
// ---------------------------------------------------------------------------

function analyzeTailorReport(input) {
  const config = input.config && typeof input.config === "object" ? input.config : {};
  const evidence = asArray(input.evidence);
  const claimAudit = input.claimAudit || (input.config ? auditResumeConfig(config, evidence) : { errors: [], warnings: [], claimsFound: [] });
  const factAudit = input.factAudit || (input.config ? auditFacts(config, input.profile || null, evidence) : { errors: [], warnings: [] });
  const styleLint = input.styleLint || (input.config ? lintConfig(config, "resume") : { findings: [] });

  const errors = [...new Set([...asArray(claimAudit.errors), ...asArray(factAudit.errors), ...asArray(input.blockedErrors)])];
  const warnings = [...new Set([...asArray(claimAudit.warnings), ...asArray(factAudit.warnings)])];

  const problems = errors.map((message) => explainError(message, config));
  const questions = [];
  const notes = [];
  for (const message of warnings) {
    const explained = explainWarning(message, config);
    if (explained) questions.push(explained);
    else notes.push(plain(message));
  }
  questions.push(...lowConfidenceQuestions(config, evidence));

  const coverage = readKeywordCoverage(input);
  if (coverage) {
    for (const item of coverage.missing.filter((m) => !m.supported)) {
      questions.push({
        type: "keyword",
        question: `The posting asks for "${item.keyword}", and I found nothing in your record that shows it. Have you done this? If yes, tell me where and I'll add it. If not, we leave it off.`,
      });
    }
  }
  // Baseline: the resume's own parent when it has one, else the person's general resume.
  const baseConfig = input.baseConfig && typeof input.baseConfig === "object" ? input.baseConfig : null;
  const generalConfig = baseConfig ? null : input.generalConfig !== undefined ? input.generalConfig : buildGeneralResume({ profile: input.profile, evidence, config });
  const baseline = baseConfig ? { config: baseConfig, kind: "base" } : generalConfig ? { config: generalConfig, kind: "general" } : null;
  const evidenceById = new Map(evidence.map((entry) => [entry && entry.id, entry]));
  const storedCoverage = input.keywordCoverage !== undefined ? input.keywordCoverage : input.role && input.role.resume && input.role.resume.keywordCoverage;
  const keywords = coverage ? [...coverage.covered, ...coverage.missing].map((item) => item.keyword) : [];
  const baselineCoverage = baseline && coverage
    ? computeBaselineCoverage({
        keywordCoverage: storedCoverage,
        baselineConfig: baseline.config,
        profile: input.profile,
        evidence,
        source: baseline.kind === "general" ? "general-resume" : "base-config",
        checkedAt: coverage.checkedAt || undefined,
      })
    : null;
  const lift = buildLift(coverage, baselineCoverage, baseline, input.profile, evidence, evidenceById);
  if (lift && (evidence.length > 0 || input.profile)) {
    for (const item of lift.gained.filter((g) => !g.supported)) {
      questions.push({
        type: "keyword-source",
        question: `The resume now mentions "${item.keyword}" (in ${item.where}), and I can't find it in your record. Is that true for you? If yes, tell me where it comes from. If not, I'll take it out.`,
      });
    }
  }

  const pages = readPageCount(input);
  if (pages && pages.pages > 1) {
    questions.push({
      type: "length",
      question: `The resume runs to ${pages.pages} pages. Do you want me to trim it to one? Tell me anything you'd rather keep.`,
    });
  }

  const notDone = [];
  if (!coverage) notDone.push("Give me the job posting text so I can check how well the resume matches it.");
  if (!pages) notDone.push("Ask me to check the page count so I can tell you whether it fits on one page.");

  const status = problems.length > 0 ? STATUS.blocked : questions.length > 0 ? STATUS.confirm : !coverage ? STATUS.draft : STATUS.ready;
  const changes = describeChanges(config, baseline, coverage, { keywords, evidenceById });
  return { config, claimAudit, factAudit, styleLint, problems, questions, notes, coverage, pages, notDone, changes, lift, baselineCoverage, status };
}

const GAP_TYPES = {
  PresentationGap: "you have this, but it isn't visible yet",
  WeakEvidence: "you mention it, but the proof is thin",
  AdjacentSkill: "a close skill you could connect",
  TrueGap: "not in your background so far",
};

function pathLine(label, value) {
  return isText(value) ? `- ${label}: \`${String(value).replace(/\\/gu, "/")}\`` : null;
}

// "What the checks found": [{ text, sub: [text] }], shared by the .md and .html reports.
function checkItems(analysis) {
  const { config, problems, notes } = analysis;
  const items = [];
  const claimsChecked = asArray(analysis.claimAudit.claimsFound).length;
  items.push({ text: `Numbers and figures: I checked ${claimsChecked} ${claimsChecked === 1 ? "figure" : "figures"} against your past resumes and notes.`, sub: [] });
  const jobCount = asArray(config.experienceSections).reduce((sum, section) => sum + asArray(section && section.jobs).length, 0);
  const schoolCount = asArray(config.education).length;
  const factProblems = problems.filter((p) => ["employer", "title", "dates", "education", "degree"].includes(p.type)).length;
  items.push({
    text:
      `Employers, titles and dates: I compared ${jobCount} job${jobCount === 1 ? "" : "s"} and ${schoolCount} school${schoolCount === 1 ? "" : "s"} with your profile. ` +
      (factProblems === 0 ? "They agree." : `${factProblems} ${factProblems === 1 ? "does" : "do"} not agree (see above).`),
    sub: [],
  });
  const findings = asArray(analysis.styleLint.findings);
  if (findings.length === 0) items.push({ text: "Writing style: nothing stood out.", sub: [] });
  else items.push({ text: `Writing style: ${findings.length} spot${findings.length === 1 ? "" : "s"} could sound more like you.`, sub: findings.map((finding) => styleFinding(finding, config)) });
  notes.forEach((note) => items.push({ text: `Also noted: ${note}`, sub: [] }));
  return items;
}

function introFor(status) {
  if (status === STATUS.blocked) return "I stopped before making the resume file, so nothing new was added to your list for this role. Fix the points below and I'll run it again.";
  if (status === STATUS.confirm) return "The resume is made and nothing has been sent. A few things need a yes or no from you first.";
  if (status === STATUS.draft) return "The resume is made and nothing has been sent. I haven't compared it with the job posting yet, so read it through and tell me any sentence you would not say.";
  return "The resume is made and nothing has been sent. Read it through and tell me any sentence you would not say.";
}

/**
 * Everything the standalone .html report shows, as plain data (the renderer in
 * src/renderers/html-tailor-report.js escapes and lays it out).
 */
function buildTailorReportModel(input, analysisIn) {
  const role = input.role || {};
  const analysis = analysisIn || analyzeTailorReport(input);
  const { config, problems, questions, coverage, pages, notDone, changes, lift, status } = analysis;
  const resumeFile = path.basename(String((role.resume && role.resume.outputPath) || "") || "") || "";
  const date = (input.generatedAt instanceof Date ? input.generatedAt.toISOString() : String(input.generatedAt || new Date().toISOString())).slice(0, 10);
  const statusKind = status === STATUS.blocked ? "blocked" : status === STATUS.confirm ? "confirm" : status === STATUS.draft ? "draft" : "ready";
  return {
    title: oneLine(role.title || role.role || "this role"),
    company: oneLine(role.company || config.company || "this company"),
    status,
    statusKind,
    date,
    resumeFile,
    intro: introFor(status),
    blocked: status === STATUS.blocked,
    changes: {
      hasBase: changes.hasBase,
      kind: changes.kind,
      baselineLabel: changes.baselineLabel,
      diff: changes.diff,
      lines: changes.lines,
      keywordLines: changes.keywordLines,
    },
    lift,
    liftSentence: lift ? liftSentence(lift) : "",
    coverage: coverage
      ? { covered: coverage.covered, missing: coverage.missing, percent: coverage.percent, total: coverage.covered.length + coverage.missing.length }
      : null,
    confirm: [...problems, ...questions].map((item) => item.question),
    checks: checkItems(analysis),
    fit: pages ? (pages.pages <= 1 ? "Fits on 1 page." : `Runs over 1 page (${pages.pages} pages): trim ${trimSuggestion(config)}.`) : "",
    notDone,
    gaps: asArray(input.gapReport && input.gapReport.gaps).map((gap) => ({ keyword: oneLine(gap.keyword), type: GAP_TYPES[gap.type] || oneLine(gap.type), action: oneLine(gap.recommendedAction) })),
  };
}

function buildTailorReportHtml(input, analysisIn) {
  return renderHtmlTailorReport(buildTailorReportModel(input, analysisIn));
}

function buildTailorReport(input, analysisIn) {
  const role = input.role || {};
  const analysis = analysisIn || analyzeTailorReport(input);
  const { config, problems, questions, notes, coverage, pages, notDone, changes, status } = analysis;
  const title = role.title || role.role || "this role";
  const company = role.company || config.company || "this company";
  const resumeFile = path.basename(String((role.resume && role.resume.outputPath) || "") || "") || "not made yet";
  const date = (input.generatedAt instanceof Date ? input.generatedAt.toISOString() : String(input.generatedAt || new Date().toISOString())).slice(0, 10);

  const lines = [`# Resume report: ${oneLine(title)} at ${oneLine(company)}`, ""];
  lines.push(`**Status: ${status}**`);
  lines.push("");
  lines.push(`- Role: ${oneLine(title)}`, `- Company: ${oneLine(company)}`, `- Resume file: ${resumeFile}`, `- Report written: ${date}`);
  if (status === STATUS.blocked) {
    lines.push("", "I stopped before making the resume file, so nothing new was added to your list for this role. Fix the points below and I'll run it again.");
  } else if (status === STATUS.confirm) {
    lines.push("", "The resume is made and nothing has been sent. A few things need a yes or no from you first.");
  } else if (status === STATUS.draft) {
    lines.push("", "The resume is made and nothing has been sent. I haven't compared it with the job posting yet, so read it through and tell me any sentence you would not say.");
  } else {
    lines.push("", "The resume is made and nothing has been sent. Read it through and tell me any sentence you would not say.");
  }

  // What changed for this job
  lines.push("", "## What changed for this job", "");
  if (status === STATUS.blocked) {
    lines.push("No resume file was made yet, so there is nothing to compare.");
  } else {
    if (changes.hasBase) {
      lines.push(changes.kind === "general"
        ? "Compared with your general resume (built from your profile and past resumes)."
        : "Compared with the resume this one was based on.", "");
    }
    changes.lines.forEach((line) => lines.push(`- ${line}`));
    if (changes.hasBase && analysis.lift && analysis.lift.gained.length > 0) {
      lines.push("", "Posting keywords this resume gained, and where:", "");
      analysis.lift.gained.forEach((item) => {
        const backing = item.supported
          ? item.evidenceIds.length ? ` (backed by evidence ${item.evidenceIds.join(", ")})` : " (backed by your profile)"
          : " (not found in your record: please confirm)";
        lines.push(`- ${item.keyword}: now in ${item.where}${backing}`);
      });
    }
    if (!changes.hasBase) {
      if (changes.lines.length === 0) lines.push("This is the first resume for this role, so there is nothing to compare yet.");
      if (changes.keywordLines.length > 0) {
        lines.push("", "Posting keywords the resume now uses, and where:", "");
        changes.keywordLines.forEach((line) => lines.push(`- ${line}`));
      }
    }
  }

  // 2) Needs your confirmation
  lines.push("", "## Needs your confirmation", "");
  const all = [...problems, ...questions];
  if (all.length === 0) lines.push("Nothing right now.");
  all.forEach((item, index) => lines.push(`${index + 1}. ${item.question}`));
  if (all.length > 0) lines.push("", "Answer in plain words. I'll record what you tell me before anything is sent.");

  // 3) What the checks found
  lines.push("", "## What the checks found", "");
  checkItems(analysis).forEach((item) => {
    lines.push(`- ${item.text}`);
    item.sub.forEach((text) => lines.push(`  - ${text}`));
  });

  // 4) Job match
  if (coverage) {
    lines.push("", "## Job match", "");
    const total = coverage.covered.length + coverage.missing.length;
    lines.push(`- The resume covers ${coverage.covered.length} of ${total} keywords${coverage.percent === null ? "" : ` (${coverage.percent}%)`}.`);
    if (analysis.lift) lines.push(`- ${liftSentence(analysis.lift)}`);
    if (coverage.covered.length > 0) {
      lines.push(`- Covered: ${coverage.covered.map((item) => (item.places.length ? `${item.keyword} (${item.places.join(", ")})` : item.keyword)).join(", ")}.`);
    }
    const addable = coverage.missing.filter((item) => item.supported);
    const unsupported = coverage.missing.filter((item) => !item.supported);
    lines.push(`- Missing, and you have the experience (could add): ${addable.length ? addable.map((i) => i.keyword).join(", ") : "none"}.`);
    lines.push(`- Missing, and I found no proof (don't claim): ${unsupported.length ? unsupported.map((i) => i.keyword).join(", ") : "none"}.`);
  }

  // 5) Fit (only when the page count is known; no made-up limit numbers)
  if (pages) {
    lines.push("", "## Fit", "");
    lines.push(pages.pages <= 1 ? "Fits on 1 page." : `Runs over 1 page (${pages.pages} pages): trim ${trimSuggestion(config)}.`);
  }

  // Checks that have not run
  if (notDone.length > 0) {
    lines.push("", "## Not done yet", "");
    notDone.forEach((line) => lines.push(`- ${line}`));
  }

  // 6) Open gaps
  lines.push("", "## Open gaps", "");
  const gaps = asArray(input.gapReport && input.gapReport.gaps);
  if (gaps.length === 0) {
    lines.push("No gap review has been written for this role yet.");
  } else {
    gaps.forEach((gap) => lines.push(`- **${oneLine(gap.keyword)}**: ${GAP_TYPES[gap.type] || oneLine(gap.type)}. ${oneLine(gap.recommendedAction)}`));
  }

  // 7) Where the files are
  lines.push("", "## Where the files are", "", "Paths start from your private folder.", "");
  [
    pathLine("Resume", role.resume && role.resume.outputPath),
    pathLine("Resume draft (I edit this for you)", role.resume && role.resume.configPath),
    pathLine("Job posting", role.posting && role.posting.path),
    pathLine("Cover letter", role.coverLetter && role.coverLetter.outputPath),
    pathLine("Gap review", input.gapReport && input.gapReport.path),
    pathLine("This report (readable page)", reportRelativePath(role.id, "html")),
    pathLine("This report (plain text)", reportRelativePath(role.id)),
    pathLine("Your role list", "outputs/tracker.html"),
  ].filter(Boolean).forEach((line) => lines.push(line));

  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

function readGapReport(workspace, roleId) {
  const relative = `outputs/roles/${roleId}/gap-report.md`;
  const file = path.join(workspace, relative);
  if (!roleId || !fs.existsSync(file)) return null;
  const gaps = [];
  let current = null;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/u)) {
    const heading = line.match(/^###\s+\d+\.\s+(.+)$/u);
    if (heading) {
      current = { keyword: heading[1].trim(), type: "", recommendedAction: "" };
      gaps.push(current);
      continue;
    }
    const field = current && line.match(/^\*\*(Type|Recommended Action):\*\*\s*(.*)$/u);
    if (field) current[field[1] === "Type" ? "type" : "recommendedAction"] = field[2].trim();
  }
  return { path: relative, gaps };
}

/**
 * The config this role's resume started from: the `extends` parent when the
 * config has one, else a `base.json` next to it. Null when there is none.
 */
function readBaseConfig(workspace, configRelative) {
  if (!isText(configRelative)) return null;
  const root = path.resolve(workspace);
  const file = path.resolve(root, configRelative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return null;
  try {
    const raw = readJson(file);
    if (raw && isText(raw.extends)) return loadResumeConfig(path.resolve(path.dirname(file), raw.extends));
    const sibling = path.join(path.dirname(file), "base.json");
    if (sibling !== file && fs.existsSync(sibling)) return loadResumeConfig(sibling);
  } catch {
    // A base that cannot be read just means there is nothing to compare.
  }
  return null;
}

/**
 * Loads stored data for a role and writes its report. `extra` can carry values
 * only the current run has (claimAudit, factAudit, styleLint, blockedErrors,
 * config). Returns { path (workspace-relative), status, markdown }.
 */
function writeTailorReport(workspace, role, extra = {}) {
  const configRelative = role.resume && role.resume.configPath;
  let config = extra.config;
  if (!config && isText(configRelative)) {
    const file = path.resolve(workspace, configRelative);
    if (file.startsWith(path.resolve(workspace) + path.sep) && fs.existsSync(file)) config = readJson(file);
  }
  const paths = { profile: path.join(workspace, "profile.json"), evidence: path.join(workspace, "evidence.jsonl") };
  const input = {
    role,
    config,
    baseConfig: extra.baseConfig !== undefined ? extra.baseConfig : readBaseConfig(workspace, configRelative),
    profile: extra.profile !== undefined ? extra.profile : readJson(paths.profile, null),
    evidence: extra.evidence !== undefined ? extra.evidence : readJsonLines(paths.evidence),
    gapReport: extra.gapReport !== undefined ? extra.gapReport : readGapReport(workspace, role.id),
    generatedAt: extra.generatedAt || new Date(),
    ...extra,
  };
  const analysis = analyzeTailorReport(input);
  const markdown = buildTailorReport(input, analysis);
  const html = buildTailorReportHtml(input, analysis);
  const relative = reportRelativePath(role.id);
  const htmlRelative = reportRelativePath(role.id, "html");
  fs.mkdirSync(path.dirname(path.join(workspace, relative)), { recursive: true });
  fs.writeFileSync(path.join(workspace, relative), markdown, "utf8");
  fs.writeFileSync(path.join(workspace, htmlRelative), html, "utf8");

  // Keep the baseline score next to the role's keywordCoverage.
  if (role.resume && typeof role.resume === "object") {
    if (analysis.baselineCoverage) role.resume.baselineCoverage = analysis.baselineCoverage;
    else delete role.resume.baselineCoverage;
  }
  return { path: relative, htmlPath: htmlRelative, status: analysis.status, markdown, html, baselineCoverage: analysis.baselineCoverage };
}

module.exports = {
  REPORT_DIR,
  STATUS,
  analyzeTailorReport,
  buildTailorReport,
  buildTailorReportHtml,
  buildTailorReportModel,
  readGapReport,
  reportRelativePath,
  writeTailorReport,
};
