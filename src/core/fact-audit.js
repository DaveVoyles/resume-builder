"use strict";

/**
 * Fact-consistency audit (employers, titles, dates, education, scope verbs,
 * named tools). Complements src/core/claim-audit.js, which only checks
 * numeric claims. See docs/accuracy-and-claims.md, "Fact-consistency audit".
 *
 * auditFacts(config, profile, evidence) -> { errors, warnings }
 *   errors   blocking (invented employer, inflated title, dates outside the
 *            profile, unsupported scope verb, education not in the profile)
 *   warnings advisory (tools or technologies not found anywhere in the
 *            candidate's profile or evidence)
 *
 * Pure and deterministic: no network, no LLM.
 */

const isText = (value) => typeof value === "string" && value.trim() !== "";

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

const COMPANY_SUFFIXES = new Set(["inc", "llc", "corp", "corporation", "co", "company", "ltd", "limited", "plc", "gmbh", "lp", "llp", "incorporated"]);

function normalizeEmployer(value) {
  if (!isText(value)) return "";
  const tokens = value
    .toLowerCase()
    .replace(/&/gu, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/u)
    .filter(Boolean);
  while (tokens.length > 1 && tokens[0] === "the") tokens.shift();
  while (tokens.length > 1 && COMPANY_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

function containsTokens(haystack, needle) {
  if (!haystack || !needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

function employersMatch(a, b) {
  const x = normalizeEmployer(a);
  const y = normalizeEmployer(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 4 && containsTokens(long, short);
}

const TITLE_WORD_FIXES = { sr: "senior", jr: "junior", vp: "vice president", mgr: "manager", eng: "engineer" };

function normalizeTitle(value) {
  if (!isText(value)) return "";
  return value
    .toLowerCase()
    .replace(/&/gu, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/u)
    .filter(Boolean)
    .map((word) => TITLE_WORD_FIXES[word] || word)
    .join(" ");
}

// Words that raise the apparent seniority or scope of a title.
const SENIORITY_PATTERNS = [
  ["senior", /\bsenior\b/u],
  ["lead", /\blead\b/u],
  ["principal", /\bprincipal\b/u],
  ["staff", /\bstaff\b/u],
  ["head of", /\bhead of\b/u],
  ["director", /\bdirector\b/u],
  ["vice president", /\bvice president\b/u],
  ["chief", /\bchief\b/u],
  ["founder", /\bfounder\b/u],
];

function seniorityWords(normalizedTitle) {
  return SENIORITY_PATTERNS.filter(([, regex]) => regex.test(normalizedTitle)).map(([name]) => name);
}

/** True when `candidate` (a profile title or alias) legitimately covers the config title. */
function titleCovers(candidate, configTitle) {
  const a = normalizeTitle(candidate);
  const b = normalizeTitle(configTitle);
  if (!a || !b) return false;
  const related = a === b || containsTokens(a, b) || containsTokens(b, a);
  if (!related) return false;
  const allowed = new Set(seniorityWords(a));
  return seniorityWords(b).every((word) => allowed.has(word));
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** Month index (year * 12 + month - 1). `precision` is "month" or "year". */
function parseDatePoint(raw) {
  if (!isText(raw)) return null;
  const text = raw.trim().toLowerCase();
  if (/^(present|current|now|today|ongoing|to now)$/u.test(text)) return { present: true };
  let match = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/u);
  if (match) return monthPoint(Number(match[1]), Number(match[2]));
  match = text.match(/^(\d{1,2})[-/](\d{4})$/u);
  if (match) return monthPoint(Number(match[2]), Number(match[1]));
  match = text.match(/^([a-z]{3,9})\.?,?\s+(\d{4})$/u);
  if (match && MONTHS[match[1].slice(0, 4)] !== undefined) return monthPoint(Number(match[2]), MONTHS[match[1].slice(0, 4)]);
  if (match && MONTHS[match[1].slice(0, 3)] !== undefined) return monthPoint(Number(match[2]), MONTHS[match[1].slice(0, 3)]);
  match = text.match(/^(\d{4})$/u);
  if (match) {
    const year = Number(match[1]);
    return { earliest: year * 12, latest: year * 12 + 11 };
  }
  return null;
}

function monthPoint(year, month) {
  if (month < 1 || month > 12) return null;
  const index = year * 12 + month - 1;
  return { earliest: index, latest: index };
}

/** Splits "2022 - Present", "Jan 2020 – Mar 2022", "2012 to 2016" into start/end text. */
function parseDateRange(text) {
  if (!isText(text)) return null;
  const parts = text.split(/\s+(?:-|–|—|to|until)\s+|\s*[–—]\s*|(?<=\d)\s*-\s*(?=[\dA-Za-z])/iu).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    const only = parseDatePoint(parts[0]);
    return only && !only.present ? { start: only, end: only } : null;
  }
  if (parts.length !== 2) return null;
  const start = parseDatePoint(parts[0]);
  const end = parseDatePoint(parts[1]);
  if (!start || start.present) return null;
  return { start, end: end || null };
}

const DATE_TOLERANCE_MONTHS = 1;

function checkDates(configDates, profileEntry, where, errors) {
  const range = parseDateRange(configDates);
  if (!range) return;
  const profileStart = parseDatePoint(profileEntry.startDate);
  const profileEndRaw = profileEntry.endDate;
  const profileEnd = isText(profileEndRaw) ? parseDatePoint(profileEndRaw) : null;
  const profileIsCurrent = !isText(profileEndRaw) || Boolean(profileEnd && profileEnd.present);
  const profileLabel = `${profileEntry.startDate || "unknown start"} to ${profileIsCurrent ? "present" : profileEndRaw}`;

  if (profileStart && !profileStart.present && range.start.latest < profileStart.earliest - DATE_TOLERANCE_MONTHS) {
    errors.push(
      `Start date does not match the profile at ${where}: the resume says "${configDates}" but profile.json has this job from ${profileLabel}. ` +
        "Ask the candidate which dates are right and fix the resume (or the profile) so they agree.",
    );
  }
  if (range.end && range.end.present) {
    if (!profileIsCurrent) {
      errors.push(
        `End date does not match the profile at ${where}: the resume says "Present" but profile.json has this job ending ${profileEndRaw}. ` +
          "Ask the candidate whether they still work there; change the resume to the real end date, or update the profile.",
      );
    }
  } else if (range.end && profileEnd && !profileEnd.present && range.end.earliest > profileEnd.latest + DATE_TOLERANCE_MONTHS) {
    errors.push(
      `End date does not match the profile at ${where}: the resume says "${configDates}" but profile.json has this job ending ${profileEndRaw}. ` +
        "Ask the candidate which date is right and fix the resume (or the profile).",
    );
  }
  if (profileStart && !profileStart.present && !profileIsCurrent && profileEnd && range.start.earliest > profileEnd.latest + DATE_TOLERANCE_MONTHS) {
    errors.push(
      `Dates fall outside the profile at ${where}: the resume says "${configDates}" but profile.json has this job from ${profileLabel}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Evidence and profile text
// ---------------------------------------------------------------------------

function evidenceText(entry) {
  if (!entry || typeof entry !== "object") return "";
  return [entry.fact, entry.snippet, entry.quote, entry.summary, entry.organization].filter(isText).join(" \n ");
}

/** Text of an entry that can support a claim (metadata-only entries state nothing). */
function supportText(entry) {
  if (!entry || entry.confidence === "metadata-only") return "";
  return [entry.fact, entry.snippet, entry.quote, entry.organization].filter(isText).join(" \n ");
}

function textMentionsEmployer(text, employer) {
  const needle = normalizeEmployer(employer);
  if (!needle) return false;
  const lowered = String(text || "").toLowerCase().replace(/&/gu, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return containsTokens(lowered, needle);
}

function profileExperience(profile) {
  return profile && Array.isArray(profile.experience) ? profile.experience.filter((row) => row && typeof row === "object") : [];
}

function experienceEmployer(row) {
  return row.organization || row.company || row.employer || "";
}

function profileTexts(profile) {
  const texts = [];
  if (!profile || typeof profile !== "object") return texts;
  if (isText(profile.summary)) texts.push(profile.summary);
  if (profile.candidate && isText(profile.candidate.headline)) texts.push(profile.candidate.headline);
  for (const skill of profile.skills || []) {
    if (isText(skill)) texts.push(skill);
    else if (skill && isText(skill.name)) texts.push(skill.name);
  }
  for (const row of profileExperience(profile)) {
    texts.push(experienceEmployer(row), row.title, ...(Array.isArray(row.titleAliases) ? row.titleAliases : []));
    for (const highlight of row.highlights || []) {
      texts.push(typeof highlight === "string" ? highlight : highlight && highlight.text);
    }
  }
  for (const project of profile.projects || []) {
    if (project) texts.push(project.name, project.summary);
  }
  for (const cert of profile.certifications || []) {
    texts.push(typeof cert === "string" ? cert : cert && (cert.name || cert.title));
  }
  return texts.filter(isText);
}

function educationFields(entry) {
  if (isText(entry)) return { institution: entry, degree: "" };
  if (!entry || typeof entry !== "object") return { institution: "", degree: "" };
  return {
    institution: entry.institution || entry.school || entry.organization || entry.name || "",
    degree: entry.degree || entry.credential || entry.field || "",
  };
}

// ---------------------------------------------------------------------------
// Check 1: employers, titles, dates, education
// ---------------------------------------------------------------------------

function jobSites(config) {
  const jobs = [];
  (config.experienceSections || []).forEach((section, sIndex) => {
    (section.jobs || []).forEach((job, jIndex) => {
      jobs.push({ job, path: `experienceSections[${sIndex}].jobs[${jIndex}]` });
    });
  });
  return jobs;
}

function checkExperience(config, profile, evidence, errors) {
  const rows = profileExperience(profile);
  for (const { job, path } of jobSites(config)) {
    if (!isText(job.company)) continue;
    const employerRows = rows.filter((row) => employersMatch(experienceEmployer(row), job.company));
    if (employerRows.length === 0) {
      const inEvidence = (evidence || []).some((entry) => textMentionsEmployer(evidenceText(entry), job.company));
      if (!inEvidence) {
        errors.push(
          `Employer not found in the candidate's record at ${path}: "${job.company}" does not appear in profile.json experience or in any evidence entry. ` +
            "Ask the candidate whether they worked there; if yes, record it in profile.json and evidence.jsonl, otherwise remove the job from the resume.",
        );
      }
      continue;
    }

    const matching = employerRows.filter((row) => titlesFor(row).some((title) => titleCovers(title, job.title)));
    if (matching.length === 0) {
      const profileTitles = employerRows.map((row) => `"${row.title}"`).join(" or ");
      const added = seniorityWords(normalizeTitle(job.title)).filter(
        (word) => !employerRows.some((row) => titlesFor(row).some((title) => seniorityWords(normalizeTitle(title)).includes(word))),
      );
      const why = added.length > 0
        ? `it adds "${added.join('", "')}", which the profile does not have`
        : "it does not match the profile title";
      errors.push(
        `Job title does not match the profile at ${path}: the resume says "${job.title}" at ${job.company} but profile.json says ${profileTitles}; ${why}. ` +
          "Use the profile title, or ask the candidate and record the other title in the profile entry's titleAliases.",
      );
    }

    const datedRows = matching.length > 0 ? matching : employerRows;
    // Dates must fit at least one candidate profile entry.
    const dateErrorSets = datedRows.map((row) => {
      const found = [];
      checkDates(job.dates, row, path, found);
      return found;
    });
    if (dateErrorSets.every((set) => set.length > 0)) errors.push(...dateErrorSets[0]);
  }
}

function titlesFor(row) {
  return [row.title, ...(Array.isArray(row.titleAliases) ? row.titleAliases : [])].filter(isText);
}

const GENERIC_DEGREE_WORDS = new Set(["bachelor", "bachelors", "master", "masters", "science", "arts", "degree", "of", "in", "the", "and", "bs", "ba", "ms", "ma", "bsc", "msc", "phd", "doctor", "associate", "diploma", "certificate", "a", "s"]);

function degreesCompatible(a, b) {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  if (!x || !y) return true;
  if (x === y || containsTokens(x, y) || containsTokens(y, x)) return true;
  const significant = (text) => text.split(" ").filter((word) => word.length > 1 && !GENERIC_DEGREE_WORDS.has(word));
  const ys = new Set(significant(y));
  const xs = significant(x);
  if (xs.length === 0 || ys.size === 0) return true;
  return xs.some((word) => ys.has(word));
}

function checkEducation(config, profile, evidence, errors) {
  const rows = profile && Array.isArray(profile.education) ? profile.education : [];
  (config.education || []).forEach((entry, i) => {
    if (!entry || !isText(entry.institution)) return;
    const path = `education[${i}]`;
    const matches = rows.map(educationFields).filter((row) => employersMatch(row.institution, entry.institution));
    if (matches.length === 0) {
      const inEvidence = (evidence || []).some((ev) => textMentionsEmployer(evidenceText(ev), entry.institution));
      if (!inEvidence) {
        errors.push(
          `Education not found in the candidate's record at ${path}: "${entry.institution}" does not appear in profile.json education or in any evidence entry. ` +
            "Ask the candidate to confirm the school and degree, record it in the profile and evidence, or remove the entry from the resume.",
        );
      }
      return;
    }
    if (isText(entry.degree) && !matches.some((row) => degreesCompatible(entry.degree, row.degree))) {
      errors.push(
        `Degree does not match the profile at ${path}: the resume says "${entry.degree}" at ${entry.institution} but profile.json says ` +
          `${matches.map((row) => `"${row.degree}"`).join(" or ")}. Ask the candidate which is correct and fix the resume or the profile.`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Check 2: scope verbs (blocking)
// ---------------------------------------------------------------------------

// Wording mirrors docs/accuracy-and-claims.md ("Avoid these patterns").
const SCOPE_RULES = [
  { id: "led", label: "led", claim: /\b(?:led|leading)\b/iu, support: /\b(?:led|lead|leads|leading|leader|leadership)\b/iu, soften: "contributed to" },
  { id: "owned", label: "owned", claim: /\b(?:owned|owning|ownership of|owner of)\b/iu, support: /\b(?:own|owns|owned|owning|owner|ownership)\b/iu, soften: "supported" },
  { id: "managed-team", label: "managed a team", claim: /\b(?:managed|managing)\s+(?:a\s+|an\s+|the\s+|\d+\s+)?(?:\w+\s+)?(?:team|teams|group|department|staff|engineers|reports|people|org|organization)\b|\bdirect reports\b/iu, support: /\b(?:manage|manages|managed|managing|manager|management|supervis\w*|direct reports)\b/iu, soften: "worked with a team on" },
  { id: "founded", label: "founded", claim: /\b(?:co-?founded|founded|founder)\b/iu, support: /\b(?:co-?founded|founded|founder|co-?founder)\b/iu, soften: "helped start" },
  { id: "director", label: "director", claim: /\bdirector\b/iu, support: /\bdirector\b/iu, soften: "contributed to" },
  { id: "head-of", label: "head of", claim: /\bhead of\b/iu, support: /\bhead of\b|\bhead\b/iu, soften: "contributed to" },
  { id: "architected", label: "architected", claim: /\barchitect(?:ed|ing)\b/iu, support: /\barchitect\w*\b/iu, soften: "contributed to the design of" },
  { id: "from-scratch", label: "built from scratch", claim: /\bfrom scratch\b|\bfrom the ground up\b/iu, support: /\bfrom scratch\b|\bfrom the ground up\b|\bgreenfield\b|\bzero[- ]to[- ]one\b/iu, soften: "built parts of" },
  { id: "sole", label: "sole", claim: /\b(?:sole|solely|single-handedly)\b/iu, support: /\b(?:sole|solely|single-handedly|only (?:engineer|developer|person|designer))\b/iu, soften: "contributed to" },
];

function scopeSupportText(site, entriesById, evidence, profile) {
  const parts = [];
  if (site.boundIds) {
    for (const id of site.boundIds) parts.push(supportText(entriesById.get(id)));
    return parts.join(" \n ");
  }
  if (site.employer) {
    const rows = profileExperience(profile).filter((row) => employersMatch(experienceEmployer(row), site.employer));
    for (const row of rows) {
      for (const highlight of row.highlights || []) {
        parts.push(typeof highlight === "string" ? highlight : highlight && highlight.text);
        for (const id of (highlight && highlight.evidenceIds) || []) parts.push(supportText(entriesById.get(id)));
      }
      for (const id of row.evidenceIds || []) parts.push(supportText(entriesById.get(id)));
    }
    for (const entry of evidence || []) {
      const text = supportText(entry);
      if (text && textMentionsEmployer(text, site.employer)) parts.push(text);
    }
    return parts.filter(isText).join(" \n ");
  }
  // Summary: any entry in the candidate's record may back it.
  for (const entry of evidence || []) parts.push(supportText(entry));
  for (const text of profileTexts(profile)) parts.push(text);
  return parts.filter(isText).join(" \n ");
}

function idList(value) {
  if (!Array.isArray(value)) return undefined;
  const ids = value.filter(isText);
  return ids.length > 0 ? ids : undefined;
}

function textSites(config) {
  const sites = [];
  if (config.summary && isText(config.summary.text)) {
    sites.push({ path: "summary.text", text: config.summary.text, boundIds: idList(config.summary.evidenceIds) });
  }
  jobSites(config).forEach(({ job, path }) => {
    (job.bullets || []).forEach((bullet, index) => {
      const own = Array.isArray(job.bulletEvidenceIds) ? idList(job.bulletEvidenceIds[index]) : undefined;
      sites.push({ path: `${path}.bullets[${index}]`, text: bullet, employer: job.company, boundIds: own || idList(job.evidenceIds) });
    });
  });
  return sites;
}

function checkScopeVerbs(config, profile, evidence, errors) {
  const entriesById = new Map((evidence || []).map((entry) => [entry.id, entry]));
  for (const site of textSites(config)) {
    if (!isText(site.text)) continue;
    let supporting = null;
    for (const rule of SCOPE_RULES) {
      if (!rule.claim.test(site.text)) continue;
      if (supporting === null) supporting = scopeSupportText(site, entriesById, evidence, profile);
      if (rule.support.test(supporting)) continue;
      const source = site.boundIds
        ? `the evidence listed for it (${site.boundIds.join(", ")})`
        : site.employer
          ? `any evidence or profile entry for ${site.employer}`
          : "the candidate's evidence or profile";
      errors.push(
        `Unsupported scope claim at ${site.path}: "${ruleMatch(rule, site.text)}" (${rule.label}) in "${snippet(site.text)}" is not backed by ${source}. ` +
          `Ask the candidate whether they ${rule.label === "led" ? "led" : rule.label} this; record it in evidence or soften to "${rule.soften}".`,
      );
    }
  }
}

function ruleMatch(rule, text) {
  const match = rule.claim.exec(text);
  return match ? match[0] : rule.label;
}

function snippet(text) {
  const clean = String(text).replace(/\s+/gu, " ").trim();
  return clean.length > 90 ? `${clean.slice(0, 87)}...` : clean;
}

// ---------------------------------------------------------------------------
// Check 3: named tools and technologies (advisory)
// ---------------------------------------------------------------------------

const TOOL_STOP_WORDS = new Set([
  "i", "a", "us", "usa", "uk", "eu", "pm", "hr", "it", "ceo", "cto", "cfo", "coo", "vp", "kpi", "kpis", "okr", "okrs", "roi", "b2b", "b2c", "qa",
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "present", "english", "spanish", "french", "german",
  "the", "and", "for", "with", "of", "to", "in", "on", "at", "by", "from", "across", "q1", "q2", "q3", "q4",
]);

function configOwnWords(config) {
  const words = new Set();
  const add = (value) => {
    if (!isText(value)) return;
    value.toLowerCase().split(/[^\p{L}\p{N}.+#]+/u).filter(Boolean).forEach((word) => words.add(word));
  };
  add(config.company);
  add(config.candidate && config.candidate.name);
  add(config.candidate && config.candidate.headline);
  for (const { job } of jobSites(config)) {
    add(job.company);
    add(job.title);
    add(job.subHeader);
  }
  (config.education || []).forEach((entry) => {
    if (entry) {
      add(entry.institution);
      add(entry.degree);
    }
  });
  return words;
}

/** Tool-like terms: capitalized mid-sentence words, acronyms, camelCase, and names with . + # or digits. */
function extractToolTerms(text) {
  const terms = [];
  const sentences = String(text).split(/(?<=[.!?:;])\s+|\n+/u);
  for (const sentence of sentences) {
    const words = sentence.split(/[\s,()/[\]{}"]+|(?<=\w)-(?=\w)|[–—]/u).filter(Boolean);
    words.forEach((rawWord, index) => {
      const word = rawWord.replace(/^[^\p{L}\p{N}]+/u, "").replace(/(?:'s|’s)$/u, "").replace(/[^\p{L}\p{N}+#]+$/u, "");
      if (word.length < 2) return;
      const isAcronym = /^[A-Z][A-Z0-9]{1,}s?$/u.test(word);
      const isMixed = /[a-z][A-Z]/u.test(word) || (/[A-Za-z]/u.test(word) && /\d/u.test(word)) || /[+#]/u.test(word) || /^[A-Za-z]+\.[A-Za-z]+/u.test(word);
      const isCapitalizedMidSentence = index > 0 && /^[A-Z][a-z]+$/u.test(word);
      if (isAcronym || isMixed || isCapitalizedMidSentence) terms.push(word);
    });
  }
  return terms;
}

function termPresent(term, haystack) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?:s)?(?![\\p{L}\\p{N}])`, "iu").test(haystack);
}

function checkTools(config, profile, evidence, warnings) {
  const own = configOwnWords(config);
  const haystack = [...profileTexts(profile), ...(evidence || []).map(evidenceText), ...(evidence || []).flatMap((entry) => (entry && Array.isArray(entry.tags) ? entry.tags : []))].join(" \n ");

  const sites = [];
  jobSites(config).forEach(({ job, path }) => {
    (job.bullets || []).forEach((bullet, i) => sites.push({ path: `${path}.bullets[${i}]`, text: bullet }));
  });
  (config.skills || []).forEach((row, i) => {
    if (!Array.isArray(row)) return;
    if (isText(row[0])) sites.push({ path: `skills[${i}].name`, text: row[0] });
    if (isText(row[1])) sites.push({ path: `skills[${i}].description`, text: row[1] });
  });

  const reported = new Set();
  for (const site of sites) {
    const missing = [];
    for (const term of extractToolTerms(site.text)) {
      const key = term.toLowerCase();
      if (TOOL_STOP_WORDS.has(key) || own.has(key) || reported.has(key) || missing.includes(term)) continue;
      if (!termPresent(term, haystack)) missing.push(term);
    }
    for (const term of missing) reported.add(term.toLowerCase());
    if (missing.length > 0) {
      warnings.push(
        `Tool or technology not found in the candidate's profile or evidence at ${site.path}: ${missing.map((term) => `"${term}"`).join(", ")} — confirm with the candidate before sending.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function auditFacts(config, profile, evidence) {
  const errors = [];
  const warnings = [];
  const safeConfig = config && typeof config === "object" ? config : {};
  const entries = Array.isArray(evidence) ? evidence : [];
  checkExperience(safeConfig, profile, entries, errors);
  checkEducation(safeConfig, profile, entries, errors);
  checkScopeVerbs(safeConfig, profile, entries, errors);
  checkTools(safeConfig, profile, entries, warnings);
  return { errors, warnings };
}

module.exports = {
  SCOPE_RULES,
  auditFacts,
  employersMatch,
  normalizeEmployer,
  parseDateRange,
  titleCovers,
};
