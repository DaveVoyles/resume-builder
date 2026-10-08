"use strict";

const { createRole } = require("../../adapters/job-posting");
const { readJson, resolveWorkspace, workspacePaths, writeJson } = require("../../core/workspace");
const { syncOnboardingState } = require("../../core/onboarding-state");
const { tryRebuildTrackers } = require("./build-tracker");
const { hasPosting, parseKeywordsOption, readPostingInput, savePosting, setKeywords } = require("../../core/role-posting");

function roleListPath(paths, role) {
  return role.status === "tracked" ? paths.rolesTracked : paths.rolesSeed;
}

function findDuplicate(existing, nextRole) {
  return existing.find((role) => {
    const sameId = role.id === nextRole.id;
    const sameJobUrl = role.urls?.job && role.urls.job === nextRole.urls.job;
    return sameId || sameJobUrl;
  });
}

/**
 * Saves the posting text passed via --jd-file / --jd-text onto the role (new
 * or existing). An already stored posting is kept; --keywords still replaces
 * its keywords. Returns a short note for the CLI output, or "".
 */
function applyPosting(workspace, role, options, { keepExisting }) {
  const input = readPostingInput(options);
  const keywords = parseKeywordsOption(options.keywords);
  if (input && !(keepExisting && hasPosting(role))) {
    const posting = savePosting(workspace, role, input, keywords);
    const count = posting.keywords.required.length + posting.keywords.preferred.length;
    return `Saved posting to ${posting.path} (${count} keywords).`;
  }
  if (keywords && setKeywords(role, keywords)) return `Updated keywords on ${role.posting.path} (${keywords.length}).`;
  if (input) return `Posting already saved at ${role.posting.path}; kept it.`;
  return "";
}

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const role = createRole(options);
  const file = roleListPath(paths, role);
  const roles = readJson(file, []);

  const existing = findDuplicate(roles, role);
  if (existing) {
    console.log(`Role already exists in ${role.status}: ${role.company} — ${role.title}`);
    const note = applyPosting(workspace, existing, options, { keepExisting: true });
    if (note) {
      writeJson(file, roles);
      console.log(note);
    }
    if (role.status === "tracked") {
      syncOnboardingState(workspace);
      tryRebuildTrackers(workspace);
    }
    return;
  }

  const note = applyPosting(workspace, role, options, { keepExisting: false });
  writeJson(file, roles.concat(role));
  if (role.status === "tracked") {
    syncOnboardingState(workspace);
    tryRebuildTrackers(workspace);
  }
  console.log(`Added ${role.status} role: ${role.company} — ${role.title}`);
  if (note) console.log(note);
}

module.exports = { run };
