"use strict";

// No-submit guard (docs/testing.md, docs/playbooks/apply.md).
// Nothing in src/ may submit an application. Network, browser-automation, and
// child-process access is limited to a short allowlist of files with a known,
// non-submitting purpose. If this test fails, a new file gained one of these
// capabilities: justify it, then add it to ALLOWLIST with a reason in review.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const srcDir = path.join(repoRoot, "src");

const PATTERNS = [
  { name: "http/https module", regex: /require\(\s*["'](?:node:)?https?["']\s*\)/u },
  { name: "net/tls/dgram module", regex: /require\(\s*["'](?:node:)?(?:net|tls|dgram|http2)["']\s*\)/u },
  { name: "fetch call", regex: /\bfetch\s*\(/u },
  { name: "XMLHttpRequest", regex: /XMLHttpRequest/u },
  { name: "child_process", regex: /require\(\s*["'](?:node:)?child_process["']\s*\)/u },
  { name: "browser automation", regex: /playwright|puppeteer|selenium|webdriver/iu },
  { name: "form submit", regex: /\.requestSubmit\s*\(|\.submit\s*\(\s*\)/u },
];

// file (relative to repo root) -> pattern names it may contain, and why.
const ALLOWLIST = {
  "src/adapters/github.js": { allow: ["http/https module"], why: "reads public GitHub profile metadata (GET only)" },
  "src/adapters/freeform-notes.js": { allow: ["child_process"], why: "runs unzip to read .docx/.pptx inputs" },
  "src/cli/commands/export-pdf.js": { allow: ["child_process"], why: "runs LibreOffice to convert a DOCX to PDF locally" },
  "src/core/page-count.js": { allow: ["child_process"], why: "runs LibreOffice locally to count the pages of a rendered DOCX" },
  "src/cli/commands/init.js": { allow: ["http/https module"], why: "probes localhost for an already-running RB server" },
  "src/cli/commands/serve.js": { allow: ["child_process", "http/https module"], why: "local tracker server (listens on localhost); opens it in the default browser" },
  "src/cli/commands/serve-home.js": { allow: ["child_process", "http/https module"], why: "local home server (listens on localhost); opens a folder or the page" },
  "src/renderers/html-tracker.js": { allow: ["fetch call"], why: "tracker page fetches its own local server's status endpoint" },
};

function sourceFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(full));
    else if (entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) files.push(full);
  }
  return files;
}

test("src/ has no network, browser, or process capability outside the allowlist", () => {
  const violations = [];
  for (const file of sourceFiles(srcDir)) {
    const relative = path.relative(repoRoot, file).split(path.sep).join("/");
    const text = fs.readFileSync(file, "utf8");
    const allowed = new Set((ALLOWLIST[relative] || { allow: [] }).allow);
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(text) && !allowed.has(pattern.name)) {
        violations.push(`${relative}: ${pattern.name}`);
      }
    }
  }
  assert.deepEqual(violations, [], `New submit-capable code in src/. Review it, then update ALLOWLIST:\n${violations.join("\n")}`);
});

test("every allowlisted file still exists and still uses what it is allowed", () => {
  for (const [relative, entry] of Object.entries(ALLOWLIST)) {
    const full = path.join(repoRoot, relative);
    assert.ok(fs.existsSync(full), `${relative} is allowlisted but missing; remove the stale entry`);
    const text = fs.readFileSync(full, "utf8");
    for (const name of entry.allow) {
      const pattern = PATTERNS.find((candidate) => candidate.name === name);
      assert.ok(pattern.regex.test(text), `${relative} no longer uses "${name}"; tighten the allowlist`);
    }
  }
});

test("fillFields never reports a submission unless a caller explicitly asks, and nothing in src/ reads it", () => {
  const readers = [];
  for (const file of sourceFiles(srcDir)) {
    const relative = path.relative(repoRoot, file).split(path.sep).join("/");
    if (relative === "src/core/apply-fill.js") continue;
    if (/\.submitted\b/u.test(fs.readFileSync(file, "utf8"))) readers.push(relative);
  }
  assert.deepEqual(readers, []);
});

test("tests and scripts never pass --confirm-submit to a command", () => {
  const offenders = [];
  const roots = [path.join(repoRoot, "tests"), path.join(repoRoot, "scripts")];
  const selfPath = path.join(__dirname, "no-submit-guard.test.js");
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|sh|json|md)$/u.test(entry.name) && full !== selfPath) {
        const text = fs.readFileSync(full, "utf8");
        text.split("\n").forEach((line, index) => {
          if (!/confirm-?submit/iu.test(line)) return;
          // Negative assertions and the e2e refusal list are fine; a command line passing it is not.
          if (/assert|throw|refus|never|FORBIDDEN|not pass|do not/iu.test(line)) return;
          offenders.push(`${path.relative(repoRoot, full)}:${index + 1}: ${line.trim()}`);
        });
      }
    }
  };
  roots.forEach(walk);
  assert.deepEqual(offenders, []);
});
