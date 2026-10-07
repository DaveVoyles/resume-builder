"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { run } = require("../../src/cli/commands/serve-home");
const { HOME_ANSWERS_FILENAME, HOME_STEP_TO_TRACKER_STEPS } = require("../../src/core/onboarding-state");
const { renderHtmlTracker } = require("../../src/renderers/html-tracker");

function createHomeRoot() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-home-"));
  fs.mkdirSync(path.join(tmpDir, "my-documents"));
  fs.mkdirSync(path.join(tmpDir, "output"));
  fs.writeFileSync(path.join(tmpDir, "my-documents", "START-HERE.txt"), "put files here\n");
  fs.writeFileSync(path.join(tmpDir, "my-documents", "sample-resume.txt"), "Jordan Sample\n");
  return tmpDir;
}

function cleanup(tmpDir) {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
}

function get(port, requestPath) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://localhost:${port}${requestPath}`, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      })
      .on("error", reject);
  });
}

function post(port, requestPath, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: "localhost",
        port,
        path: requestPath,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

test("serve-home serves the three-tab dashboard at / with Introduction selected", async () => {
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await get(port, "/");
    assert.equal(response.status, 200);
    assert.match(response.body, /aria-controls="intro" aria-selected="true"/);
    assert.match(response.body, />FAQ</);
    assert.match(response.body, />Jobs</);
    assert.match(response.body, /http:\/\/localhost:4321/);
    assert.doesNotMatch(response.body, /design mock used port 3000/);
    assert.match(response.body, /resume-builder \/ my-documents/);
    assert.match(response.body, /resume-builder \/ output/);
    assert.match(response.body, /Continue setup/);
    assert.match(response.body, /Required/);
    assert.match(response.body, /What is an AI agent\?/);
    assert.match(response.body, /No jobs yet/);
    assert.match(response.body, /This Jobs tab does not add jobs from the page/);
    assert.match(response.body, /This page does not add jobs/);
    assert.match(response.body, /candidate\/inputs\/resumes/);
    assert.match(response.body, /candidate\/inputs\/notes/);
    assert.match(response.body, /data-home-checklist/);
    assert.match(response.body, /data-home-step="answerQuestions"/);
    assert.doesNotMatch(response.body, /It shows up in the Jobs tab/);
    assert.doesNotMatch(response.body, /SAMPLE DATA/);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("serve-home intake copy is answers-only and keeps agent fill cues", async () => {
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await get(port, "/");
    assert.equal(response.status, 200);
    assert.match(response.body, /Save answers/);
    assert.match(response.body, /Answers saved\./);
    assert.doesNotMatch(response.body, /Save and finish later/);
    assert.doesNotMatch(response.body, /Your first draft is ready/);
    assert.doesNotMatch(response.body, /from those answers only/);
    assert.doesNotMatch(response.body, /text stub/);
    assert.match(response.body, /\.filled\{background:#f0fdf4;border-color:#22c55e\}/);
    assert.match(response.body, /\.agentnote\{font-size:\.82rem;color:var\(--ok\);font-weight:600\}/);
    assert.match(response.body, /class="agentnote" hidden/);
    assert.doesNotMatch(response.body, /value="Jordan Sample"/);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("serve-home lists sample files and serves them from my-documents", async () => {
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const list = await get(port, "/api/documents");
    assert.equal(list.status, 200);
    assert.deepEqual(JSON.parse(list.body).files, ["START-HERE.txt", "sample-resume.txt"]);

    const sample = await get(port, "/my-documents/sample-resume.txt");
    assert.equal(sample.status, 200);
    assert.match(sample.body, /Jordan Sample/);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("serve-home blocks path traversal outside my-documents", async () => {
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await get(port, "/my-documents/../../package.json");
    assert.notEqual(response.status, 200);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("GET /api/onboarding-state exposes the shared mapping and default steps", async () => {
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await get(port, "/api/onboarding-state");
    assert.equal(response.status, 200);
    const body = JSON.parse(response.body);
    assert.deepEqual(body.mapping, HOME_STEP_TO_TRACKER_STEPS);
    const download = body.homeSteps.find((step) => step.key === "downloadRb");
    const answers = body.homeSteps.find((step) => step.key === "answerQuestions");
    const draft = body.homeSteps.find((step) => step.key === "firstDraft");
    assert.equal(download.done, true);
    assert.equal(answers.done, false);
    assert.equal(draft.done, false);
    assert.deepEqual(draft.trackerKeys, ["firstDraftReady"]);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("serve-home save-intake writes answers, not a fake resume draft", async () => {
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await post(port, "/api/save-intake", {
      name: "Jordan Sample",
      goal: "Operations manager at a mid-size healthcare company",
    });
    assert.equal(response.status, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.message, "Answers saved.");
    assert.doesNotMatch(body.message, /draft/i);
    assert.equal(body.filename, HOME_ANSWERS_FILENAME);
    assert.equal(body.state.firstDraftReady, false);

    const answersPath = path.join(tmpDir, "candidate", HOME_ANSWERS_FILENAME);
    assert.equal(fs.existsSync(answersPath), true);
    assert.match(fs.readFileSync(answersPath, "utf8"), /Operations manager at a mid-size healthcare company/);

    const answerQuestions = body.homeSteps.find((step) => step.key === "answerQuestions");
    const firstDraft = body.homeSteps.find((step) => step.key === "firstDraft");
    const addFiles = body.homeSteps.find((step) => step.key === "addFiles");
    assert.equal(answerQuestions.done, true);
    assert.equal(firstDraft.done, false);
    assert.equal(addFiles.done, false);
    assert.equal(body.state.sections.basicInfo, true);
    assert.equal(body.state.sections.targetRole, true);
    assert.equal(body.state.sections.education, false);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("serve-home save-intake returns 400 when goal is missing", async () => {
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await post(port, "/api/save-intake", { name: "Jordan Sample" });
    assert.equal(response.status, 400);
    assert.match(response.body, /Goal is required/);
    assert.equal(fs.existsSync(path.join(tmpDir, "candidate", HOME_ANSWERS_FILENAME)), false);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("home Save writes shared onboarding state and tracker shows the same step done", async () => {
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await post(port, "/api/save-intake", {
      name: "Jordan Sample",
      goal: "Operations manager at a mid-size healthcare company",
    });
    assert.equal(response.status, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.message, "Answers saved.");

    const statePath = path.join(tmpDir, "candidate", ".onboarding-state.json");
    assert.equal(fs.existsSync(statePath), true);
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    assert.equal(state.sections.basicInfo, true);
    assert.equal(state.sections.targetRole, true);
    assert.equal(state.sections.education, false);
    assert.equal(state.materialIngested, false);
    assert.equal(state.firstRoleAdded, false);

    const homeAnswerQuestions = body.homeSteps.find((step) => step.key === "answerQuestions");
    assert.equal(homeAnswerQuestions.done, true);
    assert.deepEqual(homeAnswerQuestions.trackerKeys, HOME_STEP_TO_TRACKER_STEPS.answerQuestions);

    const html = renderHtmlTracker([], { onboardingState: state });
    assert.match(
      html,
      /onboarding-check-done">✓<\/span><div class="onboarding-item-text"><span class="onboarding-item-label">Basic information/,
    );
    assert.match(
      html,
      /onboarding-check-done">✓<\/span><div class="onboarding-item-text"><span class="onboarding-item-label">Target role/,
    );
    assert.match(html, /onboarding-item-label-pending">Education/);
    assert.doesNotMatch(html, /onboarding-item-label">Education/);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("serve-home open-folder only accepts my-documents or output", async () => {
  const tmpDir = createHomeRoot();
  const opened = [];
  const server = await run(
    { root: tmpDir, port: 0, noOpen: true },
    { openFolder: (folderPath) => opened.push(folderPath) },
  );
  const port = server.address().port;
  try {
    const ok = await post(port, "/api/open-folder", { folder: "my-documents" });
    assert.equal(ok.status, 200);
    assert.equal(opened.length, 1);
    assert.equal(opened[0], path.join(tmpDir, "my-documents"));

    const bad = await post(port, "/api/open-folder", { folder: "candidate" });
    assert.equal(bad.status, 400);
    assert.equal(opened.length, 1);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});
