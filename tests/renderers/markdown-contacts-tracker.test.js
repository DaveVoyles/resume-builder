"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderContactsTracker } = require("../../src/renderers/markdown-contacts-tracker");

test("markdown contacts tracker renders table with all columns", () => {
  const contacts = [
    {
      id: "contact-001",
      name: "Alice Johnson",
      company: "TechCorp",
      relationship: "former-colleague",
      status: "responded",
      notes: ["Great fit for PM roles"],
      nextAction: {
        type: "follow-up",
        owner: "candidate",
        dueDate: "2026-07-25",
      },
    },
  ];

  const output = renderContactsTracker(contacts);

  // Check that the header includes all columns
  assert.match(output, /Name.*Company.*Relationship.*Status.*Next Action Due.*Notes/);

  // Check separator row
  assert.match(output, /\| --- \| --- \| --- \| --- \| --- \| --- \|/);

  // Check that data row contains the contact info
  assert.match(output, /Alice Johnson/);
  assert.match(output, /TechCorp/);
  assert.match(output, /former-colleague/);
  assert.match(output, /responded/);
});

test("markdown contacts tracker sorts by nextAction.dueDate ascending", () => {
  const contacts = [
    {
      id: "contact-001",
      name: "Alice",
      company: "CompanyA",
      relationship: "referral",
      status: "reached-out",
      notes: [],
      nextAction: {
        type: "follow-up",
        owner: "candidate",
        dueDate: "2026-07-25",
      },
    },
    {
      id: "contact-002",
      name: "Bob",
      company: "CompanyB",
      relationship: "referral",
      status: "reached-out",
      notes: [],
      nextAction: {
        type: "follow-up",
        owner: "candidate",
        dueDate: "2026-07-20",
      },
    },
    {
      id: "contact-003",
      name: "Charlie",
      company: "CompanyC",
      relationship: "referral",
      status: "reached-out",
      notes: [],
      nextAction: {
        type: "follow-up",
        owner: "candidate",
        dueDate: "2026-07-30",
      },
    },
  ];

  const output = renderContactsTracker(contacts);

  // Extract the order of names by finding their positions in the output
  const bobPos = output.indexOf("Bob");
  const alicePos = output.indexOf("Alice");
  const charliePos = output.indexOf("Charlie");

  // Bob (2026-07-20) should come before Alice (2026-07-25) should come before Charlie (2026-07-30)
  assert.ok(bobPos < alicePos, "Bob should come before Alice");
  assert.ok(alicePos < charliePos, "Alice should come before Charlie");
});

test("markdown contacts tracker puts contacts with no nextAction last", () => {
  const contacts = [
    {
      id: "contact-001",
      name: "Alice",
      company: "CompanyA",
      relationship: "referral",
      status: "identified",
      notes: [],
      // No nextAction
    },
    {
      id: "contact-002",
      name: "Bob",
      company: "CompanyB",
      relationship: "referral",
      status: "reached-out",
      notes: [],
      nextAction: {
        type: "follow-up",
        owner: "candidate",
        dueDate: "2026-07-25",
      },
    },
  ];

  const output = renderContactsTracker(contacts);

  const bobPos = output.indexOf("Bob");
  const alicePos = output.indexOf("Alice");

  // Bob (with nextAction) should come before Alice (without nextAction)
  assert.ok(bobPos < alicePos, "Bob should come before Alice");
});

test("markdown contacts tracker handles empty list", () => {
  const output = renderContactsTracker([]);

  assert.match(output, /# Contact Tracker/);
  assert.match(output, /No tracked contacts yet/);
});

test("markdown contacts tracker escapes pipes in values", () => {
  const contacts = [
    {
      id: "contact-001",
      name: "Alice | Bob",
      company: "Tech | Corp",
      relationship: "referral",
      status: "reached-out",
      notes: ["Note with | pipe"],
      nextAction: {
        type: "follow-up",
        owner: "candidate",
        dueDate: "2026-07-25",
      },
    },
  ];

  const output = renderContactsTracker(contacts);

  // Pipes should be escaped with backslash
  assert.match(output, /Alice \\\| Bob/);
  assert.match(output, /Tech \\\| Corp/);
  assert.match(output, /Note with \\\| pipe/);
});

test("markdown contacts tracker displays dueDate in Next Action Due column", () => {
  const contacts = [
    {
      id: "contact-001",
      name: "Alice",
      company: "CompanyA",
      relationship: "referral",
      status: "reached-out",
      notes: [],
      nextAction: {
        type: "follow-up",
        owner: "candidate",
        dueDate: "2026-07-25",
      },
    },
  ];

  const output = renderContactsTracker(contacts);

  // Check that the dueDate is displayed
  assert.match(output, /2026-07-25/);
});

test("markdown contacts tracker shows dash for contacts with no nextAction", () => {
  const contacts = [
    {
      id: "contact-001",
      name: "Alice",
      company: "CompanyA",
      relationship: "referral",
      status: "identified",
      notes: [],
      // No nextAction
    },
  ];

  const output = renderContactsTracker(contacts);

  // Should have a dash in the Next Action Due column
  assert.match(output, /Alice \| CompanyA \| referral \| identified \| — \| —/);
});

test("markdown contacts tracker handles multiple notes as concatenated lines", () => {
  const contacts = [
    {
      id: "contact-001",
      name: "Alice",
      company: "CompanyA",
      relationship: "referral",
      status: "identified",
      notes: ["First note", "Second note"],
      // No nextAction
    },
  ];

  const output = renderContactsTracker(contacts);

  // Both notes should be in the output
  assert.match(output, /First note/);
  assert.match(output, /Second note/);
});
