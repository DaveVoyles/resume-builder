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
    pattern: /^candidate\/resume-configs(?:\/|$)/u,
    reason: "per-role DOCX resume render configs",
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

/**
 * Redaction seam (design plan 0001, D2 Testing Decisions): a deny-list
 * content grep for private-repo-specific terms, run per-PR in CI alongside
 * the path check above. Scoped to terms that are safe to ban outright in a
 * generic resume-workspace tool — the candidate's real identity/handles,
 * private local file-path fragments, machine names, and distinctive
 * personal/publication details — plus a curated subset of the private
 * repo's real target-employer names.
 *
 * Deliberately excludes common single-word company names (e.g. GitHub,
 * GitLab, Microsoft, Apple, Meta, Netflix, OpenAI, Anthropic, Reddit) even
 * though some appear in the private repo's real application history: this
 * repo legitimately references some of them itself (the GitHub adapter,
 * this very tooling), and banning household tech-company names would both
 * self-trigger on existing legitimate content and produce a steady stream
 * of false positives on future fictional sample data. The mitigation for
 * that broader risk is structural, not lexical: no real per-company role
 * content is ported from the private repo at all (only the generic
 * rendering engine and one newly-authored fictional sample), and every
 * future sample must use invented companies (Acme/Contoso/Fabrikam/
 * Northwind-style), never a real company name, fictional-sounding or not.
 *
 * Also deliberately excludes the bare full name "Dave Voyles"/"David
 * Voyles": this is Dave's own named public repo, and ordinary authorship
 * attribution (e.g. an ADR's "decision-makers: Dave Voyles" field) is
 * expected, legitimate content — not a leak — and a bare-name ban would
 * self-trigger against it (confirmed: docs/decisions/0001-agent-operated-cli.md,
 * already on main, has exactly this line). The danger this seam actually
 * guards against — the rendering engine hardcoding the candidate's identity
 * as if it were the tool's default — is closed structurally: the ported
 * engine takes candidate name/contact/education entirely from the resume
 * config, never from a constant.
 */
const DENY_TERMS = [
  { term: "Dnvoyles", reason: "candidate's real email handle" },
  { term: "davevoyles", reason: "candidate's real github/linkedin handle" },
  { term: "dave-voyles", reason: "candidate's real stackoverflow handle" },
  { term: "/Users/davevoyles", reason: "candidate's real local file path" },
  { term: "resume-builder-Dave", reason: "private upstream repo's real local directory name" },
  { term: "Daves-MacBook-Pro", reason: "candidate's real machine name" },
  { term: "Jack Kaley", reason: "candidate's private personal/education detail" },
  { term: "UnrealScript Game Programming Cookbook", reason: "candidate's real publication title" },
  { term: "Bentley Systems", reason: "real employer from the private application history" },
  { term: "DeepMind", reason: "real employer from the private application history" },
  { term: "Horizon3", reason: "real employer from the private application history" },
  { term: "Instacart", reason: "real employer from the private application history" },
  { term: "Sony Interactive Entertainment", reason: "real employer from the private application history" },
  { term: "Zillow", reason: "real employer from the private application history" },
];

// The deny-list terms themselves live in this file as literal strings, so
// this file is excluded from its own content scan to avoid self-matching.
const CONTENT_SCAN_EXCLUDE_PATHS = new Set(["scripts/check-privacy.js"]);
const BINARY_EXTENSIONS = new Set([".docx", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip", ".pdf", ".woff", ".woff2"]);

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

function dedupeBy(findings, keyFn) {
  const seen = new Set();
  return findings.filter((finding) => {
    const key = keyFn(finding);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueFindings(findings) {
  return dedupeBy(findings, (finding) => `${finding.state}:${finding.path}`);
}

function isBinaryPath(filePath) {
  const dot = filePath.lastIndexOf(".");
  if (dot === -1) return false;
  return BINARY_EXTENSIONS.has(filePath.slice(dot).toLowerCase());
}

// Reads a file's content from the Git index (the staging area), not the working
// tree: `git ls-files --cached` and `git diff --cached` both describe the index,
// so scanning working-tree bytes instead would miss a leak that's staged (or
// already committed) but has since been edited or reverted on disk without
// re-staging — the content grep must see exactly what `git commit` would commit.
function readIndexText(filePath) {
  try {
    return git(["show", `:${filePath}`]);
  } catch (error) {
    return null;
  }
}

function collectTermFindings(paths, state) {
  const findings = [];
  const uniquePaths = [...new Set(paths.map(normalizePath))].filter(
    (filePath) => !isBinaryPath(filePath) && !CONTENT_SCAN_EXCLUDE_PATHS.has(filePath),
  );

  for (const filePath of uniquePaths) {
    const content = readIndexText(filePath);
    if (content === null) continue;

    // Case-sensitive on purpose (tried case-insensitive, reverted): this repo's
    // own GitHub org/repo references are "DaveVoyles" (capitalized, e.g.
    // package.json's repository URL and README links), while the private
    // repo's hardcoded personal handles are lowercase ("davevoyles",
    // "dave-voyles"). Case-insensitive matching collapsed that distinction and
    // false-positived on this repo's own legitimate, already-tracked content
    // (README.md, package.json, docs/generator-refactor-plan.md, and others).
    // A casing-obfuscated leak is a much smaller realistic risk than breaking
    // the check on the repo's own URLs.
    for (const { term, reason } of DENY_TERMS) {
      if (content.includes(term)) {
        findings.push({ path: filePath, state, term, reason });
      }
    }
  }

  return findings;
}

function uniqueTermFindings(findings) {
  return dedupeBy(findings, (finding) => `${finding.state}:${finding.path}:${finding.term}`);
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

  const pathFindings = uniqueFindings([...collectFindings(staged, "staged"), ...collectFindings(tracked, "tracked")]);

  const termFindings = uniqueTermFindings([
    ...collectTermFindings(staged, "staged"),
    ...collectTermFindings(tracked, "tracked"),
  ]);

  if (pathFindings.length === 0 && termFindings.length === 0) {
    console.log("Privacy check passed: no private candidate workspace paths or deny-listed terms are staged or tracked.");
    return;
  }

  if (pathFindings.length > 0) {
    console.error("Privacy check failed: private candidate workspace paths are staged or tracked.");
    pathFindings.forEach((finding) => {
      console.error(`- ${finding.path} (${finding.state}): ${finding.reason}`);
    });
    console.error("");
    console.error("Keep these paths ignored for reusable repositories. If a private path was staged, run:");
    console.error("  git restore --staged <path>");
    console.error("If a private path is already tracked, remove it from Git after confirming the data should stay local:");
    console.error("  git rm --cached <path>");
  }

  if (termFindings.length > 0) {
    if (pathFindings.length > 0) console.error("");
    console.error("Privacy check failed: deny-listed private-repo terms are staged or tracked.");
    termFindings.forEach((finding) => {
      console.error(`- ${finding.path} (${finding.state}): "${finding.term}" — ${finding.reason}`);
    });
    console.error("");
    console.error("Remove or genericize the flagged content before committing. If the term is a false positive, review");
    console.error("DENY_TERMS in scripts/check-privacy.js before adjusting it.");
  }

  process.exitCode = 1;
}

main();
