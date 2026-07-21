"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { run } = require("../../../src/cli/commands/build-contacts-tracker");

function createTempWorkspace() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-workspace-"));

  // Create directory structure
  fs.mkdirSync(path.join(tmpDir, "outputs"), { recursive: true });

  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

test("build-contacts-tracker renders markdown contacts tracker by default", () => {
  const workspace = createTempWorkspace();

  try {
    // Create a simple contacts.json
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

    fs.writeFileSync(
      path.join(workspace, "contacts.json"),
      JSON.stringify(contacts, null, 2)
    );

    run({ workspace });

    const outputPath = path.join(workspace, "outputs", "contacts.md");
    assert.ok(fs.existsSync(outputPath), "contacts.md should be created");

    const content = fs.readFileSync(outputPath, "utf8");
    assert.match(content, /# Contact Tracker/);
    assert.match(content, /Alice/);
  } finally {
    cleanup(workspace);
  }
});

test("build-contacts-tracker renders markdown with --format md", () => {
  const workspace = createTempWorkspace();

  try {
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

    fs.writeFileSync(
      path.join(workspace, "contacts.json"),
      JSON.stringify(contacts, null, 2)
    );

    run({ workspace, format: "md" });

    const outputPath = path.join(workspace, "outputs", "contacts.md");
    assert.ok(fs.existsSync(outputPath), "contacts.md should be created");

    const content = fs.readFileSync(outputPath, "utf8");
    assert.match(content, /# Contact Tracker/);
    assert.match(content, /Alice/);
  } finally {
    cleanup(workspace);
  }
});

test("build-contacts-tracker renders HTML with --format html", () => {
  const workspace = createTempWorkspace();

  try {
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

    fs.writeFileSync(
      path.join(workspace, "contacts.json"),
      JSON.stringify(contacts, null, 2)
    );

    run({ workspace, format: "html" });

    const outputPath = path.join(workspace, "outputs", "contacts.html");
    assert.ok(fs.existsSync(outputPath), "contacts.html should be created");

    const content = fs.readFileSync(outputPath, "utf8");
    assert.match(content, /<!DOCTYPE html/i);
    assert.match(content, /Alice/);
  } finally {
    cleanup(workspace);
  }
});

test("build-contacts-tracker accepts --output option", () => {
  const workspace = createTempWorkspace();

  try {
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

    fs.writeFileSync(
      path.join(workspace, "contacts.json"),
      JSON.stringify(contacts, null, 2)
    );

    const customOutput = path.join(workspace, "custom-contacts.md");
    run({ workspace, output: customOutput });

    assert.ok(
      fs.existsSync(customOutput),
      "custom output path should be created"
    );

    const content = fs.readFileSync(customOutput, "utf8");
    assert.match(content, /# Contact Tracker/);
  } finally {
    cleanup(workspace);
  }
});

test("build-contacts-tracker handles empty contacts list", () => {
  const workspace = createTempWorkspace();

  try {
    fs.writeFileSync(
      path.join(workspace, "contacts.json"),
      JSON.stringify([], null, 2)
    );

    run({ workspace });

    const outputPath = path.join(workspace, "outputs", "contacts.md");
    assert.ok(fs.existsSync(outputPath), "contacts.md should be created");

    const content = fs.readFileSync(outputPath, "utf8");
    assert.match(content, /# Contact Tracker/);
    assert.match(content, /No tracked contacts yet/);
  } finally {
    cleanup(workspace);
  }
});

test("build-contacts-tracker logs output file path", () => {
  const workspace = createTempWorkspace();

  try {
    fs.writeFileSync(
      path.join(workspace, "contacts.json"),
      JSON.stringify([], null, 2)
    );

    // Capture console output
    const originalLog = console.log;
    let capturedOutput = "";
    console.log = (msg) => {
      capturedOutput += msg + "\n";
    };

    try {
      run({ workspace });
    } finally {
      console.log = originalLog;
    }

    assert.match(capturedOutput, /contacts\.md/);
  } finally {
    cleanup(workspace);
  }
});

test("build-contacts-tracker defaults to markdown format", () => {
  const workspace = createTempWorkspace();

  try {
    fs.writeFileSync(
      path.join(workspace, "contacts.json"),
      JSON.stringify([], null, 2)
    );

    run({ workspace });

    // Should create .md file, not .html
    const mdPath = path.join(workspace, "outputs", "contacts.md");
    const htmlPath = path.join(workspace, "outputs", "contacts.html");

    assert.ok(fs.existsSync(mdPath), ".md file should be created");
    assert.ok(!fs.existsSync(htmlPath), ".html file should not be created");
  } finally {
    cleanup(workspace);
  }
});
