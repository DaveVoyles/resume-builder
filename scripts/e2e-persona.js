"use strict";

/**
 * Persona-driven end-to-end run (docs/testing.md).
 *
 *   npm run e2e                      # every persona under examples/personas/
 *   npm run e2e -- --persona jordan  # one persona
 *   npm run e2e -- --persona jordan --keep   # keep the temp workspace
 *   UPDATE_GOLDEN=1 npm run e2e      # regenerate golden DOCX text
 *
 * For each fictional persona: temp workspace -> init -> copy inputs -> ingest
 * -> saveHomeAnswers(answers.json) -> add-role -> tailor (committed resume
 * config) -> render-resume -> build-tracker -> validate, then a per-stage
 * scorecard. Exits non-zero when any check fails.
 *
 * Submitting an application is out of scope. This script refuses to invoke
 * `apply` or `approve-apply` and never passes --confirm-submit (see
 * assertSafeCommand and docs/playbooks/apply.md).
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "src", "cli", "index.js");
const personasDir = path.join(repoRoot, "examples", "personas");

const { saveHomeAnswers } = require("../src/core/home-answers");
const { onboardingSteps, syncOnboardingState } = require("../src/core/onboarding-state");
const { auditResumeConfig } = require("../src/core/claim-audit");
const { lintConfig } = require("../src/core/style-lint");
const { validateResumeConfig } = require("../src/core/resume-config");
const { readJson, readJsonLines, workspacePaths } = require("../src/core/workspace");
const { findSoffice } = require("../src/cli/commands/export-pdf");
const { checkPageCount, countPdfPages } = require("../src/core/page-count");
const { readDocxText } = require("../tests/helpers/read-docx-text");

const FORBIDDEN_COMMANDS = new Set(["apply", "approve-apply"]);
const FORBIDDEN_FLAGS = new Set(["--confirm-submit", "--confirmSubmit"]);

/** Throws if a CLI invocation could submit (or approve submitting) an application. */
function assertSafeCommand(args) {
  if (FORBIDDEN_COMMANDS.has(args[0])) {
    throw new Error(`e2e refuses to run "${args[0]}": tests never submit or approve applications.`);
  }
  const flag = args.find((arg) => FORBIDDEN_FLAGS.has(arg));
  if (flag) throw new Error(`e2e refuses to pass ${flag}: tests never submit applications.`);
}

function listPersonas() {
  return fs
    .readdirSync(personasDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(personasDir, entry.name, "expected.json")))
    .map((entry) => entry.name)
    .sort();
}

function normalizeText(text) {
  return `${String(text).replace(/\r\n/gu, "\n").trim()}\n`;
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name.startsWith(".")) continue;
    fs.copyFileSync(path.join(from, entry.name), path.join(to, entry.name));
    count += 1;
  }
  return count;
}

async function runPersona(name, options = {}) {
  const personaDir = path.join(personasDir, name);
  if (!fs.existsSync(path.join(personaDir, "expected.json"))) {
    throw new Error(`Unknown persona "${name}". Available: ${listPersonas().join(", ")}`);
  }
  const expected = readJson(path.join(personaDir, "expected.json"));
  const answers = readJson(path.join(personaDir, "answers.json"));
  const withPages = options.pages !== false;
  const soffice = withPages ? findSoffice() : null;

  const checks = [];
  const outputs = [];
  const cliLog = [];
  const commandsRun = [];
  const add = (stage, check, status, detail = "") => checks.push({ stage, check, status, detail });
  const pass = (stage, check, detail) => add(stage, check, "pass", detail);
  const expect = (stage, check, ok, detail) => add(stage, check, ok ? "pass" : "fail", detail);

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `resume-builder-e2e-${name}-`));
  const workspace = path.join(tmpRoot, "candidate");

  function runCli(args, { scanPaths = true } = {}) {
    assertSafeCommand(args);
    commandsRun.push(args[0]);
    const result = spawnSync(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      env: withPages ? process.env : { ...process.env, RESUME_BUILDER_PAGE_CHECK: "off" },
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    if (scanPaths) cliLog.push({ command: args[0], output });
    if (result.status !== 0) {
      throw new Error(`${args[0]} exited ${result.status}: ${output.trim().split("\n").slice(0, 6).join(" | ")}`);
    }
    return output;
  }

  let stage = "init";
  try {
    // init
    runCli(["init", "--workspace", workspace, "--noServe"]);
    expect("init", "workspace created", fs.existsSync(workspacePaths(workspace).profile));

    // copy inputs + ingest
    stage = "ingest";
    const paths = workspacePaths(workspace);
    const copied =
      copyDir(path.join(personaDir, "inputs", "resumes"), paths.resumes) +
      copyDir(path.join(personaDir, "inputs", "notes"), paths.notes);
    runCli(["ingest", "--workspace", workspace]);
    const evidence = readJsonLines(paths.evidence);
    expect("ingest", "every input became evidence", evidence.length >= copied, `${evidence.length} evidence entries from ${copied} files`);
    expect("ingest", "ledger not thin (>= 3 source-backed entries)", evidence.length >= 3, `${evidence.length} entries`);

    // home answers
    stage = "answers";
    saveHomeAnswers(workspace, answers);
    pass("answers", "home answers saved");

    // each posting
    for (const posting of expected.postings) {
      stage = `role:${posting.id}`;
      const postingPath = path.join(personaDir, posting.file);
      const configSource = path.join(personaDir, posting.config);
      expect(stage, "posting and config fixtures exist", fs.existsSync(postingPath) && fs.existsSync(configSource));

      runCli([
        "add-role",
        "--workspace", workspace,
        "--url", posting.url,
        "--title", posting.title,
        "--company", posting.company,
        "--tracked",
        "--jd-file", postingPath,
      ]);

      // tailor-plan: ranks the persona's evidence against the stored posting keywords.
      const planOutput = runCli(["tailor-plan", "--workspace", workspace, "--company", posting.company, "--title", posting.title]);
      const planRole = readJson(paths.rolesTracked, []).find((role) => role.company === posting.company && role.title === posting.title);
      const planFile = path.join(paths.outputs, "tailor-plans", `${planRole && planRole.id}.json`);
      const plan = fs.existsSync(planFile) ? readJson(planFile) : null;
      expect(stage, "tailor-plan lists at least one supported keyword", Boolean(plan) && plan.keywords.supported.length > 0, plan ? `${plan.keywords.supported.length} supported, ${plan.keywords.doNotClaim.length} not claimable` : "no plan written");
      expect(stage, "tailor-plan keeps the do-not-claim list apart from supported keywords", Boolean(plan) && plan.keywords.doNotClaim.every((item) => !plan.keywords.supported.some((s) => s.keyword === item.keyword)));
      expect(stage, "tailor-plan prints a relative plan path", /Plan saved: outputs\/tailor-plans\//u.test(planOutput) || !planOutput.includes(tmpRoot), "no absolute temp path");

      fs.mkdirSync(paths.resumeConfigs, { recursive: true });
      const configPath = path.join(paths.resumeConfigs, path.basename(posting.config));
      const configText = fs.readFileSync(configSource, "utf8");
      fs.writeFileSync(configPath, options.mutateConfig ? options.mutateConfig(configText, posting) : configText);

      // The posting was saved with the role by add-role --jd-file; tailor is
      // run without --keywords so its coverage step must use the stored ones.
      const tailorOutput = runCli([
        "tailor",
        "--workspace", workspace,
        "--config", configPath,
        "--url", posting.url,
        "--title", posting.title,
        "--company", posting.company,
      ]);
      runCli(["render-resume", "--workspace", workspace, "--config", configPath]);

      const storedRole = readJson(paths.rolesTracked, []).find((role) => role.company === posting.company && role.title === posting.title);
      const stored = storedRole && storedRole.posting;
      expect(stage, "posting saved with the role", Boolean(stored) && stored.source === "file" && fs.existsSync(path.join(workspace, stored.path || "")), stored ? stored.path : "no posting on role");
      const storedKeywords = stored && stored.keywords ? [...stored.keywords.required, ...stored.keywords.preferred] : [];
      expect(stage, "keywords stored on the role", storedKeywords.length > 0 && storedKeywords.length <= 25, `${storedKeywords.length} keyword(s)`);
      expect(stage, "tailor coverage uses the stored keywords", /Keyword coverage: \d+% .*stored posting keywords/u.test(tailorOutput), "tailor ran without --keywords");

      const reportRelative = storedRole && storedRole.resume && storedRole.resume.reportPath;
      const reportFile = reportRelative ? path.join(workspace, reportRelative) : "";
      const reportText = reportFile && fs.existsSync(reportFile) ? fs.readFileSync(reportFile, "utf8") : "";
      expect(stage, "tailor report written with a status line", /\*\*Status: (Ready to review|Draft made; job match not checked yet|Needs your confirmation|Blocked)\*\*/u.test(reportText), reportRelative || "no report path on role");
      expect(stage, "tracker row links the report", Boolean(reportRelative) && /^outputs\/tailor-reports\/[^/]+\.md$/u.test(reportRelative));

      const config = readJson(configPath);
      const schema = validateResumeConfig(config);
      expect(stage, "resume config schema valid", schema.valid, schema.errors.join("; "));

      const audit = auditResumeConfig(config, readJsonLines(paths.evidence));
      expect(stage, "claim audit passes", audit.errors.length === 0, `${audit.claimsFound.length} numeric claim(s) checked${audit.errors.length ? `: ${audit.errors[0]}` : ""}`);

      // One keyword number: the percent stored on the role, the same one the
      // person sees in the report. expected.json lists keywords the posting
      // extraction must store (a guard on extraction), not a second scoring list.
      const storedCoverage = storedRole && storedRole.resume && storedRole.resume.keywordCoverage;
      const storedPercent = storedCoverage && Number.isFinite(storedCoverage.percent) ? storedCoverage.percent : -1;
      const storedLower = new Set(storedKeywords.map((keyword) => keyword.toLowerCase()));
      const unextracted = (posting.expectedKeywords || []).filter((keyword) => !storedLower.has(keyword.toLowerCase()));
      expect(stage, "posting extraction stores the expected keywords", unextracted.length === 0, unextracted.length ? `not stored: ${unextracted.join(", ")}` : `${(posting.expectedKeywords || []).length} expected keyword(s) stored`);
      const noisy = (posting.forbiddenKeywords || []).filter((keyword) => storedLower.has(keyword.toLowerCase()));
      expect(stage, "posting extraction leaves out company names, places and filler", noisy.length === 0, noisy.length ? `stored: ${noisy.join(", ")}` : "no noise keywords stored");
      expect(
        stage,
        `stored keyword coverage >= ${posting.minKeywordPercent}%`,
        storedPercent >= posting.minKeywordPercent,
        `${storedPercent}% (missing: ${storedCoverage ? storedCoverage.missing.map((item) => item.keyword).join(", ") || "none" : "no coverage stored"})`,
      );
      const reportedPercent = (reportText.match(/covers \d+ of \d+ keywords \((\d+)%\)/u) || [])[1];
      expect(stage, "report shows the same keyword percent as the stored coverage", Number(reportedPercent) === storedPercent, `report ${reportedPercent || "none"}% vs stored ${storedPercent}%`);

      const lint = lintConfig(config, "resume");
      expect(stage, `style-lint warnings <= ${expected.maxStyleWarnings}`, lint.findings.length <= expected.maxStyleWarnings, `${lint.findings.length} warning(s)`);

      const score = proxyScore(config);
      expect(stage, `proxy score <= ${posting.maxProxyScore}`, score <= posting.maxProxyScore, `${score}`);

      const docxPath = path.join(paths.outputResumes, config.company, config.outputFileName);
      const docxExists = fs.existsSync(docxPath);
      expect(stage, "DOCX rendered", docxExists);
      let text = "";
      if (docxExists) {
        text = readDocxText(docxPath);
        expect(stage, "DOCX contains candidate name", text.includes(config.candidate.name));
      }
      outputs.push({ id: posting.id, text: normalizeText(text), goldenPath: path.join(personaDir, "golden", `${posting.id}.txt`) });

      if (withPages) {
        if (!soffice) {
          add(stage, "page count <= 1", "skip", "LibreOffice (soffice) not found");
        } else {
          const result = checkPageCount(docxPath);
          const pages = result.pages || 0;
          expect(stage, "page count <= 1", pages > 0 && pages <= 1, `${pages} page(s)`);
        }
      }

      if (options.golden) {
        const golden = posting.goldenPath || path.join(personaDir, "golden", `${posting.id}.txt`);
        if (options.updateGolden) {
          fs.mkdirSync(path.dirname(golden), { recursive: true });
          fs.writeFileSync(golden, normalizeText(text));
          add(stage, "golden DOCX text", "pass", "regenerated");
        } else {
          expect(stage, "golden DOCX text matches", fs.existsSync(golden) && normalizeText(fs.readFileSync(golden, "utf8")) === normalizeText(text), "run UPDATE_GOLDEN=1 to regenerate after an intended change");
        }
      }
    }

    // trackers
    stage = "tracker";
    runCli(["build-tracker", "--workspace", workspace]);
    runCli(["build-tracker", "--workspace", workspace, "--format", "html"]);
    const trackerMd = fs.readFileSync(paths.tracker, "utf8");
    const trackerHtml = fs.readFileSync(paths.htmlTracker, "utf8");
    for (const posting of expected.postings) {
      expect(stage, `tracker lists ${posting.company}`, trackerMd.includes(posting.company) && trackerHtml.includes(posting.company));
    }
    const tracked = readJson(paths.rolesTracked, []);
    expect(stage, "every posting is a tracked role", tracked.length === expected.postings.length, `${tracked.length} tracked`);
    expect(stage, "no role marked applied", tracked.every((role) => !role.application || role.application.status === "interested"), "tests never apply");

    // validate
    stage = "validate";
    runCli(["validate", "--workspace", workspace]);
    pass("validate", "workspace validate exits 0");

    // setup progress
    stage = "setup";
    const state = syncOnboardingState(workspace);
    const steps = onboardingSteps(state);
    const done = steps.filter((step) => step.done).length;
    const pending = steps.filter((step) => !step.done).map((step) => step.key);
    expect("setup", `setup reaches ${expected.setupSteps}/${steps.length}`, done >= expected.setupSteps, `${done}/${steps.length}${pending.length ? ` (pending: ${pending.join(", ")})` : ""}`);
  } catch (error) {
    add(stage, "stage completed", "fail", error.message);
  }

  // CLI output hygiene: commands name files relative to the workspace, never the machine's absolute path.
  const leaks = [];
  const roots = [tmpRoot, repoRoot].filter(Boolean);
  for (const { command, output } of cliLog) {
    if (roots.some((root) => output.includes(root))) leaks.push(command);
  }
  const leakList = [...new Set(leaks)];
  add("cli", "no absolute paths in CLI output", leakList.length === 0 ? "pass" : "fail", leakList.length ? `printed by: ${leakList.join(", ")}` : "");

  const bad = commandsRun.filter((command) => FORBIDDEN_COMMANDS.has(command));
  expect("guard", "no apply/approve-apply invoked", bad.length === 0);

  if (!options.keep) fs.rmSync(tmpRoot, { recursive: true, force: true });
  const failed = checks.filter((check) => check.status === "fail").length;
  return { persona: name, ok: failed === 0, failed, checks, outputs, workspace: options.keep ? workspace : null };
}

// Same formula as validateShortResume in src/core/resume-config.js:
// summary words + bullet words + 40 per job + 20 per education row.
function proxyScore(config) {
  const words = (text) => (typeof text === "string" ? text.split(/\s+/u).filter(Boolean).length : 0);
  let bullets = 0;
  let jobs = 0;
  for (const section of config.experienceSections || []) {
    for (const job of section.jobs || []) {
      jobs += 1;
      for (const bullet of job.bullets || []) bullets += words(bullet);
    }
  }
  return words(config.summary && config.summary.text) + bullets + 40 * jobs + 20 * (config.education || []).length;
}

function printScorecard(result) {
  const symbol = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" };
  console.log(`\n== Persona: ${result.persona} ==`);
  for (const check of result.checks) {
    const detail = check.detail ? `  (${check.detail})` : "";
    console.log(`  ${symbol[check.status]}  [${check.stage}] ${check.check}${detail}`);
  }
  const counts = { pass: 0, fail: 0, warn: 0, skip: 0 };
  result.checks.forEach((check) => { counts[check.status] += 1; });
  console.log(`  -> ${counts.pass} passed, ${counts.fail} failed, ${counts.warn} warning(s), ${counts.skip} skipped`);
}

function parseCliArgs(argv) {
  const options = { personas: [], keep: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--persona") options.personas.push(argv[(i += 1)]);
    else if (argv[i] === "--keep") options.keep = true;
    else if (argv[i] === "--out") options.out = argv[(i += 1)];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return options;
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const names = cli.personas.length > 0 ? cli.personas : listPersonas();
  const outDir = cli.out ? path.resolve(cli.out) : path.join(os.tmpdir(), "resume-builder-e2e");
  fs.mkdirSync(outDir, { recursive: true });
  console.log("== Resume Builder persona e2e (fictional personas; nothing is submitted) ==");

  let failed = 0;
  for (const name of names) {
    const result = await runPersona(name, { golden: true, updateGolden: process.env.UPDATE_GOLDEN === "1", keep: cli.keep });
    printScorecard(result);
    fs.writeFileSync(
      path.join(outDir, `scorecard-${name}.json`),
      `${JSON.stringify({ persona: name, ranAt: new Date().toISOString(), ok: result.ok, checks: result.checks }, null, 2)}\n`,
    );
    if (result.workspace) console.log(`  kept workspace: ${result.workspace}`);
    failed += result.failed;
  }
  console.log(`\nScorecards written to ${outDir}`);
  if (failed > 0) {
    console.error(`\ne2e FAILED: ${failed} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("\ne2e passed.");
  }
}

module.exports = { runPersona, listPersonas, assertSafeCommand, normalizeText, proxyScore, countPdfPages };

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
