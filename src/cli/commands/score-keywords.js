"use strict";

const path = require("path");
const { scoreKeywordCoverage } = require("../../core/keyword-coverage");
const { readJson, resolveWorkspace } = require("../../core/workspace");

async function run(options) {
  if (!options.config) {
    throw new Error("score-keywords requires --config <path-to-resume-config.json>");
  }
  if (!options.keywords) {
    throw new Error("score-keywords requires --keywords <path-to-keywords.json>");
  }

  const workspace = resolveWorkspace(options.workspace);
  const configPath = path.resolve(process.cwd(), options.config);
  const keywordsPath = path.resolve(process.cwd(), options.keywords);

  const resumeConfig = readJson(configPath);
  const keywords = readJson(keywordsPath);

  if (!Array.isArray(keywords)) {
    throw new Error(`Keywords file must contain a JSON array (got: ${typeof keywords})`);
  }

  const result = scoreKeywordCoverage(keywords, resumeConfig);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const presentList = result.present.length > 0 ? result.present.join(", ") : "(none)";
    const missingList = result.missing.length > 0 ? result.missing.join(", ") : "(none)";
    console.log(`Keyword coverage: ${result.percent}% (${result.present.length}/${result.present.length + result.missing.length})`);
    console.log(`Present: ${presentList}`);
    console.log(`Missing: ${missingList}`);
  }

  return result;
}

module.exports = { run };
