"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { run } = require("../../src/cli/commands/serve");
const { workspacePaths, ensureDir } = require("../../src/core/workspace");

function createFixtureWorkspace() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-serve-"));
  const paths = workspacePaths(tmpDir);
  ensureDir(paths.outputs);
  fs.writeFileSync(paths.htmlTracker, "<html><body>Tracker</body></html>");
  return tmpDir;
}

function cleanupWorkspace(tmpDir) {
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

test("serve throws a clear error when the workspace has no outputs/ directory", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-serve-empty-"));
  try {
    await assert.rejects(() => run({ workspace: tmpDir, noOpen: true }), /No outputs\/ directory found/);
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("serve serves tracker.html at the root path and at its own path", async () => {
  const tmpDir = createFixtureWorkspace();
  const server = await run({ workspace: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const rootResponse = await get(port, "/");
    assert.equal(rootResponse.status, 200);
    assert.match(rootResponse.body, /Tracker/);

    const directResponse = await get(port, "/tracker.html");
    assert.equal(directResponse.status, 200);
    assert.match(directResponse.body, /Tracker/);
  } finally {
    server.close();
    cleanupWorkspace(tmpDir);
  }
});

test("serve returns 404 for a file that doesn't exist in outputs/", async () => {
  const tmpDir = createFixtureWorkspace();
  const server = await run({ workspace: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await get(port, "/does-not-exist.html");
    assert.equal(response.status, 404);
  } finally {
    server.close();
    cleanupWorkspace(tmpDir);
  }
});

test("serve blocks path traversal outside the workspace's outputs/ directory", async () => {
  const tmpDir = createFixtureWorkspace();
  const server = await run({ workspace: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await get(port, "/../../../../etc/passwd");
    assert.notEqual(response.status, 200);
  } finally {
    server.close();
    cleanupWorkspace(tmpDir);
  }
});

// Coverage for design plan 0006 D4 (issue #131): the /__status change-
// detection endpoint the tracker page's client script polls.

test("serve's /__status endpoint reports tracker.html's real mtime as JSON", async () => {
  const tmpDir = createFixtureWorkspace();
  const server = await run({ workspace: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const expectedMtime = fs.statSync(workspacePaths(tmpDir).htmlTracker).mtimeMs;
    const response = await get(port, "/__status");
    assert.equal(response.status, 200);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.path, "tracker.html");
    assert.strictEqual(body.mtimeMs, expectedMtime);
  } finally {
    server.close();
    cleanupWorkspace(tmpDir);
  }
});

test("serve's /__status endpoint reflects a real rebuild — mtime actually changes after tracker.html is rewritten", async () => {
  const tmpDir = createFixtureWorkspace();
  const server = await run({ workspace: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const before = JSON.parse((await get(port, "/__status")).body);

    fs.writeFileSync(workspacePaths(tmpDir).htmlTracker, "<html><body>Rebuilt</body></html>");
    // Force the mtime forward explicitly rather than relying on real clock
    // elapsed time — some filesystems report mtime at whole-second
    // resolution, which a fast test run could land within the same tick of.
    fs.utimesSync(workspacePaths(tmpDir).htmlTracker, new Date(), new Date(Date.now() + 5000));

    const after = JSON.parse((await get(port, "/__status")).body);
    assert.notStrictEqual(after.mtimeMs, before.mtimeMs, "a real rebuild must produce a different mtime the client can detect");
  } finally {
    server.close();
    cleanupWorkspace(tmpDir);
  }
});

test("serve's /__status endpoint reports mtimeMs: null when tracker.html doesn't exist yet, rather than erroring", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-serve-nohtml-"));
  ensureDir(workspacePaths(tmpDir).outputs);
  const server = await run({ workspace: tmpDir, port: 0, noOpen: true });
  const port = server.address().port;
  try {
    const response = await get(port, "/__status");
    assert.equal(response.status, 200);
    assert.strictEqual(JSON.parse(response.body).mtimeMs, null);
  } finally {
    server.close();
    cleanupWorkspace(tmpDir);
  }
});
