"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { readJson } = require("../../src/core/workspace");
const { findTrackedRole } = require("../../src/core/role-lookup");
const buildTracker = require("../../src/cli/commands/build-tracker");
const validate = require("../../src/cli/commands/validate");

// A brand-new user with no workspace yet should be told what to run, and
// should never see a machine's absolute path in the message.

function emptyDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rb-firstrun-"));
}

test("a missing workspace file says to run setup and prints no absolute path", () => {
  const dir = emptyDir();
  assert.throws(
    () => readJson(path.join(dir, "candidate", "profile.json")),
    (error) => /npm run setup/.test(error.message) && !error.message.includes(dir),
  );
});

test("build-tracker on a missing workspace fails with the setup hint and creates nothing", () => {
  const dir = emptyDir();
  const workspace = path.join(dir, "candidate");
  assert.throws(() => buildTracker.run({ workspace }), /npm run setup/);
  assert.equal(fs.existsSync(workspace), false);
});

test("validate on a missing workspace adds the setup hint once", () => {
  const dir = emptyDir();
  assert.throws(
    () => validate.run({ workspace: path.join(dir, "candidate") }),
    (error) => (error.message.match(/npm run setup/g) || []).length === 1 && !error.message.includes(dir),
  );
});

test("an unknown role explains seed roles and the --id option", () => {
  assert.throws(
    () => findTrackedRole([], { company: "Acme", title: "Lead" }, "tailor-plan"),
    /seed role[\s\S]*add-role --jd-file|--id/,
  );
});
