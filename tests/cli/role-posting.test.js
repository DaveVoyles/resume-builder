"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const addRole = require("../../src/cli/commands/add-role");
const addLead = require("../../src/cli/commands/add-lead");
const tailor = require("../../src/cli/commands/tailor");
const bundle = require("../../src/cli/commands/study-guide-bundle");
const { validateRoles } = require("../../src/core/schemas");
const { readJson, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");

const POSTING = "# Developer platform product manager\n\nRequirements:\n- Experience with developer platform and launch coordination.\n- Python\n\nNice to have:\n- Terraform\n";

async function withWorkspace(fn) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "role-posting-"));
  const paths = workspacePaths(workspace);
  ensureDir(paths.outputs);
  ensureDir(paths.resumeConfigs);
  writeJson(paths.rolesTracked, []);
  writeJson(paths.rolesSeed, []);
  fs.writeFileSync(paths.evidence, "");
  writeJson(paths.profile, {
    candidate: { name: "Sample Candidate" },
    experience: [{ organization: "Fabrikam", title: "PM", startDate: "2020-01", endDate: null, highlights: [{ text: "Led launch coordination for a developer platform." }] }],
  });
  const jd = path.join(workspace, "jd-input.md");
  fs.writeFileSync(jd, POSTING);
  try {
    return await fn({ workspace, paths, jd });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

/** Runs fn with console.log captured; resolves to the captured lines. */
async function captureLogs(fn) {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return logs;
}

test("add-role --jd-file stores the posting text and keywords on the role, with relative paths", async () => {
  await withWorkspace(async ({ workspace, paths, jd }) => {
    const logs = await captureLogs(() => addRole.run({ workspace, tracked: true, company: "Example Corp", title: "PM", jdFile: jd }));
    const [role] = readJson(paths.rolesTracked);
    assert.equal(role.posting.path, `postings/${role.id}.md`);
    assert.equal(role.posting.source, "file");
    assert.ok(!Number.isNaN(Date.parse(role.posting.fetchedAt)));
    assert.ok(role.posting.keywords.required.includes("developer platform"));
    assert.ok(role.posting.keywords.preferred.includes("Terraform"));
    assert.equal(fs.readFileSync(path.join(workspace, role.posting.path), "utf8"), POSTING);
    assert.deepEqual(validateRoles([role], "roles"), []);
    assert.ok(logs.every((line) => !line.includes(workspace)), "CLI output must stay workspace-relative");
    assert.ok(logs.some((line) => line.includes(role.posting.path)));
  });
});

test("add-role --jd-text records source pasted; --keywords overrides the extracted keywords", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    await captureLogs(() => addRole.run({ workspace, tracked: true, company: "Example Corp", title: "PM", jdText: POSTING, keywords: "alpha, beta" }));
    const [role] = readJson(paths.rolesTracked);
    assert.equal(role.posting.source, "pasted");
    assert.deepEqual(role.posting.keywords, { required: ["alpha", "beta"], preferred: [] });
  });
});

test("add-role without a posting option leaves the role without posting metadata", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    await captureLogs(() => addRole.run({ workspace, tracked: true, company: "Example Corp", title: "PM" }));
    assert.equal(readJson(paths.rolesTracked)[0].posting, undefined);
    assert.ok(!fs.existsSync(path.join(workspace, "postings")));
  });
});

test("add-role on an existing role attaches a posting only when none is stored", async () => {
  await withWorkspace(async ({ workspace, paths, jd }) => {
    const base = { workspace, tracked: true, company: "Example Corp", title: "PM", url: "https://jobs.example.invalid/pm" };
    await captureLogs(() => addRole.run(base));
    await captureLogs(() => addRole.run({ ...base, jdFile: jd }));
    let roles = readJson(paths.rolesTracked);
    assert.equal(roles.length, 1);
    assert.ok(roles[0].posting.path);
    const first = roles[0].posting.fetchedAt;
    const other = path.join(workspace, "other.md");
    fs.writeFileSync(other, "Requirements:\n- Rust\n");
    await captureLogs(() => addRole.run({ ...base, jdFile: other }));
    roles = readJson(paths.rolesTracked);
    assert.equal(roles[0].posting.fetchedAt, first);
    assert.equal(fs.readFileSync(path.join(workspace, roles[0].posting.path), "utf8"), POSTING);
  });
});

test("add-role rejects a missing --jd-file", async () => {
  await withWorkspace(async ({ workspace }) => {
    assert.throws(() => addRole.run({ workspace, company: "X", title: "Y", jdFile: "nope.md" }), /--jd-file not found/);
  });
});

test("add-lead --jd-file saves the posting with the lead", async () => {
  await withWorkspace(async ({ workspace, jd }) => {
    await captureLogs(() => addLead.run({ workspace, company: "Example Corp", title: "PM", url: "https://jobs.example.invalid/pm", jdFile: jd }));
    const [lead] = readJson(path.join(workspace, "leads.json"));
    assert.match(lead.posting.path, /^postings\/lead_/u);
    assert.ok(fs.existsSync(path.join(workspace, lead.posting.path)));
    assert.ok(lead.posting.keywords.required.length > 0);
  });
});

const CONFIG = {
  schemaVersion: "1.0",
  company: "Example Corp",
  outputFileName: "example.docx",
  candidate: { name: "Sample Candidate", headline: "Product manager", contact: [{ text: "sample@example.invalid" }] },
  summary: { text: "Product manager focused on developer platform work." },
  experienceSections: [{ heading: "Experience", jobs: [{ title: "PM", company: "Fabrikam", dates: "2020 - Present", bullets: ["Led launch coordination for a developer platform."] }] }],
  skills: [["Python", "Scripting"]],
  education: [],
};

test("tailor --jd-file saves the posting and scores coverage with the stored keywords", async () => {
  await withWorkspace(async ({ workspace, paths, jd }) => {
    const configPath = path.join(paths.resumeConfigs, "example.json");
    writeJson(configPath, CONFIG);
    const logs = await captureLogs(() => tailor.run({ workspace, config: configPath, title: "PM", url: "https://jobs.example.invalid/pm", jdFile: jd }));
    const [role] = readJson(paths.rolesTracked);
    assert.ok(role.posting.keywords.required.includes("developer platform"));
    const line = logs.find((l) => l.startsWith("Keyword coverage:"));
    assert.ok(line, `expected coverage line in ${JSON.stringify(logs)}`);
    assert.match(line, /stored posting keywords/);
    assert.ok(logs.some((l) => l.startsWith("Missing:") && l.includes("Terraform")));
  });
});

test("tailor with no posting and no --keywords prints no coverage; explicit --keywords wins over stored", async () => {
  await withWorkspace(async ({ workspace, paths, jd }) => {
    const configPath = path.join(paths.resumeConfigs, "example.json");
    writeJson(configPath, CONFIG);
    let logs = await captureLogs(() => tailor.run({ workspace, config: configPath, title: "PM", url: "https://jobs.example.invalid/none" }));
    assert.ok(!logs.some((l) => l.startsWith("Keyword coverage:")));
    logs = await captureLogs(() => tailor.run({ workspace, config: configPath, title: "PM", url: "https://jobs.example.invalid/pm", jdFile: jd, keywords: "Python,Terraform" }));
    const line = logs.find((l) => l.startsWith("Keyword coverage:"));
    assert.ok(line && !/stored posting keywords/.test(line));
  });
});

test("study-guide-bundle includes stored posting text and keywords, and falls back to the URL", async () => {
  await withWorkspace(async ({ workspace, paths, jd }) => {
    const configPath = path.join(paths.resumeConfigs, "example.json");
    writeJson(configPath, CONFIG);
    await captureLogs(() => tailor.run({ workspace, config: configPath, title: "PM", url: "https://jobs.example.invalid/pm", jdFile: jd }));
    const [role] = readJson(paths.rolesTracked);
    await captureLogs(() => bundle.run({ workspace, id: role.id }));
    const full = readJson(path.join(paths.outputs, "study-guide-bundles", `${role.id}.json`));
    assert.equal(full.jobPosting.text, POSTING);
    assert.equal(full.jobPosting.url, "https://jobs.example.invalid/pm");
    assert.ok(full.jobPosting.keywords.required.length > 0);

    delete role.posting;
    writeJson(paths.rolesTracked, [role]);
    await captureLogs(() => bundle.run({ workspace, id: role.id }));
    const bare = readJson(path.join(paths.outputs, "study-guide-bundles", `${role.id}.json`));
    assert.equal(bare.jobPosting.text, null);
    assert.equal(bare.jobPosting.keywords, null);
    assert.equal(bare.jobPosting.url, "https://jobs.example.invalid/pm");
  });
});
