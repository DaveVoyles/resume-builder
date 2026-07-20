"use strict";

const fs = require("fs");
const path = require("path");
const { Packer } = require("docx");
const { renderResumeConfig } = require("../../renderers/docx-resume");
const { readJson, resolveWorkspace, workspacePaths, ensureDir } = require("../../core/workspace");
const { slug } = require("../../core/ids");

// Company becomes a literal directory name under outputs/resumes/ (issue #6:
// "outputs/resumes/<Company>/<file>.docx"). Strip path-traversal and
// separator characters so an untrusted config can't escape the workspace.
function sanitizeSegment(value) {
  return String(value).replace(/[/\\]+/gu, "-").replace(/^\.+/u, "").trim();
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
  const companyDir = path.join(paths.outputResumes, sanitizeSegment(config.company));
  const outputPath = path.join(companyDir, sanitizeSegment(fileName));

  ensureDir(companyDir);
  fs.writeFileSync(outputPath, buffer);

  console.log(`Rendered resume for ${config.company}: ${outputPath}`);
  return outputPath;
}

module.exports = { run };
