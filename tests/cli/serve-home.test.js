"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const net = require("net");
const { run, defaultOpenFolder } = require("../../src/cli/commands/serve-home");
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

function getRaw(port, requestPath) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ port, host: "127.0.0.1" }, () => {
      socket.write(`GET ${requestPath} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`);
    });
    const chunks = [];
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const sep = raw.indexOf("\r\n\r\n");
      const headerText = sep === -1 ? raw : raw.slice(0, sep);
      const body = sep === -1 ? "" : raw.slice(sep + 4);
      const match = headerText.match(/^HTTP\/1\.\d (\d+)/);
      resolve({ status: match ? Number(match[1]) : 0, body });
    });
    socket.on("error", reject);
  });
}

function writeCandidateWorkspace(tmpDir, { trackerHtml } = {}) {
  const workspace = path.join(tmpDir, "candidate");
  fs.mkdirSync(path.join(workspace, "outputs"), { recursive: true });
  fs.writeFileSync(path.join(workspace, "profile.json"), '{"secret":"SECRET_PROFILE_CANARY"}\n');
  fs.writeFileSync(path.join(workspace, ".onboarding-state.json"), '{"secret":"SECRET_STATE_CANARY"}\n');
  if (trackerHtml !== undefined) {
    fs.writeFileSync(path.join(workspace, "outputs", "tracker.html"), trackerHtml);
  }
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

function execFileWithExit(code) {
  return (_cmd, _args, cb) => {
    if (code === 0) {
      cb(null);
      return;
    }
    const error = new Error(`Command failed with exit code ${code}`);
    error.code = code;
    cb(error);
  };
}

function execFileWithSpawnError(code) {
  return (_cmd, _args, cb) => {
    const error = new Error(`spawn ${code}`);
    error.code = code;
    cb(error);
  };
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
    assert.match(response.body, /href="\/tracker.html"/);
    assert.match(response.body, /Open my tracker/);
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

test("GET /api/onboarding-state does not write .onboarding-state.json", async () => {
  const tmpDir = createHomeRoot();
  const workspace = path.join(tmpDir, "candidate");
  fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, "profile.json"), '{"candidate":{}}\n');
  const statePath = path.join(workspace, ".onboarding-state.json");
  const original = '{"schemaVersion":"1.0","setupComplete":false}\n';
  fs.writeFileSync(statePath, original);

  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const beforeBytes = fs.readFileSync(statePath);
    const beforeStat = fs.statSync(statePath);
    const response = await get(port, "/api/onboarding-state");
    assert.equal(response.status, 200);
    const afterBytes = fs.readFileSync(statePath);
    const afterStat = fs.statSync(statePath);
    assert.equal(Buffer.compare(beforeBytes, afterBytes), 0);
    assert.equal(afterStat.mtimeMs, beforeStat.mtimeMs);
  } finally {
    server.close();
  }

  fs.rmSync(statePath, { force: true });
  const serverMissing = await run({ root: tmpDir, port: 0, noOpen: true });
  const portMissing = serverMissing.address().port;
  try {
    assert.equal(fs.existsSync(statePath), false);
    const response = await get(portMissing, "/api/onboarding-state");
    assert.equal(response.status, 200);
    assert.equal(fs.existsSync(statePath), false);
  } finally {
    serverMissing.close();
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
    assert.deepEqual(JSON.parse(ok.body), { opened: true });
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

test("serve-home serves the built tracker at /tracker.html", async () => {
  const tmpDir = createHomeRoot();
  writeCandidateWorkspace(tmpDir, { trackerHtml: "<html>TRACKER_CANARY</html>" });
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await getRaw(port, "/tracker.html");
    assert.equal(response.status, 200);
    assert.match(response.body, /TRACKER_CANARY/);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("serve-home returns a friendly page when tracker.html is missing", async () => {
  const tmpDir = createHomeRoot();
  writeCandidateWorkspace(tmpDir);
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await getRaw(port, "/tracker.html");
    assert.equal(response.status, 404);
    assert.match(response.body, /Tracker not built yet/);
    assert.match(response.body, /npm run workspace:tracker:html -- --workspace candidate/);
    assert.doesNotMatch(response.body, /SECRET_PROFILE_CANARY/);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("serve-home missing tracker page HTML-escapes the workspace label", async () => {
  const tmpDir = createHomeRoot();
  const workspaceLabel = `<script>alert(1)</script>"&`;
  const server = await run({ root: tmpDir, port: 0, noOpen: true, workspace: workspaceLabel });
  const port = server.address().port;
  try {
    const response = await getRaw(port, "/tracker.html");
    assert.equal(response.status, 404);
    assert.match(response.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(response.body, /&quot;/);
    assert.match(response.body, /&amp;/);
    assert.doesNotMatch(response.body, /<script>alert\(1\)<\/script>/);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("serve-home /tracker.html does not leak other candidate files or traversal", async () => {
  const tmpDir = createHomeRoot();
  writeCandidateWorkspace(tmpDir, { trackerHtml: "<html>TRACKER_CANARY</html>" });
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  const blocked = [
    "/candidate/profile.json",
    "/outputs/tracker.html",
    "/profile.json",
    "/.onboarding-state.json",
    "/../candidate/profile.json",
    "/tracker.html/../profile.json",
    "/%2e%2e%2fcandidate/profile.json",
    "/%2Fcandidate/profile.json",
    "/%252e%252e%252fcandidate/profile.json",
  ];
  try {
    for (const requestPath of blocked) {
      const response = await getRaw(port, requestPath);
      assert.equal(response.status, 404, `${requestPath} should 404`);
      assert.doesNotMatch(response.body, /SECRET_PROFILE_CANARY/, `${requestPath} leaked profile`);
      assert.doesNotMatch(response.body, /SECRET_STATE_CANARY/, `${requestPath} leaked onboarding state`);
      assert.doesNotMatch(response.body, /TRACKER_CANARY/, `${requestPath} leaked tracker`);
    }
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("serve-home open-folder reports opened false when the opener fails", async () => {
  const tmpDir = createHomeRoot();
  const server = await run(
    { root: tmpDir, port: 0, noOpen: true },
    { openFolder: () => Promise.reject(new Error("opener failed")) },
  );
  const port = server.address().port;
  try {
    const failed = await post(port, "/api/open-folder", { folder: "my-documents" });
    assert.equal(failed.status, 500);
    const body = JSON.parse(failed.body);
    assert.equal(body.opened, false);
    assert.match(body.error, /opener failed/);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("defaultOpenFolder treats win32 explorer exit 1 as opened", async () => {
  await defaultOpenFolder("/tmp/docs", {
    platform: "win32",
    execFileImpl: execFileWithExit(1),
  });
});

test("defaultOpenFolder treats win32 explorer exit 2 as failure", async () => {
  await assert.rejects(
    () =>
      defaultOpenFolder("/tmp/docs", {
        platform: "win32",
        execFileImpl: execFileWithExit(2),
      }),
    (error) => error.code === 2,
  );
});

test("defaultOpenFolder treats spawn ENOENT as failure on win32 and darwin", async () => {
  await assert.rejects(
    () =>
      defaultOpenFolder("/tmp/docs", {
        platform: "win32",
        execFileImpl: execFileWithSpawnError("ENOENT"),
      }),
    (error) => error.code === "ENOENT",
  );
  await assert.rejects(
    () =>
      defaultOpenFolder("/tmp/docs", {
        platform: "darwin",
        execFileImpl: execFileWithSpawnError("ENOENT"),
      }),
    (error) => error.code === "ENOENT",
  );
});

test("defaultOpenFolder treats darwin open exit 1 as failure", async () => {
  await assert.rejects(
    () =>
      defaultOpenFolder("/tmp/docs", {
        platform: "darwin",
        execFileImpl: execFileWithExit(1),
      }),
    (error) => error.code === 1,
  );
});

test("serve-home open-folder returns 200 when Windows explorer exits 1", async () => {
  const tmpDir = createHomeRoot();
  const server = await run(
    { root: tmpDir, port: 0, noOpen: true },
    {
      openFolder: (folderPath) =>
        defaultOpenFolder(folderPath, {
          platform: "win32",
          execFileImpl: execFileWithExit(1),
        }),
    },
  );
  const port = server.address().port;
  try {
    const ok = await post(port, "/api/open-folder", { folder: "my-documents" });
    assert.equal(ok.status, 200);
    assert.deepEqual(JSON.parse(ok.body), { opened: true });
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("serve-home open-folder times out when the opener never settles", async () => {
  const tmpDir = createHomeRoot();
  let resolveOpen;
  const hung = new Promise((resolve) => {
    resolveOpen = resolve;
  });
  const server = await run(
    { root: tmpDir, port: 0, noOpen: true },
    {
      openFolder: () => hung,
      openFolderTimeoutMs: 50,
    },
  );
  const port = server.address().port;
  try {
    const started = Date.now();
    const failed = await post(port, "/api/open-folder", { folder: "my-documents" });
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 1000, `open-folder took ${elapsed}ms`);
    assert.equal(failed.status, 504);
    assert.deepEqual(JSON.parse(failed.body), {
      opened: false,
      error: "Could not confirm the folder opened.",
    });
    resolveOpen();
    await new Promise((resolve) => setImmediate(resolve));
    const stillUp = await post(port, "/api/open-folder", { folder: "candidate" });
    assert.equal(stillUp.status, 400);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("home Introduction keeps the copy sentence and puts input paths in the agent note", async () => {
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await get(port, "/");
    assert.equal(response.status, 200);
    const agentNote = response.body.match(/<details id="agentNote">[\s\S]*?<\/details>/);
    assert.ok(agentNote, "expected For your AI agent details");
    assert.match(agentNote[0], /For your AI agent/);
    assert.match(agentNote[0], /candidate\/inputs\/resumes/);
    assert.match(agentNote[0], /candidate\/inputs\/notes/);

    const withoutDetails = response.body.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g, "");
    assert.match(withoutDetails, /Your AI agent copies your files into your private workspace so it can read them/);
    assert.match(withoutDetails, /Your originals stay where they are/);
    assert.doesNotMatch(withoutDetails, /candidate\/inputs/);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("Go to setup targets the setup form and focuses the first input", () => {
  const homePage = fs.readFileSync(path.join(__dirname, "../../onboarding/home.html"), "utf8");
  assert.match(homePage, /data-goto="setup">Go to setup</);
  assert.doesNotMatch(homePage, /data-goto="intro">Go to setup</);
  const script = homePage.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.match(script, /function openSetup\(/);
  assert.match(script, /getElementById\("setup"\)/);
  assert.match(script, /getElementById\("name"\)\.focus/);
  assert.match(script, /id==="setup"\)\{openSetup\(\)/);
});

test("Open folder fallback note is shown only when opening is not confirmed", () => {
  const homePage = fs.readFileSync(path.join(__dirname, "../../onboarding/home.html"), "utf8");
  const script = homePage.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.match(script, /opened===true/);
  assert.match(script, /note\.hidden=true/);
  assert.match(script, /Could not open the folder/);
  assert.doesNotMatch(script, /If nothing opened/);
});

test("GET /api/roles returns tracked Contoso Health role and server-side counts", async () => {
  const { countRoleStats } = require("../../src/core/role-view");
  const tmpDir = createHomeRoot();
  writeCandidateWorkspace(tmpDir, { trackerHtml: "<html></html>" });
  const workspace = path.join(tmpDir, "candidate");
  const rolesPath = path.join(workspace, "roles.tracked.json");
  const roles = [
    { id: "role-001", company: "Contoso Health", title: "Operations Manager", application: { status: "applied" } },
  ];
  fs.writeFileSync(rolesPath, JSON.stringify(roles, null, 2) + "\n");
  const beforeMtime = fs.statSync(rolesPath).mtimeMs;
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await get(port, "/api/roles");
    assert.equal(response.status, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.roles.length, 1);
    assert.equal(body.roles[0].company, "Contoso Health");
    assert.equal(body.roles[0].title, "Operations Manager");
    const expected = countRoleStats(roles);
    assert.equal(body.counts.total, expected.total);
    assert.equal(body.counts.applied, expected.applied);
    assert.equal(body.counts.interview, expected.interview);
    assert.equal(body.counts.readyToApply, expected.readyToApply);
    assert.equal(body.setupComplete, false);
    assert.equal(fs.statSync(rolesPath).mtimeMs, beforeMtime);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("home.html Jobs tab fetches /api/roles and has no copied bucket logic", () => {
  const homePage = fs.readFileSync(path.join(__dirname, "../../onboarding/home.html"), "utf8");
  assert.match(homePage, /fetch\("\/api\/roles"\)/);
  assert.match(homePage, /data-role-count="total"/);
  assert.match(homePage, /data-role-count="applied"/);
  assert.match(homePage, /applyRoles/);
  assert.match(homePage, /setupBtn\.hidden=Boolean\(data\.setupComplete\)/);
  assert.doesNotMatch(homePage, /statusBucket/);
  assert.doesNotMatch(homePage, /not-applied/);
});

test("GET /api/roles setupComplete is true after answering home questions and home.html honors it", async () => {
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const saved = await post(port, "/api/save-intake", {
      name: "Jordan Sample",
      goal: "Operations manager at a mid-size healthcare company",
    });
    assert.equal(saved.status, 200);
    const response = await get(port, "/api/roles");
    assert.equal(JSON.parse(response.body).setupComplete, true);
    const homePage = fs.readFileSync(path.join(__dirname, "../../onboarding/home.html"), "utf8");
    assert.match(homePage, /jobsGoToSetup/);
    assert.match(homePage, /setupBtn\.hidden=Boolean\(data\.setupComplete\)/);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("home Jobs counts match tracker funnel counts for the same roles.tracked.json", async () => {
  const buildTracker = require("../../src/cli/commands/build-tracker");
  const tmpDir = createHomeRoot();
  writeCandidateWorkspace(tmpDir, { trackerHtml: "<html></html>" });
  const workspace = path.join(tmpDir, "candidate");
  const roles = [
    { id: "role-001", company: "Contoso Health", title: "Operations Manager", application: { status: "applied" } },
    { id: "role-002", company: "Fabrikam", title: "Analyst", application: { status: "interview" } },
    { id: "role-003", company: "Northwind", title: "Coordinator" },
  ];
  fs.writeFileSync(path.join(workspace, "roles.tracked.json"), JSON.stringify(roles, null, 2) + "\n");
  buildTracker.run({ workspace, format: "html" });
  const html = fs.readFileSync(path.join(workspace, "outputs", "tracker.html"), "utf8");
  const funnel = {};
  const pattern = /<div class="funnel-stage">([^<]*)<\/div><div class="funnel-count">(\d+)<\/div>/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    funnel[match[1]] = Number(match[2]);
  }
  const totalMatch = html.match(/<div class="stat-value">(\d+)<\/div><div class="stat-label">📋 Total roles/);
  const readyMatch = html.match(/<div class="stat-value">(\d+)<\/div><div class="stat-label">🎯 Ready to apply/);
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const body = JSON.parse((await get(port, "/api/roles")).body);
    assert.equal(body.counts.applied, funnel.Applied);
    assert.equal(body.counts.interview, funnel.Interview);
    assert.equal(body.counts.total, Number(totalMatch[1]));
    assert.equal(body.counts.readyToApply, Number(readyMatch[1]));
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("home Save rebuilds tracker.html to the same step count as the state file", async () => {
  const { onboardingSteps } = require("../../src/core/onboarding-state");
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await post(port, "/api/save-intake", {
      name: "Jordan Sample",
      goal: "Operations manager at a mid-size healthcare company",
    });
    assert.equal(response.status, 200);
    const state = JSON.parse(fs.readFileSync(path.join(tmpDir, "candidate", ".onboarding-state.json"), "utf8"));
    const done = onboardingSteps(state).filter((step) => step.done).length;
    const html = fs.readFileSync(path.join(tmpDir, "candidate", "outputs", "tracker.html"), "utf8");
    assert.match(html, new RegExp(`Onboarding: ${done} of 10 steps`));
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("home Save still returns 200 when tracker rebuild throws and logs the failure", async () => {
  const tmpDir = createHomeRoot();
  const logs = [];
  const origError = console.error;
  console.error = (...args) => {
    logs.push(args.map(String).join(" "));
  };
  const server = await run(
    {
      root: tmpDir,
      port: 0,
      noOpen: true,
    },
    {
      rebuildTrackers: () => {
        throw new Error("rebuild boom");
      },
    },
  );
  const port = server.address().port;
  try {
    const response = await post(port, "/api/save-intake", {
      name: "Jordan Sample",
      goal: "Operations manager at a mid-size healthcare company",
    });
    assert.equal(response.status, 200);
    assert.match(logs.join("\n"), /rebuild boom/);
  } finally {
    console.error = origError;
    server.close();
    cleanup(tmpDir);
  }
});

test("home server serves /__status with tracker.html mtime so tracker load is not 404", async () => {
  const tmpDir = createHomeRoot();
  const trackerHtml = "<html><body>Tracker</body></html>";
  writeCandidateWorkspace(tmpDir, { trackerHtml });
  const trackerPath = path.join(tmpDir, "candidate", "outputs", "tracker.html");
  const expectedMtime = fs.statSync(trackerPath).mtimeMs;
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await get(port, "/__status");
    assert.equal(response.status, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.path, "tracker.html");
    assert.equal(body.mtimeMs, expectedMtime);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

test("updateSetupProgress updates aria-valuenow and the accessible label", () => {
  const homePage = fs.readFileSync(path.join(__dirname, "../../onboarding/home.html"), "utf8");
  const match = homePage.match(/function updateSetupProgress\(percent\)\{[\s\S]*?\n  \}/);
  assert.ok(match, "updateSetupProgress must exist in home.html");
  const attrs = {};
  const fill = { style: {} };
  const document = {
    querySelector(sel) {
      if (sel === ".progress") {
        return {
          querySelector() {
            return fill;
          },
          setAttribute(key, value) {
            attrs[key] = value;
          },
        };
      }
      return null;
    },
  };
  const runUpdate = new Function("document", `${match[0]}\nupdateSetupProgress(70);`);
  runUpdate(document);
  assert.equal(attrs["aria-valuenow"], "70");
  assert.equal(attrs["aria-label"], "Setup progress 70 percent");
  assert.equal(attrs["aria-valuetext"], "Setup progress 70 percent");
  assert.equal(fill.style.width, "70%");
});

test("home Save with Hybrid writes hybrid work mode into preferences", async () => {
  const { validatePreferences } = require("../../src/core/schemas");
  const tmpDir = createHomeRoot();
  const server = await run({ root: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await post(port, "/api/save-intake", {
      name: "Jordan Sample",
      goal: "Operations manager at a mid-size healthcare company",
      where: "Hybrid",
    });
    assert.equal(response.status, 200);
    const preferences = JSON.parse(fs.readFileSync(path.join(tmpDir, "candidate", "preferences.json"), "utf8"));
    assert.deepEqual(preferences.locations.workModes, ["hybrid"]);
    assert.deepEqual(validatePreferences(preferences), []);
  } finally {
    server.close();
    cleanup(tmpDir);
  }
});

