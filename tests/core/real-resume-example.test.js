"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { readDocxText, readDocxEntry } = require("../helpers/read-docx-text");

const dir = path.join(__dirname, "..", "..", "examples", "real-resume", "owner");
const docx = path.join(dir, "owner-resume.docx");
const txt = path.join(dir, "owner-resume.txt");

const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/gu;
const PHONE = /(?:\+?\d{1,2}[\s.-])?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/gu;

function emailsOutsideExample(text) {
  return (text.match(EMAIL) || []).filter((address) => !/@example\.com$/iu.test(address));
}

const parts = {
  "plain text copy": () => fs.readFileSync(txt, "utf8"),
  "docx body text": () => readDocxText(docx),
  "docx document.xml": () => readDocxEntry(docx, "word/document.xml"),
  "docx hyperlinks": () => readDocxEntry(docx, "word/_rels/document.xml.rels"),
  "docx core properties": () => readDocxEntry(docx, "docProps/core.xml"),
};

for (const [name, read] of Object.entries(parts)) {
  test(`real resume example: ${name} has no real email address or phone number`, () => {
    const text = read();
    assert.deepEqual(emailsOutsideExample(text), []);
    assert.doesNotMatch(text.replace(/\d{11,}/gu, ""), PHONE, "no phone number");
  });
}

test("real resume example: the scrubbed copy still reads as a resume", () => {
  const text = fs.readFileSync(txt, "utf8");
  assert.match(text, /email-removed@example\.com/u);
  assert.match(text, /PROFESSIONAL EXPERIENCE/u);
  assert.ok(text.length > 3000);
});
