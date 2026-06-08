"use strict";

const { execFileSync } = require("child_process");

const PRIVATE_PATHS = [
  {
    pattern: /^candidate\/inputs(?:\/|$)/u,
    reason: "raw candidate resumes, notes, links, and source material",
  },
  {
    pattern: /^candidate\/profile\.json$/u,
    reason: "normalized candidate profile facts",
  },
  {
    pattern: /^candidate\/preferences\.json$/u,
    reason: "candidate preferences and constraints",
  },
  {
    pattern: /^candidate\/evidence\.jsonl$/u,
    reason: "claim evidence and source references",
  },
  {
    pattern: /^candidate\/roles\.seed\.json$/u,
    reason: "candidate-provided target roles",
  },
  {
    pattern: /^candidate\/roles\.tracked\.json$/u,
    reason: "application status and tracked roles",
  },
  {
    pattern: /^candidate\/claim-policy\.json$/u,
    reason: "candidate-specific wording restrictions",
  },
  {
    pattern: /^candidate\/outputs(?:\/|$)/u,
    reason: "generated candidate workspace outputs",
  },
  {
    pattern: /^outputs(?:\/|$)/u,
    reason: "generated modular workflow outputs",
  },
];

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitLines(args) {
  const output = git(args).trim();
  return output ? output.split(/\r?\n/u) : [];
}

function normalizePath(filePath) {
  return filePath.replace(/\\/gu, "/");
}

function matchPrivatePath(filePath) {
  const normalized = normalizePath(filePath);
  return PRIVATE_PATHS.find((entry) => entry.pattern.test(normalized));
}

function collectFindings(paths, state) {
  return paths
    .map((filePath) => {
      const match = matchPrivatePath(filePath);
      return match ? { path: normalizePath(filePath), state, reason: match.reason } : null;
    })
    .filter(Boolean);
}

function uniqueFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = `${finding.state}:${finding.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function main() {
  try {
    git(["rev-parse", "--is-inside-work-tree"]);
  } catch (error) {
    console.warn("Privacy check skipped: not inside a Git work tree.");
    return;
  }

  const staged = gitLines(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  const tracked = gitLines(["ls-files", "--cached"]);
  const findings = uniqueFindings([
    ...collectFindings(staged, "staged"),
    ...collectFindings(tracked, "tracked"),
  ]);

  if (findings.length === 0) {
    console.log("Privacy check passed: no private candidate workspace paths are staged or tracked.");
    return;
  }

  console.error("Privacy check failed: private candidate workspace paths are staged or tracked.");
  findings.forEach((finding) => {
    console.error(`- ${finding.path} (${finding.state}): ${finding.reason}`);
  });
  console.error("");
  console.error("Keep these paths ignored for reusable repositories. If a private path was staged, run:");
  console.error("  git restore --staged <path>");
  console.error("If a private path is already tracked, remove it from Git after confirming the data should stay local:");
  console.error("  git rm --cached <path>");
  process.exitCode = 1;
}

main();
