"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const addLead = require("../../src/cli/commands/add-lead");
const exportPdf = require("../../src/cli/commands/export-pdf");
const approveApply = require("../../src/cli/commands/approve-apply");
const apply = require("../../src/cli/commands/apply");
const { fillFields } = require("../../src/core/apply-fill");

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "apply-flow-"));
}

function quiet(fn) {
  const original = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = original;
  }
}

test("add-lead appends, validates, and refuses duplicates", () => {
  const dir = tmp();
  const base = { workspace: dir, company: "Contoso", title: "Engineer", url: "https://jobs.example.invalid/1" };
  quiet(() => addLead.run({ ...base, fit: "good" }));
  const leads = JSON.parse(fs.readFileSync(path.join(dir, "leads.json"), "utf8"));
  assert.equal(leads.length, 1);
  assert.match(leads[0].createdAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(leads[0].fit, "good");
  assert.throws(() => addLead.run(base), /Duplicate/);
  assert.throws(() => addLead.run({ ...base, url: "ftp://x.example.invalid" }), /http/);
  assert.throws(() => addLead.run({ workspace: dir, company: "Acme" }), /requires/);
});

test("export-pdf explains missing soffice", () => {
  const dir = tmp();
  const docx = path.join(dir, "r.docx");
  fs.writeFileSync(docx, "x");
  assert.throws(() => exportPdf.run({ docx }, { findSoffice: () => null }), /LibreOffice.*soffice/);
});

test("apply needs approval, then prints dry run", () => {
  const dir = tmp();
  const opts = { workspace: dir, company: "Fabrikam", title: "Analyst", dryRun: true };
  assert.throws(() => apply.run(opts), /approve-apply/);
  quiet(() => approveApply.run({ workspace: dir, company: "Fabrikam", title: "Analyst", note: "ok" }));
  const rows = JSON.parse(fs.readFileSync(path.join(dir, "apply-approvals.json"), "utf8"));
  assert.equal(rows[0].note, "ok");
  const result = quiet(() => apply.run(opts));
  assert.equal(result.confirmSubmit, false);
  assert.equal(quiet(() => apply.run({ ...opts, confirmSubmit: true })).confirmSubmit, true);
});

test("practice form fills dummy contact fields and leaves the essay blank", () => {
  const { fillPracticeForm } = require("../../src/core/fill-practice-form");
  const html = fs.readFileSync(path.join(__dirname, "../../examples/practice-application.html"), "utf8");
  const filled = fillPracticeForm(html, {
    name: "Alex Rivera",
    email: "alex.rivera@example.invalid",
    phone: "555-0100",
    location: "Raleigh, NC",
  });
  assert.match(filled.html, /value="Alex Rivera"/);
  assert.match(filled.html, /value="alex.rivera@example.invalid"/);
  assert.match(filled.html, /value="555-0100"/);
  assert.match(filled.html, /value="Raleigh, NC"/);
  assert.match(filled.html, /<textarea id="why"[^>]*><\/textarea>/);
  assert.deepEqual(filled.missing, ["Why this role?"]);
  assert.equal(filled.submitted, false);
});

test("fillFields maps profile values and never invents a phone", () => {
  const fields = [
    { id: "full_name", label: "Full name" },
    { id: "email", label: "Email" },
    { id: "p", label: "Phone number" },
  ];
  const profile = { name: "Alex Rivera", email: "alex.rivera@example.invalid", phone: "" };
  const a = fillFields(profile, fields, true);
  assert.deepEqual(a.missing, ["Phone number"]);
  assert.equal(a.submitted, false);
  assert.equal(a.values.email, profile.email);
  const b = fillFields({ ...profile, phone: "555-0100" }, fields, true);
  assert.equal(b.submitted, true);
  assert.equal(fillFields({ ...profile, phone: "555-0100" }, fields, false).submitted, false);
});
