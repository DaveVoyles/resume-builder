"use strict";

const { stableId } = require("../core/ids");

function titleCase(value) {
  return String(value || "")
    .replace(/[-_+]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function parseUrl(value) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch (error) {
    throw new Error(`Invalid role URL: ${value}`);
  }
}

function inferCompanyFromUrl(url) {
  if (!url) return "";
  const host = url.hostname.replace(/^www\./u, "");
  const parts = host.split(".").filter((part) => !["jobs", "careers", "apply", "boards", "greenhouse", "lever"].includes(part));
  return titleCase(parts[0] || host);
}

function inferTitleFromUrl(url) {
  if (!url) return "";
  const parts = url.pathname.split("/").filter(Boolean);
  const candidate = parts.reverse().find((part) => /[a-z]/iu.test(part) && !/^\d+$/u.test(part));
  return candidate ? titleCase(decodeURIComponent(candidate)) : "Role from URL";
}

function createRole(options) {
  const jobUrl = parseUrl(options.url || options.jobUrl || "");
  const applyUrl = parseUrl(options.applyUrl || "");
  const title = options.title || inferTitleFromUrl(jobUrl);
  const company = options.company || inferCompanyFromUrl(jobUrl);
  if (!title || !company) {
    throw new Error("Role requires --title and --company unless --url can provide reasonable defaults");
  }

  const status = options.tracked || options.target === "tracked" ? "tracked" : "seed";
  return {
    id: stableId("role", [company, title, jobUrl?.href || applyUrl?.href || "manual"]),
    title,
    company,
    location: options.location || "",
    compensation: options.compensation || "",
    fit: options.fit || "",
    status,
    applied: options.applied || "Not applied",
    source: {
      method: jobUrl ? "url" : "manual",
      addedAt: new Date().toISOString(),
    },
    urls: {
      job: jobUrl?.href || "",
      apply: applyUrl?.href || "",
    },
    notes: options.notes ? [String(options.notes)] : [],
    output: {
      resume: options.resume || "",
    },
    followUpQuestions: [],
  };
}

module.exports = { createRole };
