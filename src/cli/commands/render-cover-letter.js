"use strict";

const fs = require("fs");
const path = require("path");
const { Packer } = require("docx");
const { renderCoverLetterConfig } = require("../../renderers/docx-cover-letter");
const { validateCoverLetterConfig } = require("../../core/cover-letter-config");
const { auditCoverLetterConfig } = require("../../core/claim-audit");
const { readJson, readJsonLines, resolveWorkspace, workspacePaths, ensureDir } = require("../../core/workspace");
const { slug } = require("../../core/ids");

// Company becomes a literal path segment under outputs/cover-letters/
// (issue #46: "outputs/cover-letters/<Company>/<file>.docx").
// Strip path separators and leading dots so an untrusted config can't escape
// the workspace (e.g. "../../evil" or ".." collapsing into a parent dir).
//
// Trim FIRST, before stripping leading dots: a value like " .. " doesn't
// start with a dot character (it starts with whitespace), so stripping
// leading dots first is a no-op, and a later .trim() then reveals a bare
// ".." untouched — escaping outputs/cover-letters/ by one directory level. Trim
// first so no whitespace can hide a dot from the leading-dot strip. The
// explicit "." / ".." rejection below is defense-in-depth in case a future
// edit to the regex above stops fully consuming an all-dot segment.
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

function defaultOutputFileName(config) {
  return `${slug(config.candidate.name)}-${slug(config.company)}-cover-letter.docx`;
}

async function run(options) {
  if (!options.config) {
    throw new Error("render-cover-letter requires --config <path-to-cover-letter-config.json>");
  }

  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const configPath = path.resolve(process.cwd(), options.config);
  const config = readJson(configPath);

  // Step 1: schema validation — fail fast with an itemized error before
  // touching the evidence ledger or the filesystem.
  const { valid, errors: schemaErrors } = validateCoverLetterConfig(config);
  if (!valid) {
    throw new Error(`Invalid cover letter config:\n${schemaErrors.map((error) => `  - ${error}`).join("\n")}`);
  }

  // Step 2: evidence-backed claim audit — blocking rule: unsupported claims
  // prevent rendering.
  const evidence = readJsonLines(paths.evidence);
  const audit = auditCoverLetterConfig(config, evidence);
  if (audit.errors.length > 0) {
    throw new Error(`Cover letter config failed the evidence-backed claim audit:\n${audit.errors.map((error) => `  - ${error}`).join("\n")}`);
  }
  audit.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

  // Step 3: render and write the DOCX.
  const document = renderCoverLetterConfig(config);
  const buffer = await Packer.toBuffer(document);

  const fileName = defaultOutputFileName(config);
  const companyDir = path.join(paths.outputCoverLetters, sanitizeSegment(config.company, "company"));
  const outputPath = path.join(companyDir, sanitizeSegment(fileName, "outputFileName"));

  ensureDir(companyDir);
  fs.writeFileSync(outputPath, buffer);

  console.log(`Rendered cover letter for ${config.company}: ${outputPath}`);
  return outputPath;
}

module.exports = { run };
