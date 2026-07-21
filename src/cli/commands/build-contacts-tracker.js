"use strict";

const path = require("path");
const { renderContactsTracker } = require("../../renderers/markdown-contacts-tracker");
const { renderHtmlContactsTracker } = require("../../renderers/html-contacts-tracker");
const { readJson, resolveWorkspace, workspacePaths, writeTextIfMissing } = require("../../core/workspace");

function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const contacts = readJson(paths.contacts, []);
  const format = options.format === "html" ? "html" : "md";

  if (format === "html") {
    const output = options.output || path.join(paths.outputs, "contacts.html");
    const profile = readJson(paths.profile, {});
    const candidateName = profile.candidate?.preferredName || profile.candidate?.name;
    const title = options.title || (candidateName ? `${candidateName} - Contact Tracker` : "Contact Tracker");
    writeTextIfMissing(output, renderHtmlContactsTracker(contacts, { title }), true);
    console.log(`Built html contacts tracker for ${contacts.length} tracked contact(s): ${output}`);
    return;
  }

  const output = options.output || path.join(paths.outputs, "contacts.md");
  writeTextIfMissing(output, renderContactsTracker(contacts), true);
  console.log(`Built contacts tracker for ${contacts.length} tracked contact(s): ${output}`);
}

module.exports = { run };
