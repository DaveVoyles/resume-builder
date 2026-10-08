"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const init = require("../../src/cli/commands/init");
const ingest = require("../../src/cli/commands/ingest");
const addRole = require("../../src/cli/commands/add-role");
const tailorPlan = require("../../src/cli/commands/tailor-plan");
const { buildTailorPlan } = require("../../src/core/tailor-plan");
const { readJson, workspacePaths } = require("../../src/core/workspace");

const repoRoot = path.resolve(__dirname, "..", "..");
const jordan = path.join(repoRoot, "examples", "personas", "jordan");

async function quiet(fn) {
  const logs = [];
  const original = { log: console.log, warn: console.warn };
  console.log = (...args) => logs.push(args.join(" "));
  console.warn = (...args) => logs.push(args.join(" "));
  try {
    await fn();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
  }
  return logs;
}

function copyInputs(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach((name) => fs.copyFileSync(path.join(from, name), path.join(to, name)));
}

/** Fictional persona workspace: init, copy inputs, ingest, save the posting with a tracked role. */
async function withPersonaWorkspace(postingExtra, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tailor-plan-"));
  const workspace = path.join(tmp, "candidate");
  try {
    await quiet(async () => {
      await init.run({ workspace, noServe: true });
      const paths = workspacePaths(workspace);
      copyInputs(path.join(jordan, "inputs", "resumes"), paths.resumes);
      copyInputs(path.join(jordan, "inputs", "notes"), paths.notes);
      await ingest.run({ workspace });
    });
    const posting = path.join(tmp, "posting.md");
    fs.writeFileSync(posting, `${fs.readFileSync(path.join(jordan, "postings", "harborview-operations-manager.md"), "utf8")}\n${postingExtra}\n`);
    await quiet(async () => {
      await addRole.run({ workspace, tracked: true, company: "Harborview Family Health", title: "Operations manager", url: "https://jobs.example.invalid/harborview/operations-manager", jdFile: posting });
    });
    return await fn({ workspace, paths: workspacePaths(workspace) });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test("tailor-plan ranks the persona's jobs and bullets by weighted keyword overlap", async () => {
  await withPersonaWorkspace("", async ({ workspace, paths }) => {
    // The agent can override the extracted keywords (add-role --keywords); use a fixed list so ranking is stable.
    const stored = readJson(paths.rolesTracked);
    stored[0].posting.keywords = { required: ["operations", "billing", "checklist"], preferred: ["trained", "records", "Salesforce", "Kubernetes"] };
    fs.writeFileSync(paths.rolesTracked, JSON.stringify(stored));
    let logs;
    await quiet(async () => {
      logs = await quiet(() => tailorPlan.run({ workspace, company: "Harborview Family Health", title: "Operations manager" }));
    });
    const [role] = readJson(paths.rolesTracked);
    const planFile = path.join(paths.outputs, "tailor-plans", `${role.id}.json`);
    assert.ok(fs.existsSync(planFile), "plan is written to outputs/tailor-plans/<role-id>.json");
    const plan = readJson(planFile);

    assert.equal(plan.role.id, role.id);
    assert.equal(plan.jobs.length, 2);
    const [first, second] = plan.jobs;
    assert.match(first.title, /Riverside Dental/u);
    assert.match(second.title, /Lakeview Clinic/u);
    assert.ok(first.score > second.score, "the office-manager job outranks the front-desk job");
    assert.equal(first.include, true);
    assert.equal(first.maxBullets, 6);
    assert.equal(second.include, true);
    assert.equal(second.maxBullets, 4);
    assert.match(first.bullets[0].text, /checklist|billing|operations/iu);
    assert.ok(first.bullets[0].score >= first.bullets[first.bullets.length - 1].score, "bullets are ordered by score");
    assert.ok(first.bullets.every((bullet) => bullet.evidenceIds.length === 1), "each bullet carries its evidence id");

    const supported = plan.keywords.supported.map((item) => item.keyword);
    assert.ok(supported.includes("billing") && supported.includes("checklist"), `got ${supported.join(", ")}`);
    const entry = plan.keywords.supported.find((item) => item.keyword === "billing");
    assert.equal(entry.importance, "required");
    assert.ok(entry.evidenceIds.length > 0);

    const unsupported = plan.keywords.doNotClaim.map((item) => item.keyword);
    assert.ok(unsupported.includes("Salesforce") && unsupported.includes("Kubernetes"), `got ${unsupported.join(", ")}`);
    plan.keywords.doNotClaim.forEach((item) => assert.match(item.note, /no evidence of this in the ledger/u));
    assert.ok(!plan.keywords.supported.some((item) => ["Salesforce", "Kubernetes"].includes(item.keyword)));
    assert.deepEqual(plan.limits, { maxFirstJobBullets: 6, maxLaterJobBullets: 4, maxProxyScore: 1000 });

    const text = logs.join("\n");
    assert.match(text, /Tailor plan for Harborview Family Health/u);
    assert.match(text, /Do not claim \(no evidence\): .*Salesforce/u);
    assert.match(text, /Plan saved: outputs\/tailor-plans\//u);
    assert.ok(!text.includes(workspace), "output uses workspace-relative paths only");
  });
});

test("tailor-plan is deterministic apart from its timestamp", async () => {
  await withPersonaWorkspace("", async ({ workspace, paths }) => {
    const [role] = readJson(paths.rolesTracked);
    const profile = readJson(paths.profile);
    const evidence = fs.readFileSync(paths.evidence, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    const now = new Date("2026-01-01T00:00:00.000Z");
    const a = buildTailorPlan({ role, profile, evidence, now });
    const b = buildTailorPlan({ role, profile, evidence, now });
    assert.deepEqual(a, b);
    assert.ok(workspace);
  });
});

test("tailor-plan reads profile.json experience highlights and respects bullet limits", () => {
  const highlights = Array.from({ length: 9 }, (_, i) => ({ text: `Ran scheduling review number ${i + 1}.`, evidenceIds: [`ev-${i + 1}`] }));
  const plan = buildTailorPlan({
    role: { id: "role_x", company: "X", title: "Y", posting: { keywords: { required: ["scheduling"], preferred: ["billing"] } } },
    profile: {
      skills: ["Billing", "Excel", "Scheduling tools"],
      experience: [
        { organization: "Acme", title: "Lead", startDate: "2020-01", endDate: null, highlights },
        { organization: "Beta", title: "Aide", startDate: "2018-01", endDate: "2019-12", highlights: [{ text: "Filed paper charts.", evidenceIds: ["ev-20"] }] },
      ],
    },
    evidence: [],
  });
  const acme = plan.jobs.find((job) => job.organization === "Acme");
  assert.equal(acme.bullets.filter((bullet) => bullet.recommended).length, 6, "first job is capped at 6 bullets");
  const beta = plan.jobs.find((job) => job.organization === "Beta");
  assert.equal(beta.include, false, "a job with no keyword overlap is left out when others match");
  assert.deepEqual(plan.skills.order.map((skill) => skill.name), ["Scheduling tools", "Billing", "Excel"]);
});

test("tailor-plan refuses a role that has no saved posting", async () => {
  await withPersonaWorkspace("", async ({ workspace, paths }) => {
    const roles = readJson(paths.rolesTracked);
    delete roles[0].posting;
    fs.writeFileSync(paths.rolesTracked, JSON.stringify(roles));
    await assert.rejects(() => tailorPlan.run({ workspace, id: roles[0].id }), /no saved posting/u);
  });
});

test("tailor-plan is registered in the CLI with usage text and an npm script", () => {
  const help = spawnSync(process.execPath, [path.join(repoRoot, "src", "cli", "index.js"), "--help"], { encoding: "utf8" });
  assert.match(help.stdout, /tailor-plan --workspace <dir>/u);
  const pkg = readJson(path.join(repoRoot, "package.json"));
  assert.equal(pkg.scripts["workspace:tailor-plan"], "node src/cli/index.js tailor-plan");
  const missing = spawnSync(process.execPath, [path.join(repoRoot, "src", "cli", "index.js"), "tailor-plan", "--workspace", os.tmpdir()], { encoding: "utf8" });
  assert.notEqual(missing.status, 0);
  assert.doesNotMatch(missing.stderr, /Unknown command/u);
});
