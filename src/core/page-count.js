"use strict";

/**
 * Real page-fit check. The ResumeProxyScore in resume-config.js only guesses
 * at length; this converts the rendered DOCX to PDF with LibreOffice (in a
 * temp dir, nothing is kept) and counts the pages.
 *
 * Every outside call goes through `deps` so tests never need LibreOffice:
 *   deps.findSoffice() -> path | null
 *   deps.spawnSync(cmd, args, opts) -> { status, stdout, stderr }
 *
 * Set RESUME_BUILDER_PAGE_CHECK=off to skip the check when no deps are
 * injected (the test runner does this so unit tests stay fast).
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync: nodeSpawnSync } = require("child_process");

const DEFAULT_PAGE_LIMIT = 1;

function defaultFindSoffice(exec) {
  const finder = process.platform === "win32" ? "where" : "which";
  const result = exec(finder, ["soffice"], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return String(result.stdout || "").split(/\r?\n/u)[0].trim() || null;
}

/**
 * Counts pages in a PDF. Counts /Type /Page objects when the file keeps its
 * objects in plain text; if objects are packed in compressed streams
 * (/ObjStm) the plain count can't be trusted, so ask `pdfinfo` instead.
 * Returns null when the count is unknown.
 */
function countPdfPages(pdfPath, deps = {}) {
  const exec = deps.spawnSync || nodeSpawnSync;
  const text = fs.readFileSync(pdfPath).toString("latin1");
  if (!/\/Type\s*\/ObjStm/u.test(text)) {
    const pages = text.match(/\/Type\s*\/Page(?![A-Za-z])/gu);
    if (pages && pages.length > 0) return pages.length;
  }
  try {
    const result = exec("pdfinfo", [pdfPath], { encoding: "utf8" });
    if (result && result.status === 0) {
      const match = /^Pages:\s*(\d+)/mu.exec(String(result.stdout || ""));
      if (match) return Number(match[1]);
    }
  } catch (error) {
    // pdfinfo missing: fall through to unknown.
  }
  return null;
}

function pageCheckDisabled(deps) {
  return !deps.spawnSync && !deps.findSoffice && process.env.RESUME_BUILDER_PAGE_CHECK === "off";
}

/**
 * Converts `docxPath` to PDF in a temp dir and counts its pages.
 * Returns { available, pages, reason? }:
 *   available false -> LibreOffice is not installed (or the check is off)
 *   pages null      -> converted, but the page count could not be read
 *   reason          -> why a count is missing (conversion failure text)
 */
function checkPageCount(docxPath, deps = {}) {
  if (pageCheckDisabled(deps)) return { available: false, disabled: true, pages: null, reason: "page check turned off" };
  const exec = deps.spawnSync || nodeSpawnSync;
  const soffice = (deps.findSoffice || (() => defaultFindSoffice(exec)))();
  if (!soffice) return { available: false, pages: null, reason: "LibreOffice not installed" };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "page-count-"));
  try {
    // A throwaway profile dir keeps this from fighting a LibreOffice window
    // the person already has open.
    const profile = path.join(tmp, "profile");
    const outDir = path.join(tmp, "out");
    fs.mkdirSync(outDir, { recursive: true });
    const result = exec(
      soffice,
      [`-env:UserInstallation=file://${profile}`, "--headless", "--convert-to", "pdf", "--outdir", outDir, docxPath],
      { encoding: "utf8", timeout: 120000 },
    );
    const produced = path.join(outDir, `${path.basename(docxPath, path.extname(docxPath))}.pdf`);
    if (!result || result.status !== 0 || !fs.existsSync(produced)) {
      const detail = result && result.stderr ? String(result.stderr).trim() : "";
      return { available: true, pages: null, reason: `conversion failed${detail ? `: ${detail}` : ""}` };
    }
    const pages = countPdfPages(produced, deps);
    return pages === null
      ? { available: true, pages: null, reason: "could not read the page count from the PDF" }
      : { available: true, pages };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function words(text) {
  return typeof text === "string" ? text.split(/\s+/u).filter(Boolean).length : 0;
}

/** Words per section of a resume config, largest first: [{ section, words }]. */
function sectionWordCounts(config) {
  const rows = [{ section: "Summary", words: words(config.summary && config.summary.text) }];
  (config.experienceSections || []).forEach((section) => {
    let total = 0;
    (section.jobs || []).forEach((job) => {
      total += words(job.title) + words(job.company) + words(job.dates) + words(job.subHeader);
      (job.bullets || []).forEach((bullet) => { total += words(bullet); });
    });
    rows.push({ section: section.heading, words: total });
  });
  rows.push({ section: "Skills", words: (config.skills || []).reduce((sum, row) => sum + words(row[0]) + words(row[1]), 0) });
  if (Array.isArray(config.education) && config.includeEducation !== false) {
    rows.push({
      section: "Education",
      words: config.education.reduce((sum, e) => sum + words(e.degree) + words(e.institution) + words(e.dates) + words(e.details), 0),
    });
  }
  return rows.filter((row) => row.words > 0).sort((a, b) => b.words - a.words);
}

function pageWord(count) {
  return `${count} page${count === 1 ? "" : "s"}`;
}

/**
 * Plain-language result. Returns { level: "ok" | "warn" | "info", message, record }
 * where `record` is the { pages, checkedAt } to persist on the role (or null).
 */
function describePageCount(result, config = {}, now = new Date()) {
  const limit = Number.isInteger(config.pageLimit) ? config.pageLimit : DEFAULT_PAGE_LIMIT;
  if (!result.available) {
    return { level: "info", message: "Page count not checked (LibreOffice not installed).", record: null };
  }
  if (result.pages === null) {
    return { level: "info", message: `Page count not checked (${result.reason || "unknown problem"}).`, record: null };
  }
  const record = { pages: result.pages, checkedAt: now.toISOString() };
  if (result.pages <= limit) {
    return { level: "ok", message: `Resume is ${pageWord(result.pages)}.`, record };
  }
  const biggest = sectionWordCounts(config)[0];
  const trim = biggest ? `trim ${biggest.section} (${biggest.words} words, the longest section)` : "trim the longest section";
  return {
    level: "warn",
    message: `Resume runs to ${pageWord(result.pages)} (limit ${limit}) — ${trim} or ask the candidate whether ${pageWord(result.pages)} is OK.`,
    record,
  };
}

/** Checks the DOCX, prints the plain-language result (warn, never fail), returns the describe() result. */
function reportPageCount(docxPath, config, deps = {}) {
  let result;
  try {
    result = checkPageCount(docxPath, deps);
  } catch (error) {
    result = { available: true, pages: null, reason: error.message };
  }
  if (result.disabled) return { level: "off", message: "", record: null };
  const described = describePageCount(result, config, deps.now);
  (described.level === "warn" ? console.warn : console.log)(described.message);
  return described;
}

module.exports = {
  DEFAULT_PAGE_LIMIT,
  checkPageCount,
  countPdfPages,
  describePageCount,
  reportPageCount,
  sectionWordCounts,
};
