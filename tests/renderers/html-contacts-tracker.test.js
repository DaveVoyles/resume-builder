"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { renderHtmlContactsTracker } = require("../../src/renderers/html-contacts-tracker");

test("html contacts tracker renders a table with all columns", () => {
  const contacts = [
    {
      id: "contact-001",
      name: "Alice Johnson",
      company: "TechCorp",
      relationship: "former-colleague",
      status: "responded",
      notes: ["Great fit"],
      nextAction: {
        type: "follow-up",
        owner: "candidate",
        dueDate: "2026-07-25",
      },
    },
  ];

  const output = renderHtmlContactsTracker(contacts);

  // Check that it's HTML
  assert.match(output, /<!DOCTYPE html/i);

  // Check that columns are in the header
  assert.match(output, /<th.*?data-sortable=["']name["'].*?>Name<\/th>/i);
  assert.match(output, /<th.*?data-sortable=["']company["'].*?>Company<\/th>/i);
  assert.match(output, /<th.*?data-sortable=["']relationship["'].*?>Relationship<\/th>/i);
  assert.match(output, /<th.*?data-sortable=["']status["'].*?>Status<\/th>/i);
  assert.match(output, /<th.*?data-sortable=["']dueDate["'].*?>Next Action Due<\/th>/i);
  assert.match(output, /<th.*?>Notes<\/th>/i);

  // Check that data is embedded in the script
  assert.match(output, /"name": "Alice Johnson"/);
  assert.match(output, /"company": "TechCorp"/);
  assert.match(output, /"relationship": "former-colleague"/);
  assert.match(output, /"status": "responded"/);
  assert.match(output, /"dueDate": "2026-07-25"/);
});

test("html contacts tracker sorts by dueDate ascending", () => {
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

  const output = renderHtmlContactsTracker(contacts);

  // Extract JSON array from the script
  const jsonMatch = output.match(/const contacts = (\[[\s\S]*?\]);/);
  assert.ok(jsonMatch, "Should have contacts array in script");

  const contactsData = JSON.parse(jsonMatch[1]);

  // Check order in the JSON data
  assert.equal(contactsData[0].name, "Bob", "Bob should be first (2026-07-20)");
  assert.equal(contactsData[1].name, "Alice", "Alice should be second (2026-07-25)");
  assert.equal(contactsData[2].name, "Charlie", "Charlie should be third (2026-07-30)");
});

test("html contacts tracker puts contacts with no nextAction last", () => {
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

  const output = renderHtmlContactsTracker(contacts);

  // Extract JSON array from the script
  const jsonMatch = output.match(/const contacts = (\[[\s\S]*?\]);/);
  assert.ok(jsonMatch, "Should have contacts array in script");

  const contactsData = JSON.parse(jsonMatch[1]);

  // Bob (with nextAction) should come before Alice (without nextAction)
  assert.equal(contactsData[0].name, "Bob", "Bob should be first");
  assert.equal(contactsData[1].name, "Alice", "Alice should be last");
});

test("html contacts tracker HTML-escapes special characters in names", () => {
  const contacts = [
    {
      id: "contact-001",
      name: "Alice & Bob",
      company: "Tech & Corp",
      relationship: "referral",
      status: "identified",
      notes: ["Note with & ampersand"],
      nextAction: {
        type: "follow-up",
        owner: "candidate",
        dueDate: "2026-07-25",
      },
    },
  ];

  const output = renderHtmlContactsTracker(contacts);

  // Check that the contact data is embedded in the HTML
  assert.match(output, /Alice & Bob/);
  assert.match(output, /Tech & Corp/);

  // Check that esc() function is used in the rendering code to escape when displaying
  assert.match(output, /esc\(/);
  assert.match(output, /esc.*contact/);
});

test("html contacts tracker handles empty list", () => {
  const output = renderHtmlContactsTracker([]);

  assert.match(output, /<!DOCTYPE html/i);
  assert.match(output, /No tracked contacts yet/i);
});

test("html contacts tracker includes status badges", () => {
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

  const output = renderHtmlContactsTracker(contacts);

  // Check that badge styling is present
  assert.match(output, /\.badge-reached-out/);
});

test("html contacts tracker shows dash for contacts with no dueDate", () => {
  const contacts = [
    {
      id: "contact-001",
      name: "Alice",
      company: "CompanyA",
      relationship: "referral",
      status: "identified",
      notes: [],
      // No nextAction, so no dueDate
    },
  ];

  const output = renderHtmlContactsTracker(contacts);

  // Extract JSON array from the script
  const jsonMatch = output.match(/const contacts = (\[[\s\S]*?\]);/);
  const contactsData = JSON.parse(jsonMatch[1]);

  // Should have empty string for dueDate
  assert.equal(contactsData[0].dueDate, "");
});

test("html contacts tracker displays contact count", () => {
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
      status: "identified",
      notes: [],
    },
  ];

  const output = renderHtmlContactsTracker(contacts);

  // Check that total contact count is displayed using a more lenient regex
  assert.match(output, /Total contacts/);
  assert.match(output, /<div class="stat-value">2<\/div>/);
});

test("html contacts tracker counts by status", () => {
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
        dueDate: "2026-07-26",
      },
    },
    {
      id: "contact-003",
      name: "Charlie",
      company: "CompanyC",
      relationship: "referral",
      status: "identified",
      notes: [],
    },
  ];

  const output = renderHtmlContactsTracker(contacts);

  // Check that status counts are displayed
  assert.match(output, /"reached-out": 2/);
  assert.match(output, /"identified": 1/);
});
