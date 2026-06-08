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

function extractFacts(text) {
  const safeText = text || "";
  const email = safeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0] || "";
  const links = [...safeText.matchAll(/https?:\/\/[^\s)]+/giu)].map((match) => match[0].replace(/[.,;]+$/u, ""));
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

module.exports = { createDefaultProfile, extractFacts, mergeProfileSource };
