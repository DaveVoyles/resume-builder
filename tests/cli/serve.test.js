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
