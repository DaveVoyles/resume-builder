"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const tailor = require("../../src/cli/commands/tailor");
const tailorReport = require("../../src/cli/commands/tailor-report");
const { readJson, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");
const { validateRoles } = require("../../src/core/schemas");
const { renderTracker } = require("../../src/renderers/markdown-tracker");

// Fictional data only. Nothing here applies to or submits anything.

function fictionalConfig(bullet = "Led launch coordination for an internal developer platform used by multiple product teams.") {
  return {
    schemaVersion: "1.0",
    company: "Fabrikam AI",
    candidate: { name: "Sample Candidate", headline: "Fictional engineer for tests", contact: [{ text: "Remote, US" }] },
    summary: { text: "Fictional product leader focused on developer platforms and AI-assisted workflows." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [{ title: "Senior Platform Program Manager", company: "Contoso Labs", dates: "2022 - Present", bullets: [bullet] }],
      },
    ],
    skills: [["Developer platforms", "Platform strategy, internal tooling, developer experience"]],
  };
}

function evidenceEntry(id, text) {
  return {
    id,
    type: "resume",
    fact: text,
    summary: `resume source ingested from inputs/resumes/${id}.md`,
    source: { kind: "resume", path: `inputs/resumes/${id}.md` },
    snippet: text,
    confidence: "source-text",
    metadata: { sha256: "fixture", extractionMode: "utf8" },
    createdAt: "2026-06-08T12:00:00.000Z",
  };
}

const evidence = [
  evidenceEntry("ev-001", "Led launch coordination for an internal developer platform used by multiple product teams."),
  evidenceEntry("ev-002", "Created a demo project for documenting AI-assisted developer workflow experiments."),
  evidenceEntry("ev-003", "Presented developer-platform strategy at a quarterly engineering review."),
];

const profile = {
  schemaVersion: "1.0",
  candidate: { id: "test-candidate", preferredName: "Sample Candidate", links: [] },
  skills: [],
  experience: [
    { id: "exp-001", organization: "Contoso Labs", title: "Senior Platform Program Manager", startDate: "2022-04", endDate: null, highlights: [{ text: "Led launch coordination." }] },
  ],
  projects: [],
  education: [],
  sources: [],
};

async function withWorkspace(config, fn) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "tailor-report-"));
  const paths = workspacePaths(workspace);
  ensureDir(paths.resumeConfigs);
  const configPath = path.join(paths.resumeConfigs, "fabrikam-ai.json");
  writeJson(configPath, config);
  fs.writeFileSync(paths.evidence, `${evidence.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  writeJson(paths.profile, profile);
  const log = [];
  const originalLog = console.log;
  console.log = (...args) => log.push(args.join(" "));
  try {
    await fn({ workspace, configPath, paths, log });
  } finally {
    console.log = originalLog;
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

const run = (workspace, configPath) => tailor.run({ workspace, config: configPath, title: "Developer platform product manager", url: "https://jobs.example.invalid/fabrikam/pm" });

test("tailor writes a plain-language report, records its path, and prints one line", async () => {
  await withWorkspace(fictionalConfig(), async ({ workspace, configPath, paths, log }) => {
    await run(workspace, configPath);
    const [role] = readJson(paths.rolesTracked);
    assert.equal(role.resume.reportPath, `outputs/tailor-reports/${role.id}.md`);
    const report = fs.readFileSync(path.join(workspace, role.resume.reportPath), "utf8");
    assert.match(report, /^# Resume report: Developer platform product manager at Fabrikam AI/u);
    assert.match(report, /\*\*Status: (Ready to review|Draft made; job match not checked yet|Needs your confirmation)\*\*/u);
    assert.match(report, /## What changed for this job/u);
    assert.match(report, /## Where the files are/u);
    assert.ok(log.includes(`Report ready: ${role.resume.reportPath}`), `expected the report line in: ${log.join(" | ")}`);
    assert.ok(!report.includes(workspace), "report must not contain absolute paths");
    assert.deepEqual(validateRoles([role], "roles"), []);
  });
});

test("tracker rows link the report (markdown and html)", async () => {
  await withWorkspace(fictionalConfig(), async ({ workspace, configPath, paths }) => {
    await run(workspace, configPath);
    const roles = readJson(paths.rolesTracked);
    const md = fs.readFileSync(paths.tracker, "utf8");
    assert.equal(md, renderTracker(roles));
    assert.match(md, new RegExp(`\\[Report\\]\\(tailor-reports/${roles[0].id}\\.md\\)`, "u"));
    const html = fs.readFileSync(paths.htmlTracker, "utf8");
    assert.ok(html.includes(`outputs/tailor-reports/${roles[0].id}.md`), "html tracker data should carry the report path");
  });
});

test("tailor-report regenerates the report from stored data without re-rendering", async () => {
  await withWorkspace(fictionalConfig(), async ({ workspace, configPath, paths, log }) => {
    await run(workspace, configPath);
    const [role] = readJson(paths.rolesTracked);
    const docx = path.join(workspace, role.resume.outputPath);
    const docxBefore = fs.statSync(docx).mtimeMs;

    // Stored data from other steps: a page count and keyword coverage.
    role.resume.pageCount = { pages: 2, checkedAt: "2026-10-08T00:00:00.000Z" };
    role.resume.keywordCoverage = {
      score: 50,
      covered: [{ keyword: "Platform", where: "summary" }],
      missing: [{ keyword: "Go", supported: false }],
      checkedAt: "2026-10-08T00:00:00.000Z",
    };
    writeJson(paths.rolesTracked, [role]);
    fs.rmSync(path.join(workspace, role.resume.reportPath));

    const result = await tailorReport.run({ workspace, id: role.id });
    assert.equal(result.status, "Needs your confirmation");
    const report = fs.readFileSync(path.join(workspace, role.resume.reportPath), "utf8");
    assert.match(report, /Runs over 1 page \(2 pages\): trim /u);
    assert.doesNotMatch(report, /Length estimate/u);
    assert.match(report, /The posting asks for "Go"/u);
    assert.equal(fs.statSync(docx).mtimeMs, docxBefore, "the resume file must not be touched");
    assert.ok(log.includes(`Report ready: ${role.resume.reportPath}`));

    // Also finds the role by company and title.
    const byName = await tailorReport.run({ workspace, company: "Fabrikam AI", title: "Developer platform product manager" });
    assert.equal(byName.reportPath, role.resume.reportPath);
    await assert.rejects(() => tailorReport.run({ workspace }), /requires --id/u);
    await assert.rejects(() => tailorReport.run({ workspace, id: "nope" }), /Role not found/u);
  });
});

test("a blocked audit still writes a Blocked report, tracks nothing, and renders nothing", async () => {
  await withWorkspace(fictionalConfig("Increased platform adoption by 500% in one quarter."), async ({ workspace, configPath, paths, log }) => {
    await assert.rejects(() => run(workspace, configPath), /evidence-backed claim audit/u);
    assert.deepEqual(readJson(paths.rolesTracked, []), []);
    assert.ok(!fs.existsSync(paths.outputResumes));
    const reports = fs.readdirSync(path.join(paths.outputs, "tailor-reports"));
    assert.equal(reports.length, 1);
    const report = fs.readFileSync(path.join(paths.outputs, "tailor-reports", reports[0]), "utf8");
    assert.match(report, /\*\*Status: Blocked\*\*/u);
    assert.match(report, /Where does "500%" in bullet 1 under your Senior Platform Program Manager at Contoso Labs job come from\?/u);
    assert.match(report, /I'll reword the line without the number/u);
    assert.ok(log.some((line) => /^Report ready: outputs\/tailor-reports\/.+\.md$/u.test(line)));
  });
});

test("tailor compares a config that extends a base and lists the edits", async () => {
  await withWorkspace(fictionalConfig(), async ({ workspace, paths }) => {
    const base = fictionalConfig();
    base.summary = { text: "Fictional product leader." };
    writeJson(path.join(paths.resumeConfigs, "base.json"), base);
    const child = {
      extends: "base.json",
      company: "Fabrikam AI",
      outputFileName: "sample-candidate-fabrikam-ai.docx",
      summary: { text: "Fictional product leader focused on developer platforms and AI-assisted workflows." },
    };
    const childPath = path.join(paths.resumeConfigs, "fabrikam-child.json");
    writeJson(childPath, child);
    await run(workspace, childPath);
    const [role] = readJson(paths.rolesTracked);
    const report = fs.readFileSync(path.join(workspace, role.resume.reportPath), "utf8");
    const section = report.split("## What changed for this job")[1].split("\n## ")[0];
    assert.match(section, /- Reworded the summary to: "Fictional product leader focused on developer platforms/u);
    assert.doesNotMatch(section, /nothing to compare/u);
  });
});

test("tailor with no base says there is nothing to compare yet", async () => {
  await withWorkspace(fictionalConfig(), async ({ workspace, configPath, paths }) => {
    await run(workspace, configPath);
    const [role] = readJson(paths.rolesTracked);
    const report = fs.readFileSync(path.join(workspace, role.resume.reportPath), "utf8");
    assert.match(report, /This is the first resume for this role, so there is nothing to compare yet\./u);
    assert.match(report, /## Not done yet/u);
    assert.match(report, /Give me the job posting text/u);
  });
});
