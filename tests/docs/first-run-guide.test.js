"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const guide = fs.readFileSync(
  path.join(__dirname, "../../docs/first-run/guide.html"),
  "utf8"
);
const speech = fs.readFileSync(
  path.join(__dirname, "../../docs/first-run/what-to-say.md"),
  "utf8"
);

test("the welcome page names the helper and keeps the sample inside the steps", () => {
  assert.equal((guide.match(/<details/g) || []).length, 8);
  assert.equal((guide.match(/Show this step/g) || []).length, 8);
  assert.doesNotMatch(guide, /Alex is not you/);
  assert.doesNotMatch(guide, /Meet Alex/);
  assert.match(guide, /nothing is sent until you say so/i);
  assert.match(guide, /your helper/i);
  assert.match(guide, /Sample, made up/);
  assert.match(guide, /Contoso Labs/);
  assert.match(guide, /Northwind Tools/);
});

test("the agent does not introduce the reader as Alex", () => {
  assert.doesNotMatch(speech, /Alex is not you/);
  assert.doesNotMatch(speech, /It is not you/);
  assert.match(speech, /One resume for one job/);
});
