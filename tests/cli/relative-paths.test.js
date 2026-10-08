"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const init = require("../../src/cli/commands/init");
const validate = require("../../src/cli/commands/validate");
const { displayWorkspace, displayPath } = require("../../src/core/role-lookup");

// CLI output should name files relative to the workspace (or working
// directory), never the machine's absolute location.

function captureLogs(fn) {
  const lines = [];
  const original = { log: console.log, warn: console.warn };
  console.log = (line) => lines.push(String(line));
  console.warn = (line) => lines.push(String(line));
  try {
    fn();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
  }
  return lines.join("\n");
}

test("displayWorkspace names a workspace outside the working directory by folder only", () => {
  const outside = path.join(os.tmpdir(), "some-private-place", "candidate");
  assert.equal(displayWorkspace(outside), "candidate");
});

test("displayWorkspace names a workspace inside the working directory relatively", () => {
  assert.equal(displayWorkspace(path.join(process.cwd(), "candidate")), "candidate");
  assert.equal(displayWorkspace(process.cwd()), ".");
});

test("displayPath is workspace-relative for files outside the working directory", () => {
  const workspace = path.join(os.tmpdir(), "elsewhere", "candidate");
  assert.equal(displayPath(workspace, path.join(workspace, "outputs", "tracker.md")), "outputs/tracker.md");
});

test("init and validate print no absolute path", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "relpaths-"));
  try {
    const initOut = captureLogs(() => init.run({ workspace, noServe: true }));
    assert.ok(!initOut.includes(workspace), `init leaked the workspace path: ${initOut}`);
    const validateOut = captureLogs(() => validate.run({ workspace }));
    assert.ok(!validateOut.includes(workspace), `validate leaked the workspace path: ${validateOut}`);
    assert.match(validateOut, /Workspace valid: /);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("validate names a missing file without the absolute workspace path", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "relpaths-missing-"));
  try {
    assert.throws(
      () => validate.run({ workspace }),
      (error) => !error.message.includes(workspace) && /Missing required file: /.test(error.message),
    );
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
