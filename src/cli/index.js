#!/usr/bin/env node
"use strict";

const { parseArgs } = require("./args");

const COMMANDS = {
  init: () => require("./commands/init"),
  ingest: () => require("./commands/ingest"),
  "add-role": () => require("./commands/add-role"),
  "build-tracker": () => require("./commands/build-tracker"),
  "find-similar": () => require("./commands/find-similar"),
  "render-resume": () => require("./commands/render-resume"),
  "set-status": () => require("./commands/set-status"),
  "study-guide-bundle": () => require("./commands/study-guide-bundle"),
  tailor: () => require("./commands/tailor"),
  validate: () => require("./commands/validate"),
};

function help() {
  return [
    "Reusable resume-builder workspace CLI",
    "",
    "Usage:",
    "  node src/cli/index.js <command> [options]",
    "",
    "Commands:",
    "  init --workspace <dir> [--force]",
    "  ingest --workspace <dir> [--resume <file> ...] [--notes <file> ...] [--input <file> ...] [--github <user>]",
    "  add-role --workspace <dir> (--url <url> | --title <title> --company <company>) [--tracked]",
    "  find-similar --workspace <dir> [--candidates <file>] [--max <count>]",
    "  set-status --workspace <dir> (--id <role-id> | --company <name> --title <name>) --status <status> [--date <YYYY-MM-DD>]",
    "  build-tracker --workspace <dir> [--format md|html] [--output <file>] [--title <text>]",
    "  render-resume --workspace <dir> --config <resume-config.json>",
    "  study-guide-bundle --workspace <dir> (--id <role-id> | --company <name> --title <name>)",
    "  tailor --workspace <dir> --config <resume-config.json> (--url <url> | --title <title> [--company <name>]) [--applyUrl <url>] [--location <text>] [--compensation <text>] [--fit <text>] [--notes <text>]",
    "  validate --workspace <dir>",
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
