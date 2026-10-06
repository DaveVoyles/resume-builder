"use strict";

const path = require("path");
const { readJson, resolveWorkspace, writeJson } = require("../../core/workspace");

function run(options) {
  if (typeof options.company !== "string" || typeof options.title !== "string") {
    throw new Error("approve-apply requires --company <name> and --title <name>");
  }
  const file = path.join(resolveWorkspace(options.workspace), "apply-approvals.json");
  const rows = readJson(file, []);
  const row = { company: options.company, title: options.title, approvedAt: new Date().toISOString() };
  if (typeof options.note === "string") row.note = options.note;
  rows.push(row);
  writeJson(file, rows);
  console.log(`Approved apply: ${row.company} — ${row.title}`);
}

module.exports = { run };
