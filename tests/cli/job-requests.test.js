"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const command = require("../../src/cli/commands/job-requests");
const addRole = require("../../src/cli/commands/add-role");
const { addJobRequest, readJobRequests, markJobRequestDone } = require("../../src/core/job-requests");
const { createDefaultProfile } = require("../../src/core/candidate-profile");
const { defaultOnboardingState } = require("../../src/core/onboarding-state");
const { ensureDir, workspacePaths, writeJson } = require("../../src/core/workspace");

function withWorkspace(fn) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "job-requests-"));
  const paths = workspacePaths(workspace);
  ensureDir(paths.outputs);
  writeJson(paths.profile, createDefaultProfile());
  writeJson(paths.rolesTracked, []);
  writeJson(paths.rolesSeed, []);
  writeJson(paths.onboardingState, defaultOnboardingState());
  try {
    return fn(workspace);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

function capture(fn) {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(String(line));
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines.join("\n");
}

test("list prints pending requests with a text preview and no absolute paths", () => {
  withWorkspace((workspace) => {
    addJobRequest(workspace, { link: "https://jobs.example.com/a", text: "Ops manager\n\nat Example" });
    addJobRequest(workspace, { link: "https://jobs.example.com/b" });
    const out = capture(() => command.run({ workspace, _: ["list"] }));
    assert.match(out, /2 pending job requests/);
    assert.match(out, /https:\/\/jobs\.example\.com\/a/);
    assert.match(out, /Ops manager at Example/);
    assert.match(out, /posting text: \(none/);
    assert.equal(out.includes(os.tmpdir()), false);
  });
});

test("list says so when nothing is pending", () => {
  withWorkspace((workspace) => {
    assert.match(capture(() => command.run({ workspace, _: [] })), /No pending job requests/);
  });
});

test("done --link removes only the matching request; done --all clears the rest", () => {
  withWorkspace((workspace) => {
    addJobRequest(workspace, { link: "https://jobs.example.com/a" });
    addJobRequest(workspace, { link: "https://jobs.example.com/b" });
    capture(() => command.run({ workspace, _: ["done"], link: "https://jobs.example.com/a/" }));
    assert.deepEqual(readJobRequests(workspace).map((r) => r.link), ["https://jobs.example.com/b"]);
    assert.match(capture(() => command.run({ workspace, _: ["done"], link: "https://nope.example.com" })), /No pending/);
    capture(() => command.run({ workspace, _: ["done"], all: true }));
    assert.deepEqual(readJobRequests(workspace), []);
    assert.throws(() => command.run({ workspace, _: ["done"] }), /--link/);
    assert.throws(() => command.run({ workspace, _: ["bogus"] }), /Unknown/);
  });
});

test("add-role marks the matching pending request done and leaves others", () => {
  withWorkspace((workspace) => {
    addJobRequest(workspace, { link: "https://jobs.example.com/ops" });
    addJobRequest(workspace, { link: "https://jobs.example.com/other" });
    const out = capture(() => addRole.run({ workspace, tracked: true, url: "https://jobs.example.com/ops#apply", company: "Example", title: "Ops Manager" }));
    assert.match(out, /Marked 1 job request done/);
    assert.deepEqual(readJobRequests(workspace).map((r) => r.link), ["https://jobs.example.com/other"]);
  });
});

test("markJobRequestDone does not create the file when there is nothing to remove", () => {
  withWorkspace((workspace) => {
    assert.deepEqual(markJobRequestDone(workspace, "https://x.example.com"), []);
    assert.equal(fs.existsSync(path.join(workspace, "job-requests.json")), false);
  });
});
