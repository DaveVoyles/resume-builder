"use strict";

const path = require("path");
const { readJson, resolveWorkspace } = require("../../core/workspace");

function same(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function run(options) {
  if (typeof options.company !== "string" || typeof options.title !== "string") {
    throw new Error("apply requires --company <name> and --title <name>");
  }
  const workspace = resolveWorkspace(options.workspace);
  const approvals = readJson(path.join(workspace, "apply-approvals.json"), []);
  const approved = approvals.some((row) => same(row.company, options.company) && same(row.title, options.title));
  if (!approved) {
    throw new Error(
      `No approval for ${options.company} — ${options.title}. Run approve-apply first, after the candidate says yes.`
    );
  }
  if (options.dryRun !== true) {
    throw new Error("apply only supports --dry-run for now. No browser is opened.");
  }
  const confirmSubmit = options.confirmSubmit === true;
  console.log(
    [
      "Dry run (nothing sent, status unchanged):",
      `  company: ${options.company}`,
      `  title: ${options.title}`,
      `  confirmSubmit: ${confirmSubmit}`,
      `  profile: would be read from ${path.join(workspace, "apply-profile.json")}`,
    ].join("\n")
  );
  return { company: options.company, title: options.title, confirmSubmit };
}

module.exports = { run };
