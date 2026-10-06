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

test("the briefing states the four outcomes and keeps samples fictional", () => {
  assert.equal((guide.match(/<details/g) || []).length, 4);
  assert.doesNotMatch(guide, /Alex is not you/);
  assert.doesNotMatch(guide, /Meet Alex/);
  assert.doesNotMatch(guide, /You do this/);
  assert.doesNotMatch(guide, /You could say/);
  assert.doesNotMatch(guide, /Show this step/);
  assert.match(guide, /Nothing is sent until you say so/);
  assert.match(guide, /private profile/i);
  assert.match(guide, /Fabrikam Studio/);
  assert.match(guide, /Contoso Labs/);
  assert.match(guide, /Northwind Tools/);
  assert.match(guide, /Fictional sample/);
  assert.match(guide, /does not send an application/);
});

test("the assistant script matches the briefing and does not talk down", () => {
  assert.doesNotMatch(speech, /Alex is not you/);
  assert.doesNotMatch(speech, /It is not you/);
  assert.doesNotMatch(speech, /eight short steps/);
  assert.match(speech, /What the assistant produces before anything leaves your desk/);
  assert.match(speech, /private profile/);
  assert.match(speech, /only after you approve that role/);
});
