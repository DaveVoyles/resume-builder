"use strict";

const fs = require("fs");
const path = require("path");
const { Packer } = require("docx");
const { renderResumeConfig } = require("../../renderers/docx-resume");
const { readJson, resolveWorkspace, workspacePaths, ensureDir } = require("../../core/workspace");
const { slug } = require("../../core/ids");
const { loadResumeConfig } = require("../../core/resume-config");
const { reportPageCount } = require("../../core/page-count");

// Company and output file name both become literal path segments under
// outputs/resumes/ (issue #6: "outputs/resumes/<Company>/<file>.docx").
// Strip path separators and leading dots so an untrusted config can't escape
// the workspace (e.g. "../../evil" or ".." collapsing into a parent dir).
//
// Trim FIRST, before stripping leading dots: a value like " .. " doesn't
// start with a dot character (it starts with whitespace), so stripping
// leading dots first is a no-op, and a later .trim() then reveals a bare
// ".." untouched — escaping outputs/resumes/ by one directory level. Trim
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

// Older renders used candidate-company.docx, so two roles at one company
// overwrote each other. Kept so existing linked resumes can still be found.
function legacyOutputFileName(config) {
  return `${slug(config.candidate.name)}-${slug(config.company)}.docx`;
}

// New default adds a role slug: candidate-company-role-title.docx. The role
// comes from --title, then config.roleTitle, then the config file's own name.
function defaultOutputFileName(config, roleHint) {
  const role = slug(roleHint).slice(0, 40);
  return `${slug(config.candidate.name)}-${slug(config.company)}-${role}.docx`;
}

/**
 * Where a tracked role's rendered resume lives. Prefers the explicit
 * role.resume.outputPath; falls back to the old candidate-company.docx name
 * for roles linked before filenames included the role.
 */
function findRoleResumePath(workspace, role, candidateName) {
  const linked = role && role.resume && role.resume.outputPath;
  if (linked) {
    const full = path.resolve(workspace, linked);
    if (fs.existsSync(full)) return full;
  }
  if (!role || !role.company || !candidateName) return null;
  const legacy = path.join(workspacePaths(workspace).outputResumes, sanitizeSegment(role.company, "company"), legacyOutputFileName({ candidate: { name: candidateName }, company: role.company }));
  return fs.existsSync(legacy) ? legacy : null;
}

async function run(options, deps = {}) {
  return (await runDetailed(options, deps)).outputPath;
}

async function runDetailed(options, deps = {}) {
  if (!options.config) {
    throw new Error("render-resume requires --config <path-to-resume-config.json>");
  }

  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const configPath = path.resolve(process.cwd(), options.config);
  const config = loadResumeConfig(configPath);

  const document = renderResumeConfig(config);
  const buffer = await Packer.toBuffer(document);

  const roleHint = options.title || config.roleTitle || path.basename(configPath, path.extname(configPath));
  const fileName = config.outputFileName || defaultOutputFileName(config, roleHint);
  const companyDir = path.join(paths.outputResumes, sanitizeSegment(config.company, "company"));
  const outputPath = path.join(companyDir, sanitizeSegment(fileName, "outputFileName"));

  if (fs.existsSync(outputPath) && options.includeApplied !== true) {
    const tracked = readJson(paths.rolesTracked, []);
    // Only a role whose resume IS this file (or that has no linked resume yet)
    // can be harmed by the overwrite; other roles at the company are safe.
    const sent = tracked.find((role) => role
      && role.company === config.company
      && role.application
      && role.application.status
      && role.application.status !== "interested"
      && (!role.resume || !role.resume.outputPath || path.resolve(workspace, role.resume.outputPath) === outputPath));
    if (sent) {
      throw new Error(`Refusing to overwrite ${outputPath}: ${config.company} already has application status "${sent.application.status}". Pass --include-applied to overwrite it.`);
    }
  }

  ensureDir(companyDir);
  fs.writeFileSync(outputPath, buffer);

  console.log(`Rendered resume for ${config.company}: ${outputPath}`);
  const pageCount = options.pageCheck === false || options.noPageCheck ? null : reportPageCount(outputPath, config, deps.pageCount || {});
  return { outputPath, pageCount: pageCount ? pageCount.record : null };
}

module.exports = { run, runDetailed, defaultOutputFileName, legacyOutputFileName, findRoleResumePath };
