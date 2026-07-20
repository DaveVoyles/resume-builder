"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { run } = require("./set-contact-status");
const { workspacePaths, readJson, writeJson, ensureDir } = require("../../core/workspace");

/**
 * Test helper: create a temporary fixture workspace with sample contacts
 */
function createFixtureWorkspace(extraContacts = []) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-set-contact-status-"));
  const paths = workspacePaths(tmpDir);

  ensureDir(paths.outputs);

  // Create minimal profile
  writeJson(paths.profile, {
    schemaVersion: "1.0",
    candidate: {
      id: "test-candidate",
      preferredName: "Test User",
    },
    skills: [],
    experience: [],
  });

  // Create minimal contacts
  const contacts = [
    {
      id: "contact-001",
      name: "Alice Johnson",
      company: "TechCorp",
      relationship: "referral",
      status: "identified",
      linkedRoleIds: [],
      notes: [],
    },
    {
      id: "contact-002",
      name: "Bob Smith",
      company: "StartupCo",
      relationship: "former-colleague",
      status: "identified",
      linkedRoleIds: [],
      notes: [],
    },
    ...extraContacts,
  ];
  writeJson(paths.contacts, contacts);

  return tmpDir;
}

/**
 * Test helper: cleanup fixture workspace
 */
function cleanupWorkspace(tmpDir) {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
}

test("set-contact-status: matches contact by id", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "reached-out",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    assert.strictEqual(afterContacts[0].status, "reached-out", "Status should be updated to reached-out");
    assert.strictEqual(afterContacts[0].name, "Alice Johnson", "Name should remain unchanged");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: throws error when contact not found", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await assert.rejects(
      async () => {
        await run({
          workspace: tmpDir,
          id: "nonexistent-contact",
          status: "reached-out",
        });
      },
      /not found/i,
      "Should throw error when contact not found"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: throws error on invalid status", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await assert.rejects(
      async () => {
        await run({
          workspace: tmpDir,
          id: "contact-001",
          status: "invalid-status",
        });
      },
      /invalid.*status|not.*valid/i,
      "Should throw error on invalid status"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: throws error on malformed --date", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await assert.rejects(
      async () => {
        await run({
          workspace: tmpDir,
          id: "contact-001",
          status: "reached-out",
          date: "not-a-date",
        });
      },
      /invalid.*date/i,
      "Should throw error on malformed --date"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: status='reached-out' sets nextAction to follow-up with 7-day dueDate and appends note", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "reached-out",
      date: "2026-06-15",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    const contact = afterContacts[0];

    assert.strictEqual(contact.nextAction.type, "follow-up", "nextAction.type should be follow-up");
    assert.strictEqual(contact.nextAction.owner, "candidate", "nextAction.owner should be candidate");
    assert.strictEqual(contact.nextAction.dueDate, "2026-06-22", "nextAction.dueDate should be 7 days after 2026-06-15");
    assert.ok(
      contact.notes.includes("check in if no response"),
      "Note 'check in if no response' should be appended to contact.notes"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: initializes a missing notes array before pushing the rule's note", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    // Simulate a legacy contact record with no notes field at all — not just
    // an empty array — to prove the `!Array.isArray(contact.notes)` guard
    // actually initializes it rather than being dead defensive code.
    const paths = workspacePaths(tmpDir);
    const contacts = readJson(paths.contacts);
    delete contacts[0].notes;
    writeJson(paths.contacts, contacts);

    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "reached-out",
      date: "2026-06-15",
    });

    const afterContacts = readJson(paths.contacts);
    const contact = afterContacts[0];
    assert.deepStrictEqual(contact.notes, ["check in if no response"], "notes should be initialized to an array containing the rule's note");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: status='responded' sets nextAction to follow-up with 3-day dueDate and appends note", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "responded",
      date: "2026-06-15",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    const contact = afterContacts[0];

    assert.strictEqual(contact.nextAction.type, "follow-up", "nextAction.type should be follow-up");
    assert.strictEqual(contact.nextAction.owner, "candidate", "nextAction.owner should be candidate");
    assert.strictEqual(contact.nextAction.dueDate, "2026-06-18", "nextAction.dueDate should be 3 days after 2026-06-15");
    assert.ok(
      contact.notes.includes("schedule a call or meeting"),
      "Note 'schedule a call or meeting' should be appended to contact.notes"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: status='meeting-scheduled' sets nextAction to follow-up with 1-day dueDate and appends note", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "meeting-scheduled",
      date: "2026-06-15",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    const contact = afterContacts[0];

    assert.strictEqual(contact.nextAction.type, "follow-up", "nextAction.type should be follow-up");
    assert.strictEqual(contact.nextAction.owner, "candidate", "nextAction.owner should be candidate");
    assert.strictEqual(contact.nextAction.dueDate, "2026-06-16", "nextAction.dueDate should be 1 day after 2026-06-15");
    assert.ok(
      contact.notes.includes("send thank-you"),
      "Note 'send thank-you' should be appended to contact.notes"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: status='met' sets nextAction to follow-up with 2-day dueDate and appends note", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "met",
      date: "2026-06-15",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    const contact = afterContacts[0];

    assert.strictEqual(contact.nextAction.type, "follow-up", "nextAction.type should be follow-up");
    assert.strictEqual(contact.nextAction.owner, "candidate", "nextAction.owner should be candidate");
    assert.strictEqual(contact.nextAction.dueDate, "2026-06-17", "nextAction.dueDate should be 2 days after 2026-06-15");
    assert.ok(
      contact.notes.includes("send thank-you and follow up on next steps"),
      "Note 'send thank-you and follow up on next steps' should be appended to contact.notes"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: status='referred' sets nextAction to follow-up with 3-day dueDate and appends note", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "referred",
      date: "2026-06-15",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    const contact = afterContacts[0];

    assert.strictEqual(contact.nextAction.type, "follow-up", "nextAction.type should be follow-up");
    assert.strictEqual(contact.nextAction.owner, "candidate", "nextAction.owner should be candidate");
    assert.strictEqual(contact.nextAction.dueDate, "2026-06-18", "nextAction.dueDate should be 3 days after 2026-06-15");
    assert.ok(
      contact.notes.includes("check in on referral outcome"),
      "Note 'check in on referral outcome' should be appended to contact.notes"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: status='no-response' sets nextAction to close type with no dueDate and no note appended", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "no-response",
      date: "2026-06-15",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    const contact = afterContacts[0];

    assert.deepStrictEqual(
      contact.nextAction,
      { type: "close" },
      "nextAction should be set to { type: 'close' } with no dueDate"
    );
    assert.strictEqual(
      contact.notes.length,
      0,
      "No note should be appended for no-response status"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: status='dormant' sets nextAction to close type with no dueDate and no note appended", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "dormant",
      date: "2026-06-15",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    const contact = afterContacts[0];

    assert.deepStrictEqual(
      contact.nextAction,
      { type: "close" },
      "nextAction should be set to { type: 'close' } with no dueDate"
    );
    assert.strictEqual(
      contact.notes.length,
      0,
      "No note should be appended for dormant status"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: status='identified' leaves nextAction untouched entirely", async () => {
  const tmpDir = createFixtureWorkspace([
    {
      id: "contact-with-action",
      name: "Carol White",
      company: "OldCorp",
      relationship: "recruiter",
      status: "reached-out",
      linkedRoleIds: [],
      notes: [],
      nextAction: {
        type: "research",
        owner: "agent",
        dueDate: "2020-01-01",
      },
    },
  ]);
  try {
    await run({
      workspace: tmpDir,
      id: "contact-with-action",
      status: "identified",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    const contact = afterContacts.find((c) => c.id === "contact-with-action");

    assert.deepStrictEqual(
      contact.nextAction,
      { type: "research", owner: "agent", dueDate: "2020-01-01" },
      "nextAction should remain completely untouched when transitioning to identified"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: a repeat call to the same status does not duplicate the follow-up note", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "reached-out",
      date: "2026-06-01",
    });
    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "reached-out",
      date: "2026-06-01",
    });

    const contacts = readJson(workspacePaths(tmpDir).contacts);
    const contact = contacts[0];
    const occurrences = contact.notes.filter((note) => note === "check in if no response").length;
    assert.strictEqual(occurrences, 1, "repeat call to the same status must not push a duplicate note");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: preserves other contact fields", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const beforeContacts = readJson(workspacePaths(tmpDir).contacts);
    const originalContact = beforeContacts[0];

    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "met",
      date: "2026-06-20",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    const updatedContact = afterContacts[0];

    assert.strictEqual(updatedContact.id, originalContact.id, "ID should be preserved");
    assert.strictEqual(updatedContact.name, originalContact.name, "Name should be preserved");
    assert.strictEqual(updatedContact.company, originalContact.company, "Company should be preserved");
    assert.strictEqual(updatedContact.relationship, originalContact.relationship, "Relationship should be preserved");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-contact-status: uses current date when date not provided", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    await run({
      workspace: tmpDir,
      id: "contact-001",
      status: "reached-out",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    const contact = afterContacts[0];
    assert.strictEqual(contact.nextAction.dueDate, addDaysManual(today, 7), "dueDate should be 7 days from today");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

// Helper function for date arithmetic in tests
function addDaysManual(dateStr, days) {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split("T")[0];
}

test("set-contact-status: status transition overwrites pre-existing custom nextAction (except identified)", async () => {
  const tmpDir = createFixtureWorkspace([
    {
      id: "contact-custom-action",
      name: "Dave Brown",
      company: "CustomCorp",
      relationship: "informational-interview",
      status: "reached-out",
      linkedRoleIds: [],
      notes: [],
      nextAction: {
        type: "research",
        owner: "agent",
        dueDate: "2020-01-01",
      },
    },
  ]);
  try {
    await run({
      workspace: tmpDir,
      id: "contact-custom-action",
      status: "responded",
      date: "2026-06-15",
    });

    const afterContacts = readJson(workspacePaths(tmpDir).contacts);
    const contact = afterContacts.find((c) => c.id === "contact-custom-action");

    assert.strictEqual(
      contact.nextAction.type,
      "follow-up",
      "Pre-existing custom nextAction.type should be overwritten"
    );
    assert.strictEqual(
      contact.nextAction.dueDate,
      "2026-06-18",
      "Pre-existing custom nextAction.dueDate should be overwritten"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});
