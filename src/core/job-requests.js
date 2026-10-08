"use strict";

// Job requests typed on the home page's Jobs tab. The page never adds a job
// itself: it writes the request to <workspace>/job-requests.json so the agent
// can pick it up (see docs/playbooks/onboarding.md). Each entry is
// { link, text, createdAt }. The agent removes an entry once it has handled it.

const path = require("path");
const { readJson, writeJson } = require("./workspace");

const JOB_REQUESTS_FILENAME = "job-requests.json";
const MAX_LINK_LENGTH = 2000;
const MAX_TEXT_LENGTH = 20000;
const MAX_PENDING = 50;

function jobRequestsPath(workspace) {
  return path.join(workspace, JOB_REQUESTS_FILENAME);
}

function invalid(message) {
  const error = new Error(message);
  error.code = "JOB_REQUEST_INVALID";
  return error;
}

// Returns { link, text } or throws a JOB_REQUEST_INVALID error whose message
// is safe to show the person.
function validateJobRequest(input) {
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const link = typeof body.link === "string" ? body.link.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!link) throw invalid("Paste the link to the job posting.");
  if (link.length > MAX_LINK_LENGTH) throw invalid("That link is too long.");
  let parsed;
  try {
    parsed = new URL(link);
  } catch (error) {
    throw invalid("That does not look like a link. Start it with http:// or https://.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw invalid("Only http:// or https:// links work.");
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw invalid(`The pasted posting is too long. Keep it under ${MAX_TEXT_LENGTH} characters.`);
  }
  return { link, text };
}

function jobRequestSentence({ link, text }) {
  const base = `Please add this job and tailor my resume: ${link}`;
  return text ? `${base}\n\nI also pasted the posting text:\n${text}` : base;
}

function readJobRequests(workspace) {
  try {
    const list = readJson(jobRequestsPath(workspace), []);
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

function addJobRequest(workspace, input, now = new Date().toISOString()) {
  const request = validateJobRequest(input);
  const existing = readJobRequests(workspace);
  if (existing.length >= MAX_PENDING) {
    throw invalid("There are already many job requests waiting. Ask your agent to work through them first.");
  }
  const entry = { link: request.link, text: request.text, createdAt: now };
  writeJson(jobRequestsPath(workspace), [...existing, entry]);
  return { entry, sentence: jobRequestSentence(entry), pending: existing.length + 1 };
}

// Compare links ignoring case of scheme/host, a trailing slash, and #fragments.
function normalizeLink(link) {
  try {
    const url = new URL(String(link || "").trim());
    url.hash = "";
    const pathname = url.pathname.length > 1 ? url.pathname.replace(/\/+$/u, "") : url.pathname;
    return `${url.protocol}//${url.host}${pathname}${url.search}`;
  } catch (error) {
    return String(link || "").trim();
  }
}

// Removes pending requests for which shouldRemove(entry) is true. Returns the
// removed entries. Never creates the file and leaves it alone when nothing matched.
function removeJobRequests(workspace, shouldRemove) {
  const existing = readJobRequests(workspace);
  const removed = existing.filter((entry) => shouldRemove(entry));
  if (removed.length === 0) return [];
  writeJson(jobRequestsPath(workspace), existing.filter((entry) => !removed.includes(entry)));
  return removed;
}

// Marks pending requests whose link matches `url` as done (removes them).
function markJobRequestDone(workspace, url) {
  if (!url) return [];
  const wanted = normalizeLink(url);
  return removeJobRequests(workspace, (entry) => normalizeLink(entry && entry.link) === wanted);
}

module.exports = {
  normalizeLink,
  removeJobRequests,
  markJobRequestDone,
  JOB_REQUESTS_FILENAME,
  MAX_LINK_LENGTH,
  MAX_TEXT_LENGTH,
  jobRequestsPath,
  validateJobRequest,
  jobRequestSentence,
  readJobRequests,
  addJobRequest,
};
