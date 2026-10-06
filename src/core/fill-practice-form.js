"use strict";

const fs = require("fs");
const { fillFields } = require("./apply-fill");

const PRACTICE_FIELDS = [
  { id: "full_name", label: "Full name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "city", label: "City" },
  { id: "why", label: "Why this role?" },
];

function fillPracticeHtml(html, values) {
  let filled = html;
  for (const [id, value] of Object.entries(values)) {
    const pattern = new RegExp(`(<input\\b[^>]*\\bid="${id}"[^>]*\\bvalue=")[^"]*(")`, "u");
    if (!pattern.test(filled)) {
      throw new Error(`Practice form has no input for ${id}`);
    }
    filled = filled.replace(pattern, `$1${escapeAttr(value)}$2`);
  }
  return filled;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/gu, "&amp;")
    .replace(/"/gu, "&quot;")
    .replace(/</gu, "&lt;");
}

function fillPracticeForm(html, profile) {
  const result = fillFields(profile, PRACTICE_FIELDS, false);
  return {
    html: fillPracticeHtml(html, result.values),
    missing: result.missing,
    submitted: result.submitted,
  };
}

function readPracticeTemplate(templatePath) {
  return fs.readFileSync(templatePath, "utf8");
}

module.exports = {
  PRACTICE_FIELDS,
  fillPracticeForm,
  fillPracticeHtml,
  readPracticeTemplate,
};
