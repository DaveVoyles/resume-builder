"use strict";

const fs = require("fs");
const path = require("path");
const { readJson, resolveWorkspace, writeJson } = require("../../core/workspace");
const { stableId } = require("../../core/ids");
const { parseKeywordsOption, readPostingInput, savePosting } = require("../../core/role-posting");

function today() {
  return new Date().toISOString().split("T")[0];
}

function requireText(options, key) {
  const value = options[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`add-lead requires --${key} <value>`);
  }
  return value.trim();
}

function run(options) {
  const company = requireText(options, "company");
  const title = requireText(options, "title");
  const url = requireText(options, "url");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid --url: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid --url: ${url}. Must be http or https.`);
  }

  const workspace = resolveWorkspace(options.workspace);
  const file = path.join(workspace, "leads.json");
  const leads = fs.existsSync(file) ? readJson(file) : [];
  if (!Array.isArray(leads)) throw new Error(`${file} must contain a JSON array.`);
  if (leads.some((lead) => lead.url === url)) {
    throw new Error(`Duplicate lead: ${url} is already in leads.json.`);
  }

  const lead = { company, title, url, createdAt: today() };
  if (typeof options.fit === "string") lead.fit = options.fit;
  if (typeof options.notes === "string") lead.notes = options.notes;
  const input = readPostingInput(options);
  if (input) {
    const pseudo = { id: stableId("lead", [company, title, url]) };
    savePosting(workspace, pseudo, input, parseKeywordsOption(options.keywords));
    lead.posting = pseudo.posting;
  }
  leads.push(lead);
  writeJson(file, leads);
  console.log(`Added lead: ${company} — ${title}`);
  if (lead.posting) console.log(`Saved posting to ${lead.posting.path}.`);
}

module.exports = { run };
