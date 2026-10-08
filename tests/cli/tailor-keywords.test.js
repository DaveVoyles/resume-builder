"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readDocxText } = require("../helpers/read-docx-text");
const tailor = require("../../src/cli/commands/tailor");
const scoreKeywords = require("../../src/cli/commands/score-keywords");
const { readJson, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");

// Keyword coverage saved on the role by `tailor` and `score-keywords`, and
// `extends` resolution through `tailor`. Fictional data only.

function config(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Fabrikam AI",
    candidate: { name: "Sample Candidate", headline: "Fictional engineer for tests", contact: [{ text: "Remote, US" }] },
    summary: { text: "Fictional product leader focused on developer platforms and AI-assisted workflows." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Platform Program Manager",
            company: "Contoso Labs",
            dates: "2022 - Present",
            bullets: ["Led launch coordination for an internal developer platform used by multiple product teams."],
          },
        ],
      },
    ],
    skills: [["Developer platforms", "Platform strategy, internal tooling, developer experience"]],
    ...overrides,
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

const EVIDENCE = [
  evidenceEntry("ev-001", "Led launch coordination for an internal developer platform used by multiple product teams."),
  evidenceEntry("ev-003", "Presented developer-platform strategy at a quarterly engineering review."),
];

async function withWorkspace(fn) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "tailor-keywords-"));
  const paths = workspacePaths(workspace);
  ensureDir(paths.resumeConfigs);
  fs.writeFileSync(paths.evidence, `${EVIDENCE.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  writeJson(paths.profile, {
    schemaVersion: "1.0",
    candidate: { id: "test-candidate", preferredName: "Sample Candidate", links: [] },
    skills: [],
    experience: [
      {
        id: "exp-001",
        organization: "Contoso Labs",
        title: "Senior Platform Program Manager",
        startDate: "2022-04",
        endDate: null,
        highlights: [{ text: "Led launch coordination for an internal developer platform." }],
      },
    ],
    projects: [],
    education: [],
    sources: [],
  });
  try {
    await fn({ workspace, paths });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

async function captureConsole(fn) {
  const lines = [];
  const original = { log: console.log, warn: console.warn };
  console.log = (...args) => lines.push(args.join(" "));
  console.warn = (...args) => lines.push(args.join(" "));
  try {
    await fn();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
  }
  return lines.join("\n");
}

test("tailor saves keyword coverage on the role and prints evidence-aware notes with relative paths", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    const configPath = path.join(paths.resumeConfigs, "fabrikam-ai.json");
    writeJson(configPath, config());
    const output = await captureConsole(() => tailor.run({
      workspace,
      config: configPath,
      title: "Developer platform product manager",
      keywords: "developer platform,AI-assisted,Kubernetes,engineering review",
    }));
    const [role] = readJson(paths.rolesTracked);
    const record = role.resume.keywordCoverage;
    assert.ok(record, "keyword coverage is saved on role.resume");
    assert.ok(!Number.isNaN(Date.parse(record.checkedAt)));
    assert.equal(typeof record.score, "number");
    assert.deepEqual(record.covered.map((item) => item.keyword), ["developer platform", "AI-assisted"]);
    assert.ok(record.covered[0].locations.includes("summary"));
    const missing = Object.fromEntries(record.missing.map((item) => [item.keyword, item]));
    assert.equal(missing.Kubernetes.supported, false, "Kubernetes has no evidence, so it is not suggested");
    assert.equal(missing["engineering review"].supported, true, "engineering review appears in the evidence ledger");
    assert.deepEqual(missing["engineering review"].evidenceIds, ["ev-003"]);

    assert.match(output, /Keyword coverage: 50% \(2\/4\), weighted 50%/u);
    assert.match(output, /Kubernetes: no evidence of this in the ledger — ask the candidate before adding/u);
    assert.match(output, /engineering review: appears in your evidence/u);
    assert.match(output, /Tailored resume for Fabrikam AI — Developer platform product manager: outputs\/resumes\//u);
    const ownLines = output.split("\n").filter((line) => /^(Keyword coverage|Present|Missing|  - |Tailored resume)/u.test(line));
    assert.ok(ownLines.length >= 5 && ownLines.every((line) => !line.includes(workspace)), "tailor's own lines use workspace-relative paths only");

    // The tracker shows the saved score next to the resume link.
    const html = fs.readFileSync(paths.htmlTracker, "utf8");
    assert.match(html, /"keywordScore": 50/u);
    assert.match(html, /kw-score/u);
  });
});

test("score-keywords with a role saves the stored posting keywords' coverage, required weighted 2x", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    const configPath = path.join(paths.resumeConfigs, "fabrikam-ai.json");
    writeJson(configPath, config());
    await captureConsole(() => tailor.run({ workspace, config: configPath, title: "Developer platform product manager" }));
    const roles = readJson(paths.rolesTracked);
    roles[0].posting = {
      path: "postings/x.md",
      fetchedAt: "2026-01-01T00:00:00.000Z",
      source: "file",
      keywords: { required: ["developer platform", "Kubernetes"], preferred: ["internal tooling"] },
    };
    delete roles[0].resume.keywordCoverage;
    writeJson(paths.rolesTracked, roles);

    const output = await captureConsole(() => scoreKeywords.run({ workspace, config: configPath, company: "Fabrikam AI", title: "Developer platform product manager" }));
    const [role] = readJson(paths.rolesTracked);
    const record = role.resume.keywordCoverage;
    assert.equal(record.score, 60, "(2 + 1) of (2 + 2 + 1)");
    assert.equal(record.percent, 67);
    assert.equal(record.source, "stored posting keywords");
    assert.deepEqual(record.missing.map((item) => [item.keyword, item.importance, item.supported]), [["Kubernetes", "required", false]]);
    assert.match(output, /weighted 60%/u);
    assert.match(output, /Kubernetes: no evidence of this in the ledger/u);
  });
});

test("score-keywords without a role still just prints and saves nothing", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    const configPath = path.join(paths.resumeConfigs, "fabrikam-ai.json");
    writeJson(configPath, config());
    const keywordsPath = path.join(workspace, "keywords.json");
    writeJson(keywordsPath, ["developer platform", "Kubernetes"]);
    const result = await scoreKeywords.run({ workspace, config: configPath, keywords: keywordsPath });
    assert.equal(result.percent, 50);
    assert.ok(!fs.existsSync(paths.rolesTracked));
    await assert.rejects(() => scoreKeywords.run({ workspace, config: configPath }), /requires --keywords/u);
  });
});

test("tailor resolves a resume config that extends a base config", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    writeJson(path.join(paths.resumeConfigs, "base.json"), config({ company: "Base Co", outputFileName: "base.docx" }));
    const childPath = path.join(paths.resumeConfigs, "fabrikam-child.json");
    writeJson(childPath, {
      extends: "base.json",
      company: "Fabrikam AI",
      summary: { text: "Fictional product leader for developer platforms." },
    });
    const result = await captureResult(() => tailor.run({ workspace, config: childPath, title: "Platform PM" }));
    const expectedDocx = path.join(workspace, "outputs", "resumes", "Fabrikam AI", "sample-candidate-fabrikam-ai.docx");
    assert.strictEqual(result.outputPath, expectedDocx, "company is the child's, and the base outputFileName is not inherited");
    const text = readDocxText(expectedDocx);
    assert.match(text, /Fictional product leader for developer platforms/u);
    assert.match(text, /Led launch coordination/u, "experience comes from the base");
    const [role] = readJson(paths.rolesTracked);
    assert.strictEqual(role.resume.configPath, "resume-configs/fabrikam-child.json");
  });
});

async function captureResult(fn) {
  let result;
  await captureConsole(async () => {
    result = await fn();
  });
  return result;
}
