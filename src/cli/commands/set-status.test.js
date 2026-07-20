"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { run } = require("./set-status");
const { workspacePaths, readJson, writeJson, ensureDir } = require("../../core/workspace");
const { renderTracker } = require("../../renderers/markdown-tracker");
const { renderHtmlTracker } = require("../../renderers/html-tracker");

/**
 * Test helper: create a temporary fixture workspace with sample roles
 */
function createFixtureWorkspace() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-set-status-"));
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

  // Create minimal tracked roles
  const roles = [
    {
      id: "role-001",
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "interested",
      urls: { job: "", apply: "" },
      notes: [],
      followUpQuestions: [],
      updatedAt: "2026-06-01",
    },
    {
      id: "role-002",
      company: "TechStart Inc",
      title: "Product Manager",
      status: "interested",
      urls: { job: "", apply: "" },
      notes: [],
      followUpQuestions: [],
      updatedAt: "2026-06-02",
    },
  ];
  writeJson(paths.rolesTracked, roles);

  // Create initial tracker
  const trackerContent = renderTracker(roles);
  writeJson(paths.tracker, trackerContent);

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

test("set-status: matches role by company and title", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const beforeRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    assert.strictEqual(beforeRoles[0].status, "interested", "Initial status should be interested");

    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "applied",
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    assert.strictEqual(afterRoles[0].status, "applied", "Status should be updated to applied");
    assert.strictEqual(afterRoles[0].company, "Acme Corp", "Company should remain unchanged");
    assert.strictEqual(afterRoles[0].title, "Senior Engineer", "Title should remain unchanged");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: sets application.appliedAt when status changes", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const testDate = "2026-06-15";
    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "applied",
      date: testDate,
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    const role = afterRoles[0];
    assert(role.application, "Role should have application object");
    assert.strictEqual(role.application.appliedAt, testDate, "appliedAt should match provided date");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: uses current date when date not provided", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    await run({
      workspace: tmpDir,
      company: "TechStart Inc",
      title: "Product Manager",
      status: "interview",
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    const role = afterRoles[1];
    assert(role.application, "Role should have application object");
    assert.strictEqual(role.application.appliedAt, today, "appliedAt should be today");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: rebuilds tracker after status change", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const paths = workspacePaths(tmpDir);
    const beforeTracker = fs.readFileSync(paths.tracker, "utf8");

    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "rejected",
      date: "2026-06-10",
    });

    const afterTracker = fs.readFileSync(paths.tracker, "utf8");
    assert.notStrictEqual(afterTracker, beforeTracker, "Tracker should be updated");

    // Verify new tracker matches the updated roles
    const roles = readJson(paths.rolesTracked);
    const expectedTracker = renderTracker(roles);
    assert.strictEqual(afterTracker, expectedTracker, "Tracker should match rebuilt content");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: rebuilds HTML tracker after status change", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const paths = workspacePaths(tmpDir);
    assert.strictEqual(fs.existsSync(paths.htmlTracker), false, "HTML tracker should not exist before any status change");

    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "rejected",
      date: "2026-06-10",
    });

    assert.strictEqual(fs.existsSync(paths.htmlTracker), true, "HTML tracker should be created");
    const htmlTracker = fs.readFileSync(paths.htmlTracker, "utf8");

    const roles = readJson(paths.rolesTracked);
    const profile = readJson(paths.profile, {});
    const expectedHtml = renderHtmlTracker(roles, {
      title: `${profile.candidate.preferredName} - Application Tracker`,
    });
    assert.strictEqual(htmlTracker, expectedHtml, "HTML tracker should match rebuilt content");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: supports all enum statuses", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const statuses = ["interested", "applied", "interview", "offer", "rejected", "withdrawn"];

    for (let i = 0; i < statuses.length; i++) {
      const workspace = createFixtureWorkspace();
      const status = statuses[i];

      await run({
        workspace,
        company: "Acme Corp",
        title: "Senior Engineer",
        status,
      });

      const roles = readJson(workspacePaths(workspace).rolesTracked);
      assert.strictEqual(roles[0].status, status, `Status should be set to ${status}`);
      cleanupWorkspace(workspace);
    }
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: throws error when role not found", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await assert.rejects(
      async () => {
        await run({
          workspace: tmpDir,
          company: "NonExistent Corp",
          title: "Fake Role",
          status: "applied",
        });
      },
      /not found/i,
      "Should throw error when role not found"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: throws error on invalid status", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await assert.rejects(
      async () => {
        await run({
          workspace: tmpDir,
          company: "Acme Corp",
          title: "Senior Engineer",
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

test("set-status: preserves other role fields", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const beforeRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    const originalRole = beforeRoles[0];

    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "offer",
      date: "2026-06-20",
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    const updatedRole = afterRoles[0];

    assert.strictEqual(updatedRole.id, originalRole.id, "ID should be preserved");
    assert.strictEqual(updatedRole.company, originalRole.company, "Company should be preserved");
    assert.strictEqual(updatedRole.title, originalRole.title, "Title should be preserved");
    assert.deepStrictEqual(updatedRole.urls, originalRole.urls, "URLs should be preserved");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});
