"use strict";

/**
 * Saves a job posting with its role: the text lands in
 * <workspace>/postings/<role-id>.md and the role gets
 * `posting: { path, fetchedAt, source, keywords: { required, preferred } }`.
 * Paths stored on the role are workspace-relative. No network access.
 */

const fs = require("fs");
const path = require("path");
const { extractPostingKeywords, allKeywords } = require("./posting-keywords");
const { ensureDir, readJson } = require("./workspace");

function splitList(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Parses a --keywords value: a path to a JSON array file, or a comma list.
 * Returns an array of strings, or null when the option is absent.
 */
function parseKeywordsOption(value) {
  if (value === undefined || value === false || value === true) return null;
  const text = Array.isArray(value) ? value.join(",") : String(value);
  const resolved = path.resolve(process.cwd(), text);
  const looksLikeFile = /\.json$/iu.test(text.trim());
  if (looksLikeFile || (fs.existsSync(resolved) && fs.statSync(resolved).isFile())) {
    const parsed = readJson(resolved);
    if (!Array.isArray(parsed)) throw new Error(`Keywords file must contain a JSON array (got: ${typeof parsed})`);
    return parsed.filter((item) => typeof item === "string" && item.trim() !== "");
  }
  return splitList(text);
}

/** Reads posting text from --jd-file or --jd-text (a value, or bare/"-" for stdin). */
function readPostingInput(options) {
  if (options.jdFile !== undefined && options.jdFile !== true) {
    const file = path.resolve(process.cwd(), String(options.jdFile));
    if (!fs.existsSync(file)) throw new Error(`--jd-file not found: ${options.jdFile}`);
    return { text: fs.readFileSync(file, "utf8"), source: "file" };
  }
  if (options.jdFile === true) throw new Error("--jd-file requires a path");
  if (options.jdText !== undefined) {
    const text = options.jdText === true || options.jdText === "-" ? fs.readFileSync(0, "utf8") : String(options.jdText);
    return { text, source: "pasted" };
  }
  return null;
}

function hasPosting(role) {
  return Boolean(role && role.posting && typeof role.posting.path === "string" && role.posting.path);
}

/** Writes the posting file and sets role.posting. Overwrites any stored posting. */
function savePosting(workspace, role, input, keywordsOverride) {
  const text = String(input.text || "");
  if (!text.trim()) throw new Error("Job posting text is empty.");
  const relPath = path.posix.join("postings", `${role.id}.md`);
  ensureDir(path.join(workspace, "postings"));
  fs.writeFileSync(path.join(workspace, relPath), text.endsWith("\n") ? text : `${text}\n`);
  const extracted = extractPostingKeywords(text, { company: role.company, location: role.location });
  const keywords = keywordsOverride ? { required: keywordsOverride, preferred: [] } : extracted;
  role.posting = {
    ...(role.posting || {}),
    path: relPath,
    fetchedAt: new Date().toISOString(),
    source: input.source,
    keywords,
  };
  return role.posting;
}

/** Replaces only the stored keywords (agent override); needs a stored posting. */
function setKeywords(role, keywords) {
  if (!hasPosting(role)) return false;
  role.posting.keywords = { required: keywords, preferred: [] };
  return true;
}

/** Resolves the stored posting text, refusing paths that escape the workspace. */
function readStoredPostingText(workspace, role) {
  if (!hasPosting(role)) return null;
  const root = path.resolve(workspace);
  const full = path.resolve(root, role.posting.path);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}

module.exports = { allKeywords, hasPosting, parseKeywordsOption, readPostingInput, readStoredPostingText, savePosting, setKeywords };
