"use strict";

// Page-fit check and unique per-role output names, with injected LibreOffice
// and pdfinfo so nothing here needs soffice installed.

process.env.RESUME_BUILDER_PAGE_CHECK = "off";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const renderResume = require("../../src/cli/commands/render-resume");
const tailor = require("../../src/cli/commands/tailor");
const pageCount = require("../../src/core/page-count");
const { validateResumeConfig } = require("../../src/core/resume-config");
const { readJson, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");

function fictionalConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Fabrikam AI",
    candidate: { name: "Sample Candidate", headline: "Fictional engineer for tests", contact: [{ text: "Remote, US" }] },
    summary: { text: "Fictional product leader focused on developer platforms." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [{ title: "Senior Platform Program Manager", company: "Contoso Labs", dates: "2022 - Present", bullets: ["Led launch coordination for an internal developer platform."] }],
      },
    ],
    skills: [["Developer platforms", "Platform strategy, internal tooling"]],
    ...overrides,
  };
}

const ONE_PAGE_PDF = "%PDF-1.4\n<< /Type /Pages /Count 1 >>\n<< /Type /Page /Parent 1 0 R >>\n";
const TWO_PAGE_PDF = "%PDF-1.4\n<< /Type /Pages /Count 2 >>\n<< /Type /Page >>\n<< /Type /Page >>\n";
const PACKED_PDF = "%PDF-1.5\n<< /Type /ObjStm /N 3 >>\nstream\n\nendstream\n";

// Fake soffice: writes `pdfBody` where --outdir points. pdfinfo calls answer `pdfinfoPages`.
function fakeSpawn({ pdfBody = ONE_PAGE_PDF, status = 0, stderr = "", writePdf = true, pdfinfoPages = null } = {}) {
  const calls = [];
  const fn = (cmd, args) => {
    calls.push({ cmd, args });
    if (cmd === "pdfinfo") {
      return pdfinfoPages === null ? { status: 1, stdout: "", stderr: "" } : { status: 0, stdout: `Title: x\nPages:          ${pdfinfoPages}\n`, stderr: "" };
    }
    const outdir = args[args.indexOf("--outdir") + 1];
    const docx = args[args.length - 1];
    if (writePdf) fs.writeFileSync(path.join(outdir, `${path.basename(docx, ".docx")}.pdf`), pdfBody);
    return { status, stdout: "", stderr };
  };
  fn.calls = calls;
  return fn;
}

function deps(spawn, soffice = "/fake/soffice") {
  return { findSoffice: () => soffice, spawnSync: spawn };
}

function quiet(fn) {
  const logs = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (...args) => logs.push(args.join(" "));
  console.warn = (...args) => logs.push(args.join(" "));
  const done = () => { console.log = origLog; console.warn = origWarn; };
  try {
    const result = fn();
    if (result && typeof result.then === "function") return result.then((value) => { done(); return { value, logs }; }, (error) => { done(); throw error; });
    done();
    return { value: result, logs };
  } catch (error) {
    done();
    throw error;
  }
}

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// ---- helper ---------------------------------------------------------------

test("checkPageCount: one page", () => {
  const dir = tmp("page-count-1-");
  try {
    const docx = path.join(dir, "r.docx");
    fs.writeFileSync(docx, "docx");
    const spawn = fakeSpawn({ pdfBody: ONE_PAGE_PDF });
    assert.deepEqual(pageCount.checkPageCount(docx, deps(spawn)), { available: true, pages: 1 });
    assert.equal(spawn.calls[0].cmd, "/fake/soffice");
    assert.ok(spawn.calls[0].args.includes("--headless"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkPageCount: two pages", () => {
  const dir = tmp("page-count-2-");
  try {
    const docx = path.join(dir, "r.docx");
    fs.writeFileSync(docx, "docx");
    assert.equal(pageCount.checkPageCount(docx, deps(fakeSpawn({ pdfBody: TWO_PAGE_PDF }))).pages, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkPageCount: compressed object streams fall back to pdfinfo, else unknown", () => {
  const dir = tmp("page-count-packed-");
  try {
    const docx = path.join(dir, "r.docx");
    fs.writeFileSync(docx, "docx");
    assert.equal(pageCount.checkPageCount(docx, deps(fakeSpawn({ pdfBody: PACKED_PDF, pdfinfoPages: 3 }))).pages, 3);
    const unknown = pageCount.checkPageCount(docx, deps(fakeSpawn({ pdfBody: PACKED_PDF })));
    assert.equal(unknown.available, true);
    assert.equal(unknown.pages, null);
    assert.match(unknown.reason, /page count/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("checkPageCount: soffice missing reports unavailable", () => {
  const spawn = fakeSpawn();
  const result = pageCount.checkPageCount("/nowhere/r.docx", deps(spawn, null));
  assert.equal(result.available, false);
  assert.equal(spawn.calls.length, 0);
});

test("checkPageCount: conversion failure reports the reason and no page count", () => {
  const dir = tmp("page-count-fail-");
  try {
    const docx = path.join(dir, "r.docx");
    fs.writeFileSync(docx, "docx");
    const result = pageCount.checkPageCount(docx, deps(fakeSpawn({ status: 1, writePdf: false, stderr: "boom" })));
    assert.equal(result.available, true);
    assert.equal(result.pages, null);
    assert.match(result.reason, /conversion failed: boom/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("describePageCount: plain-language messages, pageLimit, and the longest section", () => {
  const now = new Date("2026-01-02T03:04:05.000Z");
  const config = fictionalConfig();
  assert.equal(pageCount.describePageCount({ available: true, pages: 1 }, config, now).message, "Resume is 1 page.");
  const over = pageCount.describePageCount({ available: true, pages: 2 }, config, now);
  assert.equal(over.level, "warn");
  assert.match(over.message, /Resume runs to 2 pages \(limit 1\) — trim Experience .* or ask the candidate whether 2 pages is OK\./);
  assert.deepEqual(over.record, { pages: 2, checkedAt: "2026-01-02T03:04:05.000Z" });
  const allowed = pageCount.describePageCount({ available: true, pages: 2 }, { ...config, pageLimit: 2 }, now);
  assert.equal(allowed.level, "ok");
  assert.equal(pageCount.describePageCount({ available: false }, config, now).message, "Page count not checked (LibreOffice not installed).");
  assert.equal(pageCount.describePageCount({ available: false }, config, now).record, null);
  assert.match(pageCount.describePageCount({ available: true, pages: null, reason: "conversion failed" }, config, now).message, /not checked \(conversion failed\)/);
});

test("sectionWordCounts ranks sections by words", () => {
  const rows = pageCount.sectionWordCounts(fictionalConfig());
  assert.equal(rows[0].section, "Experience");
  assert.ok(rows.every((row, i) => i === 0 || rows[i - 1].words >= row.words));
});

test("pageLimit is validated and defaults to 1", () => {
  assert.equal(validateResumeConfig(fictionalConfig()).valid, true);
  assert.equal(validateResumeConfig(fictionalConfig({ pageLimit: 2 })).valid, true);
  for (const bad of [0, 4, 1.5, "2", null]) {
    const result = validateResumeConfig(fictionalConfig({ pageLimit: bad }));
    assert.equal(result.valid, false, `pageLimit ${JSON.stringify(bad)} should be rejected`);
    assert.ok(result.errors.some((error) => error.startsWith("pageLimit")));
  }
});

// ---- render-resume --------------------------------------------------------

test("render-resume prints the page result and returns the record", async () => {
  const dir = tmp("page-render-");
  try {
    const configPath = path.join(dir, "cfg.json");
    writeJson(configPath, fictionalConfig());
    const { value, logs } = await quiet(() => renderResume.runDetailed({ workspace: dir, config: configPath }, { pageCount: deps(fakeSpawn({ pdfBody: TWO_PAGE_PDF })) }));
    assert.equal(value.pageCount.pages, 2);
    assert.match(logs.join("\n"), /Resume runs to 2 pages/);
    const ok = await quiet(() => renderResume.runDetailed({ workspace: dir, config: configPath }, { pageCount: deps(fakeSpawn()) }));
    assert.match(ok.logs.join("\n"), /Resume is 1 page\./);
    const missing = await quiet(() => renderResume.runDetailed({ workspace: dir, config: configPath }, { pageCount: deps(fakeSpawn(), null) }));
    assert.match(missing.logs.join("\n"), /Page count not checked \(LibreOffice not installed\)/);
    assert.equal(missing.value.pageCount, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("render-resume --no-page-check never converts", async () => {
  const dir = tmp("page-render-skip-");
  try {
    const configPath = path.join(dir, "cfg.json");
    writeJson(configPath, fictionalConfig());
    const spawn = fakeSpawn();
    const { value } = await quiet(() => renderResume.runDetailed({ workspace: dir, config: configPath, noPageCheck: true }, { pageCount: deps(spawn) }));
    assert.equal(value.pageCount, null);
    assert.equal(spawn.calls.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("two roles at one company render to different files", async () => {
  const dir = tmp("page-unique-");
  try {
    const configPath = path.join(dir, "cfg.json");
    writeJson(configPath, fictionalConfig());
    const first = await quiet(() => renderResume.run({ workspace: dir, config: configPath, title: "Platform Engineer", noPageCheck: true }));
    const second = await quiet(() => renderResume.run({ workspace: dir, config: configPath, title: "Data Engineer", noPageCheck: true }));
    assert.equal(path.basename(first.value), "sample-candidate-fabrikam-ai-platform-engineer.docx");
    assert.equal(path.basename(second.value), "sample-candidate-fabrikam-ai-data-engineer.docx");
    assert.ok(fs.existsSync(first.value) && fs.existsSync(second.value));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an applied role elsewhere at the company does not block rendering another role's resume", async () => {
  const dir = tmp("page-guard-");
  try {
    const configPath = path.join(dir, "cfg.json");
    writeJson(configPath, fictionalConfig());
    writeJson(path.join(dir, "roles.tracked.json"), [
      { id: "r1", company: "Fabrikam AI", title: "Platform Engineer", application: { status: "applied" }, resume: { outputPath: "outputs/resumes/Fabrikam AI/sample-candidate-fabrikam-ai-platform-engineer.docx" } },
    ]);
    const base = { workspace: dir, config: configPath, noPageCheck: true };
    await quiet(() => renderResume.run({ ...base, title: "Platform Engineer" })); // first render, nothing there yet
    await assert.rejects(() => renderResume.run({ ...base, title: "Platform Engineer" }), /--include-applied/);
    await quiet(() => renderResume.run({ ...base, title: "Data Engineer" }));
    await quiet(() => renderResume.run({ ...base, title: "Data Engineer" })); // overwrite of an unrelated role's file is fine
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("findRoleResumePath resolves a linked path and the legacy candidate-company name", () => {
  const dir = tmp("page-legacy-");
  try {
    const folder = path.join(dir, "outputs", "resumes", "Fabrikam AI");
    fs.mkdirSync(folder, { recursive: true });
    const legacy = path.join(folder, renderResume.legacyOutputFileName(fictionalConfig()));
    assert.equal(path.basename(legacy), "sample-candidate-fabrikam-ai.docx");
    fs.writeFileSync(legacy, "docx");
    const role = { company: "Fabrikam AI", title: "PM", resume: {} };
    assert.equal(renderResume.findRoleResumePath(dir, role, "Sample Candidate"), legacy);
    const linked = path.join(folder, "linked.docx");
    fs.writeFileSync(linked, "docx");
    role.resume.outputPath = "outputs/resumes/Fabrikam AI/linked.docx";
    assert.equal(renderResume.findRoleResumePath(dir, role, "Sample Candidate"), linked);
    assert.equal(renderResume.findRoleResumePath(dir, { company: "Nobody" }, "Sample Candidate"), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- tailor ---------------------------------------------------------------

test("tailor persists role.resume.pageCount and uses a per-role file name", async () => {
  const workspace = tmp("page-tailor-");
  try {
    const paths = workspacePaths(workspace);
    ensureDir(paths.resumeConfigs);
    const configPath = path.join(paths.resumeConfigs, "fabrikam.json");
    writeJson(configPath, fictionalConfig());
    const bullet = "Led launch coordination for an internal developer platform.";
    fs.writeFileSync(paths.evidence, `${JSON.stringify({
      id: "ev-001", type: "resume", fact: bullet, summary: "resume bullet", source: { kind: "resume", path: "inputs/resumes/a.md" },
      snippet: bullet, confidence: "source-text", metadata: { extractionMode: "utf8" }, createdAt: "2026-06-08T12:00:00.000Z",
    })}\n`);
    writeJson(paths.profile, {
      schemaVersion: "1.0",
      candidate: { id: "t", preferredName: "Sample Candidate", links: [] },
      skills: [],
      experience: [{ id: "exp-001", organization: "Contoso Labs", title: "Senior Platform Program Manager", startDate: "2022-04", endDate: null, highlights: [{ text: bullet }] }],
      projects: [], education: [], sources: [],
    });

    const before = Date.now();
    await quiet(() => tailor.run({ workspace, config: configPath, title: "Platform Engineer", url: "https://jobs.example.invalid/1" }, { pageCount: deps(fakeSpawn({ pdfBody: TWO_PAGE_PDF })) }));
    await quiet(() => tailor.run({ workspace, config: configPath, title: "Data Engineer", url: "https://jobs.example.invalid/2" }, { pageCount: deps(fakeSpawn()) }));

    const roles = readJson(paths.rolesTracked);
    assert.equal(roles.length, 2);
    const [a, b] = roles;
    assert.equal(a.resume.pageCount.pages, 2);
    assert.ok(Date.parse(a.resume.pageCount.checkedAt) >= before - 1000);
    assert.equal(b.resume.pageCount.pages, 1);
    assert.notEqual(a.resume.outputPath, b.resume.outputPath);
    assert.ok(fs.existsSync(path.join(workspace, a.resume.outputPath)) && fs.existsSync(path.join(workspace, b.resume.outputPath)));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
