"use strict";

const { stableId } = require("./ids");

const STOP_WORDS = new Set([
  "a",
  "and",
  "at",
  "for",
  "in",
  "lead",
  "manager",
  "of",
  "on",
  "product",
  "program",
  "remote",
  "senior",
  "sr",
  "staff",
  "the",
  "to",
  "with",
]);

function text(value) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (typeof value === "object") return Object.values(value).map(text).join(" ");
  return String(value);
}

function tokens(value) {
  return text(value)
    .toLowerCase()
    .split(/[^a-z0-9+.#]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function targetKeywords(seedRoles, preferences) {
  return unique([
    ...tokens(seedRoles.map((role) => [role.title, role.role, role.keywords, role.rationale, role.description])),
    ...tokens(preferences.roleTargets?.map((target) => [target.titles, target.keywords])),
    ...tokens(preferences.industries?.filter((item) => item.priority !== "avoid").map((item) => item.name || item)),
    ...tokens(preferences.technologies?.filter((item) => item.priority !== "avoid").map((item) => item.name || item)),
  ]).slice(0, 30);
}

function phraseTargets(seedRoles, preferences) {
  return unique([
    ...(seedRoles || []).map((role) => role.title || role.role),
    ...(preferences.roleTargets || []).flatMap((target) => target.titles || []),
  ].map((value) => String(value || "").trim()).filter(Boolean));
}

function preferredSeniority(preferences) {
  return unique((preferences.roleTargets || []).map((target) => target.seniority).filter(Boolean));
}

function preferredEmploymentTypes(preferences) {
  return unique((preferences.roleTargets || []).flatMap((target) => target.employmentTypes || []).filter(Boolean));
}

function preferredWorkModes(preferences) {
  const locations = preferences.locations || {};
  return unique(Array.isArray(locations.workModes) ? locations.workModes : [preferences.remotePreference].filter(Boolean));
}

function avoidedTerms(preferences) {
  return unique([
    ...tokens(preferences.industries?.filter((item) => item.priority === "avoid").map((item) => item.name || item)),
    ...tokens(preferences.technologies?.filter((item) => item.priority === "avoid").map((item) => item.name || item)),
    ...(preferences.dealBreakers || [])
      .map((item) => text(item.text || item).toLowerCase().trim())
      .filter((item) => item.length > 5),
  ]);
}

function roleKey(role) {
  return `${String(role.company || "").toLowerCase()}::${String(role.title || role.role || "").toLowerCase()}`;
}

function roleUrls(role) {
  return [role.urls?.job, role.urls?.apply, role.url, role.jobUrl, role.applyUrl].filter(Boolean);
}

function isDuplicate(role, existingRoles) {
  const urls = new Set(roleUrls(role));
  return existingRoles.some((existing) => {
    if (roleKey(existing) === roleKey(role)) return true;
    return roleUrls(existing).some((url) => urls.has(url));
  });
}

function scoreCandidate(role, context) {
  const reasons = [];
  const risks = [];
  const haystack = tokens([role.title, role.role, role.company, role.description, role.keywords, role.notes, role.location]);
  const haystackSet = new Set(haystack);
  const matchedKeywords = context.keywords.filter((keyword) => haystackSet.has(keyword)).slice(0, 8);
  const titleText = text([role.title, role.role]).toLowerCase();
  const matchedPhrases = context.phrases.filter((phrase) => titleText.includes(phrase.toLowerCase())).slice(0, 3);

  let score = 0;
  if (matchedKeywords.length > 0) {
    score += Math.min(35, matchedKeywords.length * 6);
    reasons.push(`Matches target keywords: ${matchedKeywords.join(", ")}.`);
  }
  if (matchedPhrases.length > 0) {
    score += 15;
    reasons.push(`Title resembles seed target: ${matchedPhrases[0]}.`);
  }

  if (context.seniority.length === 0 || context.seniority.includes(role.seniority)) {
    score += role.seniority ? 10 : 4;
  } else if (role.seniority) {
    risks.push(`Seniority differs from preferences: ${role.seniority}.`);
  }

  if (context.employmentTypes.length === 0 || context.employmentTypes.includes(role.employmentType)) {
    score += role.employmentType ? 8 : 3;
  } else if (role.employmentType) {
    risks.push(`Employment type differs from preferences: ${role.employmentType}.`);
  }

  if (context.workModes.length === 0 || context.workModes.includes(role.workMode)) {
    score += role.workMode ? 10 : 3;
  } else if (role.workMode) {
    risks.push(`Work mode differs from preferences: ${role.workMode}.`);
  }

  const roleText = text(role).toLowerCase();
  const avoided = context.avoided.filter((term) => roleText.includes(term)).slice(0, 5);
  if (avoided.length > 0) {
    score -= 25;
    risks.push(`Potential deal breaker or avoided preference: ${avoided.join(", ")}.`);
  }

  const compensation = role.compensation?.minimum ?? role.compensation?.min ?? role.compensation?.baseMinimum;
  const minimum = context.compensationMinimum;
  if (minimum && compensation) {
    if (Number(compensation) >= Number(minimum)) score += 7;
    else risks.push("Published compensation may be below the candidate minimum.");
  }

  if (!role.description && !role.keywords) risks.push("Needs posting review because description or keywords are missing.");
  if (!role.urls?.job && !role.url && !role.jobUrl) risks.push("Needs source link before tracking.");

  const boundedScore = Math.max(0, Math.min(100, score));
  return {
    ...role,
    id: role.id || stableId("similar", [role.company || "", role.title || role.role || "", role.urls?.job || role.url || "manual"]),
    title: role.title || role.role || "Unknown role",
    fit: {
      score: boundedScore,
      level: boundedScore >= 75 ? "strong" : boundedScore >= 55 ? "moderate" : boundedScore >= 35 ? "stretch" : "weak",
      rationale: reasons.length > 0 ? reasons.join(" ") : "Insufficient overlap with seed roles and preferences.",
      matchedKeywords,
      risks,
    },
    suggestedResumeStrategy:
      role.suggestedResumeStrategy ||
      (matchedKeywords.length > 0
        ? `Emphasize ${matchedKeywords.slice(0, 3).join(", ")} with evidence-backed bullets.`
        : "Review the posting and map requirements before drafting a resume."),
    reviewStatus: "needs-review",
  };
}

function buildDiscovery(seedRoles, preferences, trackedRoles, candidates) {
  const context = {
    keywords: targetKeywords(seedRoles, preferences),
    phrases: phraseTargets(seedRoles, preferences),
    seniority: preferredSeniority(preferences),
    employmentTypes: preferredEmploymentTypes(preferences),
    workModes: preferredWorkModes(preferences),
    avoided: avoidedTerms(preferences),
    compensationMinimum: preferences.compensation?.baseMinimum || preferences.compensation?.minimum,
  };
  const existingRoles = [...(seedRoles || []), ...(trackedRoles || [])];
  const duplicateCandidates = (candidates || []).filter((role) => isDuplicate(role, existingRoles));
  const recommendations = (candidates || [])
    .filter((role) => !isDuplicate(role, existingRoles))
    .map((role) => scoreCandidate(role, context))
    .sort((a, b) => b.fit.score - a.fit.score || roleKey(a).localeCompare(roleKey(b)));

  const searchBriefs = context.phrases.slice(0, 8).map((phrase) => ({
    titlePattern: phrase,
    keywords: context.keywords.slice(0, 8),
    workModes: context.workModes,
    seniority: context.seniority,
  }));

  return {
    context,
    recommendations,
    duplicateCandidates,
    searchBriefs,
  };
}

module.exports = { buildDiscovery, scoreCandidate, targetKeywords };
