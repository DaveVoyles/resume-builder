"use strict";

// Agent handoff for the home page's "Add a job" box. The page only saves
// requests to <workspace>/job-requests.json; this command is how the agent
// reads them and closes them. It never fetches a link and never applies.

const { readJobRequests, normalizeLink, removeJobRequests, JOB_REQUESTS_FILENAME } = require("../../core/job-requests");
const { displayWorkspace } = require("../../core/role-lookup");
const { resolveWorkspace } = require("../../core/workspace");

const PREVIEW_LENGTH = 200;

function preview(text) {
  const flat = String(text || "").replace(/\s+/gu, " ").trim();
  if (!flat) return "(none, fetch the link or ask the person to paste the posting)";
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH)}...` : flat;
}

function list(workspace) {
  const label = displayWorkspace(workspace);
  const requests = readJobRequests(workspace);
  if (requests.length === 0) {
    console.log(`No pending job requests in ${label}/${JOB_REQUESTS_FILENAME}.`);
    return;
  }
  console.log(`${requests.length} pending job request${requests.length === 1 ? "" : "s"} in ${label}/${JOB_REQUESTS_FILENAME}:`);
  requests.forEach((entry, index) => {
    console.log("");
    console.log(`${index + 1}. ${entry.link}`);
    console.log(`   saved: ${entry.createdAt || "unknown"}`);
    console.log(`   posting text: ${preview(entry.text)}`);
  });
  console.log("");
  console.log("Next: add-role (with --jd-text or --jd-file) and tailor for each link. Both mark the request done when the URL matches.");
  console.log("Or close one by hand: job-requests done --link <url>  |  job-requests done --all");
}

function done(workspace, options) {
  if (options.all === true) {
    const removed = removeJobRequests(workspace, () => true);
    console.log(`Marked ${removed.length} job request${removed.length === 1 ? "" : "s"} done.`);
    return;
  }
  if (typeof options.link !== "string" || !options.link.trim()) {
    throw new Error("job-requests done requires --link <url> or --all");
  }
  const wanted = normalizeLink(options.link);
  const removed = removeJobRequests(workspace, (entry) => normalizeLink(entry && entry.link) === wanted);
  if (removed.length === 0) {
    console.log(`No pending job request matches ${options.link}.`);
    return;
  }
  console.log(`Marked ${removed.length} job request${removed.length === 1 ? "" : "s"} done for ${removed[0].link}`);
}

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const action = (options._ && options._[0]) || "list";
  if (action === "list") return list(workspace);
  if (action === "done") return done(workspace, options);
  throw new Error(`Unknown job-requests action: ${action}. Use list or done.`);
}

module.exports = { run };
