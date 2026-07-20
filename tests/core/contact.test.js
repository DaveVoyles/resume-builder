"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateContact, CONTACT_STATUSES, CONTACT_RELATIONSHIPS } = require("../../src/core/contact");

function validContact() {
  return {
    id: "contact-001",
    name: "Alice Smith",
    company: "Tech Corp",
    relationship: "former-colleague",
    contactMethod: "alice@example.com",
    linkedRoleIds: ["role-001"],
    status: "reached-out",
    notes: ["Initial email sent", "Awaiting response"],
  };
}

test("validateContact accepts a well-formed contact", () => {
  const { valid, errors } = validateContact(validContact());
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test("validateContact rejects a non-object contact", () => {
  const { valid, errors } = validateContact(null);
  assert.equal(valid, false);
  assert.ok(errors.length > 0);
});

test("validateContact requires id", () => {
  const contact = validContact();
  delete contact.id;
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("id")));
});

test("validateContact requires name", () => {
  const contact = validContact();
  contact.name = "";
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("name")));
});

test("validateContact requires relationship enum", () => {
  const contact = validContact();
  delete contact.relationship;
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("relationship")));
});

test("validateContact rejects invalid relationship enum", () => {
  const contact = validContact();
  contact.relationship = "invalid-relationship";
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("relationship")));
});

test("validateContact requires status enum", () => {
  const contact = validContact();
  delete contact.status;
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("status")));
});

test("validateContact rejects invalid status enum", () => {
  const contact = validContact();
  contact.status = "invalid-status";
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("status")));
});

test("validateContact accepts all valid contact statuses", () => {
  for (const status of CONTACT_STATUSES) {
    const contact = validContact();
    contact.status = status;
    const { valid, errors } = validateContact(contact);
    assert.equal(valid, true, `status "${status}" should be valid`);
    assert.deepEqual(errors, []);
  }
});

test("validateContact accepts all valid contact relationships", () => {
  for (const relationship of CONTACT_RELATIONSHIPS) {
    const contact = validContact();
    contact.relationship = relationship;
    const { valid, errors } = validateContact(contact);
    assert.equal(valid, true, `relationship "${relationship}" should be valid`);
    assert.deepEqual(errors, []);
  }
});

test("validateContact allows company to be optional", () => {
  const contact = validContact();
  delete contact.company;
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test("validateContact rejects empty string company when present", () => {
  const contact = validContact();
  contact.company = "";
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("company")));
});

test("validateContact allows contactMethod to be optional", () => {
  const contact = validContact();
  delete contact.contactMethod;
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test("validateContact rejects empty string contactMethod when present", () => {
  const contact = validContact();
  contact.contactMethod = "  ";
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("contactMethod")));
});

test("validateContact requires linkedRoleIds to be a non-empty array", () => {
  const contact = validContact();
  contact.linkedRoleIds = [];
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("linkedRoleIds")));
});

test("validateContact rejects non-array linkedRoleIds", () => {
  const contact = validContact();
  contact.linkedRoleIds = "role-001";
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("linkedRoleIds")));
});

test("validateContact rejects linkedRoleIds with empty strings", () => {
  const contact = validContact();
  contact.linkedRoleIds = ["role-001", ""];
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("linkedRoleIds")));
});

test("validateContact requires notes to be a non-empty array", () => {
  const contact = validContact();
  contact.notes = [];
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("notes")));
});

test("validateContact rejects non-array notes", () => {
  const contact = validContact();
  contact.notes = "some note";
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("notes")));
});

test("validateContact rejects notes with empty strings", () => {
  const contact = validContact();
  contact.notes = ["First note", ""];
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("notes")));
});

test("validateContact allows nextAction to be optional", () => {
  const contact = validContact();
  delete contact.nextAction;
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test("validateContact allows nextAction to be an object", () => {
  const contact = validContact();
  contact.nextAction = { type: "follow-up", dueDate: "2026-08-01" };
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test("validateContact rejects nextAction as non-object when present", () => {
  const contact = validContact();
  contact.nextAction = "follow up tomorrow";
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("nextAction")));
});

test("validateContact supports multiple linkedRoleIds", () => {
  const contact = validContact();
  contact.linkedRoleIds = ["role-001", "role-002", "role-003"];
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test("validateContact supports multiple notes", () => {
  const contact = validContact();
  contact.notes = [
    "Initial email sent",
    "Awaiting response",
    "Follow-up scheduled",
    "Met at conference",
  ];
  const { valid, errors } = validateContact(contact);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});
