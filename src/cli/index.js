#!/usr/bin/env node
"use strict";

const { parseArgs } = require("./args");

const COMMANDS = {
  init: () => require("./commands/init"),
  ingest: () => require("./commands/ingest"),
  "add-role": () => require("./commands/add-role"),
  "add-contact": () => require("./commands/add-contact"),
  "build-tracker": () => require("./commands/build-tracker"),
  "build-contacts-tracker": () => require("./commands/build-contacts-tracker"),
  "find-similar": () => require("./commands/find-similar"),
  "render-resume": () => require("./commands/render-resume"),
  "render-cover-letter": () => require("./commands/render-cover-letter"),
  "score-keywords": () => require("./commands/score-keywords"),
  "gap-report": () => require("./commands/gap-report"),
  "set-status": () => require("./commands/set-status"),
  "set-contact-status": () => require("./commands/set-contact-status"),
  "study-guide-bundle": () => require("./commands/study-guide-bundle"),
  tailor: () => require("./commands/tailor"),
  "tailor-plan": () => require("./commands/tailor-plan"),
  "tailor-report": () => require("./commands/tailor-report"),
  validate: () => require("./commands/validate"),
  serve: () => require("./commands/serve"),
  "serve-home": () => require("./commands/serve-home"),
  "add-lead": () => require("./commands/add-lead"),
  "export-pdf": () => require("./commands/export-pdf"),
  "approve-apply": () => require("./commands/approve-apply"),
  apply: () => require("./commands/apply"),
};

function help() {
  return [
    "Reusable resume-builder workspace CLI",
    "",
    "Usage:",
    "  node src/cli/index.js <command> [options]",
    "",
    "Commands:",
    "  init --workspace <dir> [--force] [--noServe] [--noOpen] [--port <n>]",
    "  ingest --workspace <dir> [--resume <file> ...] [--notes <file> ...] [--links <file> ...] [--input <file> ...] [--github <user>]",
    "                         no --resume/--notes/--input/--github: read inputs/resumes, inputs/notes, inputs/links.md; --links adds files to that scan",
    "  add-role --workspace <dir> (--url <url> | --title <title> --company <company>) [--tracked] [--jd-file <file> | --jd-text [text]] [--keywords a,b,c]",
    "  add-contact --workspace <dir> --name <name> [--company <name>] --relationship <relationship> [--linked-role <role-id> ...] [--notes <text>]",
    "  find-similar --workspace <dir> [--candidates <file>] [--max <count>]",
    "  set-status --workspace <dir> (--id <role-id> | --company <name> --title <name>) --status <status> [--date <YYYY-MM-DD>]",
    "  set-contact-status --workspace <dir> --id <contact-id> --status <status> [--date <YYYY-MM-DD>]",
    "  build-tracker --workspace <dir> [--format md|html] [--output <file>] [--title <text>] [--notice <text>]",
    "  build-contacts-tracker --workspace <dir> [--format md|html] [--output <file>] [--title <text>]",
    "  render-resume --workspace <dir> --config <resume-config.json>",
    "  render-cover-letter --workspace <dir> --config <cover-letter-config.json>",
    "  score-keywords --config <resume-config.json> --keywords <keywords.json> [--json]",
    "  gap-report --input <gaps.json> [--workspace <dir>] [--roleId <role-id>] [--roleTitle <title>]",
    "  study-guide-bundle --workspace <dir> (--id <role-id> | --company <name> --title <name>)",
    "  tailor --workspace <dir> --config <resume-config.json> (--url <url> | --title <title> [--company <name>]) [--applyUrl <url>] [--location <text>] [--compensation <text>] [--fit <text>] [--notes <text>] [--jd-file <file> | --jd-text [text]] [--keywords <keywords.json|a,b,c>] [--cover-letter <cover-letter-config.json>]",
    "  tailor-plan --workspace <dir> (--id <role-id> | --company <name> --title <name>)   rank experience and skills against the role's stored posting keywords; writes outputs/tailor-plans/<role-id>.json",
    "  tailor-report --workspace <dir> (--id <role-id> | --company <name> --title <name>)",
    "  validate --workspace <dir>",
    "  serve --workspace <dir> [--port <n>] [--noOpen]",
    "  serve-home [--port <n>] [--noOpen] [--workspace <dir>]",
    "  add-lead --workspace <dir> --company <name> --title <name> --url <url> [--fit <text>] [--notes <text>] [--jd-file <file> | --jd-text [text]]",
    "  export-pdf --docx <file.docx> [--out <file.pdf>]",
    "  approve-apply --workspace <dir> --company <name> --title <name> [--note <text>]",
    "  apply --workspace <dir> --company <name> --title <name> --dry-run [--confirm-submit]",
    "",
    "Common options:",
    "  --workspace <dir>   Candidate workspace directory (default: candidate)",
    "  --help              Show this help",
    "",
  ].join("\n");
}

async function main(argv) {
  const [commandName, ...rest] = argv;
  if (!commandName || commandName === "--help" || commandName === "-h") {
    console.log(help());
    return;
  }

  const normalizedCommand = commandName === "build" ? "build-tracker" : commandName;
  const loadCommand = COMMANDS[normalizedCommand];
  if (!loadCommand) {
    throw new Error(`Unknown command: ${commandName}\n\n${help()}`);
  }

  const options = parseArgs(rest);
  if (options.help || options.h) {
    console.log(help());
    return;
  }
  await loadCommand().run(options);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
