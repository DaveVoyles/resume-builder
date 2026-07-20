"use strict";

const path = require("path");
const fs = require("fs");
const { validateGapClassifications } = require("../../core/gap-report");
const { renderGapReport } = require("../../renderers/markdown-gap-report");
const { readJson, workspacePaths } = require("../../core/workspace");

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
  const workspacePath = path.resolve(process.cwd(), options.workspace || "candidate");
  const paths = workspacePaths(workspacePath);

  let outputPath;
  if (options.roleId) {
    // Output to role-specific folder
    outputPath = path.join(paths.outputs, "roles", options.roleId, "gap-report.md");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  } else {
    // Output to default gap-report folder
    outputPath = path.join(paths.outputs, "gap-report", "gap-report.md");
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  }

  // Render and write report
  const roleTitle = options.roleTitle || "Target Role";
  const markdown = renderGapReport(gaps, roleTitle);
  fs.writeFileSync(outputPath, markdown, "utf8");

  console.log(`Gap report written to ${outputPath}`);

  return { gapCount: gaps.length, outputPath };
}

module.exports = { run };
