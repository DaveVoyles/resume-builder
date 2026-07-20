"use strict";

const fs = require("fs");
const path = require("path");
const { Packer } = require("docx");
const { renderResumeConfig } = require("../../renderers/docx-resume");
const { readJson, resolveWorkspace, workspacePaths, ensureDir } = require("../../core/workspace");
const { slug } = require("../../core/ids");

// Company and output file name both become literal path segments under
// outputs/resumes/ (issue #6: "outputs/resumes/<Company>/<file>.docx").
// Strip path separators and leading dots so an untrusted config can't escape
// the workspace (e.g. "../../evil" or ".." collapsing into a parent dir).
function sanitizeSegment(value, label) {
  const sanitized = String(value).replace(/[/\\]+/gu, "-").replace(/^\.+/u, "").trim();
  if (!sanitized) {
    throw new Error(`${label} must contain at least one non-separator, non-leading-dot character (got: ${JSON.stringify(value)})`);
  }
  return sanitized;
}

function defaultOutputFileName(config) {
  return `${slug(config.candidate.name)}-${slug(config.company)}.docx`;
}

async function run(options) {
  if (!options.config) {
    throw new Error("render-resume requires --config <path-to-resume-config.json>");
  }

  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const configPath = path.resolve(process.cwd(), options.config);
  const config = readJson(configPath);

  const document = renderResumeConfig(config);
  const buffer = await Packer.toBuffer(document);

  const fileName = config.outputFileName || defaultOutputFileName(config);
  const companyDir = path.join(paths.outputResumes, sanitizeSegment(config.company, "company"));
  const outputPath = path.join(companyDir, sanitizeSegment(fileName, "outputFileName"));

  ensureDir(companyDir);
  fs.writeFileSync(outputPath, buffer);

  console.log(`Rendered resume for ${config.company}: ${outputPath}`);
  return outputPath;
}

module.exports = { run };
