"use strict";

// Direct tests for stages that were only covered indirectly: find-similar,
// the demo-candidate workspace, export-pdf (with injected deps), and add-role
// edge cases. Everything is fictional and runs in temp dirs.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const findSimilar = require("../../src/cli/commands/find-similar");
const exportPdf = require("../../src/cli/commands/export-pdf");
const addRole = require("../../src/cli/commands/add-role");
const validate = require("../../src/cli/commands/validate");
const buildTracker = require("../../src/cli/commands/build-tracker");
const { readJson, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");
const { createDefaultProfile } = require("../../src/core/candidate-profile");

const repoRoot = path.resolve(__dirname, "..", "..");
const sampleDir = path.join(repoRoot, "examples", "sample-candidate");
const demoDir = path.join(repoRoot, "examples", "demo-candidate");

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

function quietly(fn) {
  const log = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
  }
}

function captureLog(fn) {
  const lines = [];
  const log = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  try {
    fn();
  } finally {
    console.log = log;
  }
  return lines;
}

// ---- find-similar ---------------------------------------------------------

test("find-similar scores candidates against the sample workspace and writes the review file", () => {
  const workspace = tmpDir("find-similar");
  try {
    fs.cpSync(sampleDir, workspace, { recursive: true });
    const output = path.join(workspace, "outputs", "similar-roles.md");
    const lines = captureLog(() =>
      findSimilar.run({ workspace, candidates: path.join(sampleDir, "roles.similar.candidates.json"), output }),
    );
    assert.match(lines.join("\n"), /Built similar-role review for \d+ candidate role/);
    const text = fs.readFileSync(output, "utf8");
    assert.match(text, /# Similar-role review/);
    assert.match(text, /Review-before-tracking rule/);
    assert.match(text, /Northstar Tools/);
    assert.match(text, /Review before tracking/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("find-similar --max limits rows and never promotes a role to tracked", () => {
  const workspace = tmpDir("find-similar-max");
  try {
    fs.cpSync(sampleDir, workspace, { recursive: true });
    const before = fs.readFileSync(path.join(workspace, "roles.tracked.json"), "utf8");
    const output = path.join(workspace, "outputs", "similar-roles.md");
    quietly(() => findSimilar.run({ workspace, candidates: path.join(sampleDir, "roles.similar.candidates.json"), output, max: 1 }));
    const rows = fs.readFileSync(output, "utf8").split("\n").filter((line) => /Review before tracking \|$/u.test(line));
    assert.equal(rows.length, 1);
    assert.equal(fs.readFileSync(path.join(workspace, "roles.tracked.json"), "utf8"), before);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("find-similar without --candidates still builds search briefs, and rejects a non-array candidates file", () => {
  const workspace = tmpDir("find-similar-empty");
  try {
    fs.cpSync(sampleDir, workspace, { recursive: true });
    const output = path.join(workspace, "outputs", "similar-roles.md");
    quietly(() => findSimilar.run({ workspace, output }));
    assert.match(fs.readFileSync(output, "utf8"), /No scored candidate roles yet/);

    const bad = path.join(workspace, "bad-candidates.json");
    writeJson(bad, { not: "an array" });
    assert.throws(() => findSimilar.run({ workspace, candidates: bad, output }), /JSON array/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

// ---- demo-candidate -------------------------------------------------------

test("examples/demo-candidate validates once its tracker is built", () => {
  const workspace = tmpDir("demo-candidate");
  try {
    fs.cpSync(demoDir, workspace, { recursive: true });
    quietly(() => buildTracker.run({ workspace }));
    quietly(() => validate.run({ workspace }));
    const roles = readJson(workspacePaths(workspace).rolesTracked);
    assert.ok(roles.length >= 10, "demo workspace has a realistic number of tracked roles");
    const statuses = new Set(roles.map((role) => role.status));
    assert.ok(statuses.size >= 3, "demo workspace has a mixed status spread");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("demo-candidate fails validation until the tracker exists", () => {
  const workspace = tmpDir("demo-candidate-missing");
  try {
    fs.cpSync(demoDir, workspace, { recursive: true });
    assert.throws(() => validate.run({ workspace }), /Missing required file/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

// ---- export-pdf with injected deps ---------------------------------------

function fakeConverter({ status = 0, writePdf = true, stderr = "" } = {}) {
  const calls = [];
  const fn = (command, args) => {
    calls.push({ command, args });
    const outdir = args[args.indexOf("--outdir") + 1];
    const docx = args[args.length - 1];
    if (writePdf) fs.writeFileSync(path.join(outdir, `${path.basename(docx, ".docx")}.pdf`), "%PDF-1.4 fake\n");
    return { status, stderr };
  };
  fn.calls = calls;
  return fn;
}

test("export-pdf converts through the injected soffice and writes next to the docx by default", () => {
  const dir = tmpDir("export-pdf");
  try {
    const docx = path.join(dir, "resume.docx");
    fs.writeFileSync(docx, "docx");
    const converter = fakeConverter();
    const out = quietly(() => exportPdf.run({ docx }, { findSoffice: () => "/fake/soffice", spawnSync: converter }));
    assert.equal(out, path.join(dir, "resume.pdf"));
    assert.ok(fs.existsSync(out));
    assert.equal(converter.calls.length, 1);
    assert.equal(converter.calls[0].command, "/fake/soffice");
    assert.deepEqual(converter.calls[0].args.slice(0, 3), ["--headless", "--convert-to", "pdf"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("export-pdf honors --out and creates its folder", () => {
  const dir = tmpDir("export-pdf-out");
  try {
    const docx = path.join(dir, "resume.docx");
    fs.writeFileSync(docx, "docx");
    const target = path.join(dir, "nested", "deeper", "custom.pdf");
    quietly(() => exportPdf.run({ docx, out: target }, { findSoffice: () => "soffice", spawnSync: fakeConverter() }));
    assert.ok(fs.existsSync(target));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("export-pdf reports conversion failures and bad inputs", () => {
  const dir = tmpDir("export-pdf-fail");
  try {
    const docx = path.join(dir, "resume.docx");
    fs.writeFileSync(docx, "docx");
    assert.throws(() => exportPdf.run({}), /requires --docx/);
    assert.throws(() => exportPdf.run({ docx: path.join(dir, "missing.docx") }, { findSoffice: () => "soffice" }), /DOCX not found/);
    assert.throws(
      () => exportPdf.run({ docx }, { findSoffice: () => "soffice", spawnSync: fakeConverter({ status: 1, writePdf: false, stderr: "boom" }) }),
      /soffice failed to convert.*boom/,
    );
    assert.throws(
      () => exportPdf.run({ docx }, { findSoffice: () => "soffice", spawnSync: fakeConverter({ status: 0, writePdf: false }) }),
      /soffice failed to convert/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- add-role edge cases --------------------------------------------------

function withWorkspace(fn) {
  const workspace = tmpDir("add-role-edge");
  const paths = workspacePaths(workspace);
  ensureDir(paths.outputs);
  writeJson(paths.profile, createDefaultProfile());
  writeJson(paths.rolesTracked, []);
  writeJson(paths.rolesSeed, []);
  try {
    return fn({ workspace, paths });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test("add-role needs a title and company unless the URL can supply them", () => {
  withWorkspace(({ workspace }) => {
    assert.throws(() => addRole.run({ workspace }), /requires --title and --company/);
    assert.throws(() => addRole.run({ workspace, title: "Analyst" }), /requires --title and --company/);
  });
});

test("add-role rejects an invalid URL without writing anything", () => {
  withWorkspace(({ workspace, paths }) => {
    assert.throws(() => addRole.run({ workspace, url: "not a url", tracked: true }), /Invalid role URL/);
    assert.deepEqual(readJson(paths.rolesTracked), []);
    assert.deepEqual(readJson(paths.rolesSeed), []);
  });
});

test("add-role infers company and title from a job URL", () => {
  withWorkspace(({ workspace, paths }) => {
    quietly(() => addRole.run({ workspace, tracked: true, url: "https://jobs.example.invalid/contoso/operations-manager" }));
    const [role] = readJson(paths.rolesTracked);
    assert.equal(role.company, "Example");
    assert.equal(role.title, "Operations Manager");
    assert.equal(role.source.method, "url");
  });
});

test("add-role dedupes by job URL even when the title changes, and by id for manual roles", () => {
  withWorkspace(({ workspace, paths }) => {
    const url = "https://jobs.example.invalid/contoso/analyst";
    quietly(() => addRole.run({ workspace, tracked: true, url, company: "Contoso", title: "Analyst" }));
    const lines = captureLog(() => addRole.run({ workspace, tracked: true, url, company: "Contoso", title: "Senior Analyst" }));
    assert.match(lines.join("\n"), /Role already exists in tracked/);
    assert.equal(readJson(paths.rolesTracked).length, 1);

    quietly(() => addRole.run({ workspace, company: "Fabrikam", title: "Planner" }));
    const again = captureLog(() => addRole.run({ workspace, company: "Fabrikam", title: "Planner" }));
    assert.match(again.join("\n"), /Role already exists in seed/);
    assert.equal(readJson(paths.rolesSeed).length, 1);
  });
});

test("add-role keeps notes, location, and apply URL, and defaults to a not-applied seed role", () => {
  withWorkspace(({ workspace, paths }) => {
    quietly(() =>
      addRole.run({
        workspace,
        company: "Contoso",
        title: "Planner",
        location: "Remote",
        notes: "Posting text goes here.",
        url: "https://jobs.example.invalid/contoso/planner",
        applyUrl: "https://apply.example.invalid/contoso/planner",
      }),
    );
    const [role] = readJson(paths.rolesSeed);
    assert.equal(role.status, "seed");
    assert.equal(role.applied, "Not applied");
    assert.equal(role.location, "Remote");
    assert.deepEqual(role.notes, ["Posting text goes here."]);
    assert.equal(role.urls.apply, "https://apply.example.invalid/contoso/planner");
    assert.deepEqual(readJson(paths.rolesTracked), []);
  });
});

test("add-role gives two different companies with the same title different ids", () => {
  withWorkspace(({ workspace, paths }) => {
    quietly(() => addRole.run({ workspace, tracked: true, company: "Contoso", title: "Analyst" }));
    quietly(() => addRole.run({ workspace, tracked: true, company: "Fabrikam", title: "Analyst" }));
    const roles = readJson(paths.rolesTracked);
    assert.equal(roles.length, 2);
    assert.notEqual(roles[0].id, roles[1].id);
  });
});
