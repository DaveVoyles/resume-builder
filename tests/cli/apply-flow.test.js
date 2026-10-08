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
});

test("apply refuses to run without --dry-run and never records an applied status", () => {
  const dir = tmp();
  const trackedPath = path.join(dir, "roles.tracked.json");
  const role = { id: "role-1", company: "Fabrikam", title: "Analyst", status: "tracked", application: { status: "interested" } };
  fs.writeFileSync(trackedPath, `${JSON.stringify([role], null, 2)}\n`);
  const before = fs.readFileSync(trackedPath, "utf8");
  quiet(() => approveApply.run({ workspace: dir, company: "Fabrikam", title: "Analyst" }));

  const live = { workspace: dir, company: "Fabrikam", title: "Analyst" };
  assert.throws(() => apply.run(live), /only supports --dry-run/);
  assert.throws(() => apply.run({ ...live, dryRun: false }), /only supports --dry-run/);
  assert.throws(() => apply.run({ ...live, dryRun: "true" }), /only supports --dry-run/);

  quiet(() => apply.run({ ...live, dryRun: true }));
  assert.equal(fs.readFileSync(trackedPath, "utf8"), before, "apply must not touch roles.tracked.json");
  assert.doesNotMatch(fs.readFileSync(trackedPath, "utf8"), /"applied"/);
  assert.equal(fs.existsSync(path.join(dir, "outputs")), false, "apply writes no outputs");
});

test("apply without approval fails before anything else, even with --dry-run", () => {
  const dir = tmp();
  assert.throws(() => apply.run({ workspace: dir, company: "Nobody", title: "Nothing", dryRun: true }), /No approval/);
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
