"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { run } = require("./add-contact");
const { readJson, workspacePaths, writeJson, ensureDir } = require("../../core/workspace");

/**
 * Test helper: create a temporary fixture workspace
 */
function createFixtureWorkspace() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "add-contact-workspace-"));
  const paths = workspacePaths(tmpDir);

  ensureDir(paths.root);

  // Initialize empty profile (required by workspace setup)
  writeJson(paths.profile, {
    schemaVersion: "1.0",
    candidate: {
      id: "test-candidate",
      preferredName: "Test User",
    },
  });

  // Initialize empty roles.tracked.json for linkedRoleIds tests
  writeJson(paths.rolesTracked, [
    {
      id: "role_senior-engineer_abc1234567",
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "tracked",
      urls: { job: "", apply: "" },
      notes: [],
      followUpQuestions: [],
      updatedAt: "2026-06-01",
    },
  ]);

  return { tmpDir, paths };
}

/**
 * Test helper: cleanup fixture workspace
 */
function cleanupWorkspace(tmpDir) {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
}

test("add-contact: creates a validated contact in contacts.json", () => {
  const { tmpDir, paths } = createFixtureWorkspace();
  try {
    run({
      workspace: tmpDir,
      name: "Alice Johnson",
      company: "Tech Corp",
      relationship: "recruiter",
      linkedRole: [],
      notes: "Met at conference",
    });

    const contacts = readJson(paths.contacts, []);
    assert.strictEqual(contacts.length, 1, "should have one contact");

    const contact = contacts[0];
    assert.strictEqual(contact.name, "Alice Johnson");
    assert.strictEqual(contact.company, "Tech Corp");
    assert.strictEqual(contact.relationship, "recruiter");
    assert.strictEqual(contact.status, "identified", "status should be first enum value (identified)");
    assert.deepStrictEqual(contact.linkedRoleIds, [], "linkedRoleIds should be empty array");
    assert.deepStrictEqual(contact.notes, ["Met at conference"], "notes should be array with one entry");
    assert.ok(contact.id, "contact should have an id");
    assert.ok(contact.id.startsWith("contact_"), "contact id should use contact prefix");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("add-contact: supports empty notes (defaults to empty array)", () => {
  const { tmpDir, paths } = createFixtureWorkspace();
  try {
    run({
      workspace: tmpDir,
      name: "Bob Smith",
      relationship: "former-colleague",
    });

    const contacts = readJson(paths.contacts, []);
    const contact = contacts[0];
    assert.deepStrictEqual(contact.notes, [], "notes should be empty array when not provided");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("add-contact: deduplicates on re-run with same name and company", () => {
  const { tmpDir, paths } = createFixtureWorkspace();
  try {
    // First run
    run({
      workspace: tmpDir,
      name: "Charlie Brown",
      company: "Widget Inc",
      relationship: "informational-interview",
    });

    // Second run with same name and company
    run({
      workspace: tmpDir,
      name: "Charlie Brown",
      company: "Widget Inc",
      relationship: "informational-interview",
      notes: "Different notes this time",
    });

    const contacts = readJson(paths.contacts, []);
    assert.strictEqual(contacts.length, 1, "should still have only one contact (dedup prevented duplicate)");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("add-contact: supports repeatable --linked-role flags", () => {
  const { tmpDir, paths } = createFixtureWorkspace();
  try {
    run({
      workspace: tmpDir,
      name: "Diana Chen",
      company: "StartUp Labs",
      relationship: "referral",
      linkedRole: ["role_senior-engineer_abc1234567", "role_product-manager_xyz7890123"],
    });

    const contacts = readJson(paths.contacts, []);
    const contact = contacts[0];
    assert.deepStrictEqual(
      contact.linkedRoleIds,
      ["role_senior-engineer_abc1234567", "role_product-manager_xyz7890123"],
      "linkedRoleIds should contain both role IDs",
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("add-contact: validates contact and throws error on invalid data", () => {
  const { tmpDir } = createFixtureWorkspace();
  try {
    assert.throws(
      () => {
        run({
          workspace: tmpDir,
          name: "Eve Wilson",
          // Missing required relationship field
          company: "Global Corp",
        });
      },
      /Invalid contact/,
      "should throw error when relationship is missing",
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("add-contact: makes company field optional", () => {
  const { tmpDir, paths } = createFixtureWorkspace();
  try {
    run({
      workspace: tmpDir,
      name: "Frank Miller",
      relationship: "other",
      notes: "Personal contact",
    });

    const contacts = readJson(paths.contacts, []);
    const contact = contacts[0];
    assert.strictEqual(contact.name, "Frank Miller");
    assert.strictEqual(contact.company, undefined, "company should be undefined when not provided");
    assert.ok(contact.id, "should still generate a valid id without company");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("add-contact: creates contacts.json if it does not exist", () => {
  const { tmpDir, paths } = createFixtureWorkspace();
  try {
    // Verify contacts.json doesn't exist yet
    assert.strictEqual(fs.existsSync(paths.contacts), false, "contacts.json should not exist initially");

    run({
      workspace: tmpDir,
      name: "Grace Kelly",
      relationship: "recruiter",
    });

    // Verify contacts.json was created
    assert.strictEqual(fs.existsSync(paths.contacts), true, "contacts.json should be created");

    const contacts = readJson(paths.contacts, []);
    assert.strictEqual(contacts.length, 1, "should have one contact");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("add-contact: appends to existing contacts.json", () => {
  const { tmpDir, paths } = createFixtureWorkspace();
  try {
    // Create initial contacts
    const initialContacts = [
      {
        id: "contact_henry-lee_initial001",
        name: "Henry Lee",
        company: "OldCorp",
        relationship: "former-colleague",
        linkedRoleIds: [],
        status: "identified",
        notes: [],
      },
    ];
    writeJson(paths.contacts, initialContacts);

    // Add new contact
    run({
      workspace: tmpDir,
      name: "Iris Anderson",
      company: "NewCorp",
      relationship: "informational-interview",
    });

    const contacts = readJson(paths.contacts, []);
    assert.strictEqual(contacts.length, 2, "should have two contacts total");
    assert.strictEqual(contacts[0].name, "Henry Lee", "first contact should be unchanged");
    assert.strictEqual(contacts[1].name, "Iris Anderson", "second contact should be new one");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});
