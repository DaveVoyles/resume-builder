"use strict";

const fs = require("fs");
const path = require("path");

const DRAFT_FILENAME = "resume-draft-1.txt";

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function writeFirstDraft({ outputDir, answers }) {
  const goal = trimmed(answers.goal);
  if (!goal) {
    const error = new Error("Goal is required.");
    error.code = "GOAL_REQUIRED";
    throw error;
  }

  const lines = [
    "STUB FIRST DRAFT — not a Word resume.",
    "This first version writes a text placeholder. A later change will write a real .docx file.",
    "",
  ];

  const name = trimmed(answers.name);
  if (name) lines.push(`Name: ${name}`);
  const location = trimmed(answers.location);
  if (location) lines.push(`Location: ${location}`);
  lines.push(`Goal: ${goal}`);
  const where = trimmed(answers.where);
  if (where) lines.push(`Where you want to work: ${where}`);
  const when = trimmed(answers.when);
  if (when) lines.push(`When you want to start: ${when}`);

  const history = trimmed(answers.history);
  if (history) {
    lines.push("", "Work history:", history);
  }

  const extra = trimmed(answers.extra);
  if (extra) {
    lines.push("", "Notes:", extra);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(outputDir, DRAFT_FILENAME);
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return { filePath, filename: DRAFT_FILENAME };
}

module.exports = { DRAFT_FILENAME, writeFirstDraft };
