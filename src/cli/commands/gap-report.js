"use strict";

const path = require("path");
const { validateGapClassifications } = require("../../core/gap-report");
const { renderGapReport } = require("../../renderers/markdown-gap-report");
const { readJson, resolveWorkspace, workspacePaths, ensureDir } = require("../../core/workspace");
const fs = require("fs");

// roleId becomes a literal path segment under outputs/roles/. Strip path
// separators and leading dots so an untrusted/mistyped value can't escape
// the workspace (e.g. "../../evil" or ".." collapsing into a parent dir) —
// same convention as render-resume.js / render-cover-letter.js's
// sanitizeSegment. Trim FIRST, before stripping leading dots: a value like
// " .. " doesn't start with a dot character (it starts with whitespace), so
// stripping leading dots first is a no-op, and a later .trim() would then
// reveal a bare ".." untouched.
const MAX_SEGMENT_LENGTH = 200;

function sanitizeSegment(value, label) {
  const withoutNulls = String(value).replace(/\0/gu, "");
  const sanitized = withoutNulls.trim().replace(/[/\\]+/gu, "-").replace(/^\.+/u, "").trim();
  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new Error(`${label} must contain at least one non-separator, non-leading-dot character (got: ${JSON.stringify(value)})`);
  }
  if (sanitized.length > MAX_SEGMENT_LENGTH) {
    throw new Error(`${label} must be ${MAX_SEGMENT_LENGTH} characters or fewer (got ${sanitized.length}).`);
  }
  return sanitized;
}

async function run(options) {
  if (!options.input) {
    throw new Error("gap-report requires --input <path-to-gaps.json>");
  }

  const inputPath = path.resolve(process.cwd(), options.input);

  // Read and validate input
  const gaps = readJson(inputPath);

  if (!Array.isArray(gaps)) {
    throw new Error(`Gap classifications file must contain a JSON array (got: ${typeof gaps})`);
  }

  const errors = validateGapClassifications(gaps);
  if (errors.length > 0) {
    throw new Error(`Invalid gap classifications:\n${errors.join("\n")}`);
  }

  // Determine output path
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);

  let outputPath;
  if (options.roleId) {
    const roles = fs.existsSync(paths.rolesTracked) ? readJson(paths.rolesTracked) : [];
    const roleExists = roles.some((role) => role.id === options.roleId);
    if (!roleExists) {
      throw new Error(`--roleId "${options.roleId}" does not match any tracked role in ${paths.rolesTracked}`);
    }
    const roleSegment = sanitizeSegment(options.roleId, "--roleId");
    outputPath = path.join(paths.outputs, "roles", roleSegment, "gap-report.md");
  } else {
    outputPath = path.join(paths.outputs, "gap-report", "gap-report.md");
  }
  ensureDir(path.dirname(outputPath));

  // Render and write report
  const roleTitle = options.roleTitle || "Target Role";
  const markdown = renderGapReport(gaps, roleTitle);
  fs.writeFileSync(outputPath, markdown, "utf8");

  console.log(`Gap report written to ${outputPath}`);

  return { gapCount: gaps.length, outputPath };
}

module.exports = { run };
