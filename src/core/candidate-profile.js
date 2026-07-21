"use strict";

const { hash } = require("./ids");

const SKILL_KEYWORDS = [
  "AI",
  "agents",
  "API",
  "Azure",
  "cloud",
  "DevRel",
  "developer experience",
  "GitHub",
  "JavaScript",
  "leadership",
  "LLM",
  "Node.js",
  "product management",
  "program management",
  "Python",
  "React",
  "TypeScript",
];

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

// Query/fragment key names that suggest a URL is tokenized (a one-time
// auth link, a session-scoped share link, etc.) rather than a stable public
// URL a candidate would want surfaced in a resume or profile.
const SUSPICIOUS_PARAM_KEYS = new Set(["token", "auth", "key", "session", "sig", "jwt"]);

// Hostname substrings that suggest an internal/non-public system.
const INTERNAL_HOSTNAME_SUBSTRINGS = ["internal", "corp", "intranet"];

const IPV4_HOSTNAME_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/u;

function splitIntoTokens(value) {
  return value.toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean);
}

function hasSuspiciousParamKey(paramString) {
  if (!paramString) return false;
  return [...new URLSearchParams(paramString).keys()].some((key) =>
    splitIntoTokens(key).some((token) => SUSPICIOUS_PARAM_KEYS.has(token)),
  );
}

// Conservative allow-list filter: only excludes URLs that look internal or
// tokenized. Legitimate public links (github.com, linkedin.com, personal
// portfolio domains, etc.) are left untouched.
function isPubliclyShareableLink(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  const hostname = url.hostname.toLowerCase();

  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    return false;
  }
  if (IPV4_HOSTNAME_PATTERN.test(hostname) || hostname.includes(":")) {
    return false; // IPv4 or IPv6 literal
  }
  if (!hostname.includes(".")) {
    return false; // no public-looking TLD (bare hostname, e.g. "intranet")
  }
  if (INTERNAL_HOSTNAME_SUBSTRINGS.some((needle) => hostname.includes(needle))) {
    return false;
  }
  if (hasSuspiciousParamKey(url.search.replace(/^\?/u, ""))) {
    return false;
  }
  if (hasSuspiciousParamKey(url.hash.replace(/^#/u, ""))) {
    return false;
  }

  return true;
}

function extractFacts(text) {
  const safeText = text || "";
  const email = safeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0] || "";
  const links = [...safeText.matchAll(/https?:\/\/[^\s)]+/giu)]
    .map((match) => match[0].replace(/[.,;]+$/u, ""))
    .filter(isPubliclyShareableLink);
  const skills = SKILL_KEYWORDS.filter((skill) => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\b`, "iu").test(safeText));
  return { email, links, skills };
}

function mergeProfileSource(profile, source, text) {
  const facts = extractFacts(text);
  const existingSources = Array.isArray(profile.sources) ? profile.sources : [];
  const sourceHash = hash(`${source.kind}|${source.path || source.url || ""}|${source.sha256 || ""}`);
  const nextSources = existingSources.some((item) => item.id === sourceHash)
    ? existingSources
    : existingSources.concat({ id: sourceHash, ...source });

  return {
    ...profile,
    candidate: {
      ...(profile.candidate || {}),
      email: profile.candidate?.email || facts.email || "",
      links: uniqueSorted([...(profile.candidate?.links || []), ...facts.links]),
    },
    skills: uniqueSorted([...(profile.skills || []), ...facts.skills]),
    sources: nextSources,
    updatedAt: new Date().toISOString(),
  };
}

function createDefaultProfile() {
  return {
    schemaVersion: "1.0",
    candidate: {
      id: "candidate",
      preferredName: "",
      name: "",
      headline: "",
      location: "",
      email: "",
      links: [],
    },
    summary: "",
    skills: [],
    experience: [],
    projects: [],
    education: [],
    sources: [],
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { createDefaultProfile, extractFacts, mergeProfileSource, isPubliclyShareableLink };
