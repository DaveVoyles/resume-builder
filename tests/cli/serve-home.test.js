"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { run } = require("../../src/cli/commands/serve-home");
const { DRAFT_FILENAME } = require("../../src/core/first-draft");

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
    assert.doesNotMatch(response.body, /Save and finish later/);
    assert.doesNotMatch(response.body, /used them and your files/);
    assert.match(response.body, /from those answers only/);
    assert.match(response.body, /did not read files in my-documents/);
    assert.match(response.body, /text stub/);
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

test("serve-home save-intake writes a stub draft under output/", async () => {
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
    assert.equal(body.stub, true);
    assert.equal(body.filename, DRAFT_FILENAME);
    assert.equal(body.displayPath, `resume-builder / output / ${DRAFT_FILENAME}`);

    const draftPath = path.join(tmpDir, "output", DRAFT_FILENAME);
    assert.equal(fs.existsSync(draftPath), true);
    assert.match(fs.readFileSync(draftPath, "utf8"), /Goal: Operations manager/);

    const served = await get(port, `/output/${DRAFT_FILENAME}`);
    assert.equal(served.status, 200);
    assert.match(served.body, /STUB FIRST DRAFT/);
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
    assert.equal(fs.existsSync(path.join(tmpDir, "output", DRAFT_FILENAME)), false);
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
