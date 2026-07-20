"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { run } = require("./set-status");
const { workspacePaths, readJson, writeJson, ensureDir } = require("../../core/workspace");
const { renderTracker } = require("../../renderers/markdown-tracker");

/**
 * Test helper: create a temporary fixture workspace with sample roles
 */
function createFixtureWorkspace(extraRoles = []) {
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
      status: "tracked",
      urls: { job: "", apply: "" },
      notes: [],
      followUpQuestions: [],
      updatedAt: "2026-06-01",
    },
    {
      id: "role-002",
      company: "TechStart Inc",
      title: "Product Manager",
      status: "tracked",
      urls: { job: "", apply: "" },
      notes: [],
      followUpQuestions: [],
      updatedAt: "2026-06-02",
    },
    ...extraRoles,
  ];
  writeJson(paths.rolesTracked, roles);

  // Create initial tracker (real markdown text, not JSON-stringified)
  fs.writeFileSync(paths.tracker, renderTracker(roles));

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
    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "applied",
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    assert.strictEqual(afterRoles[0].application.status, "applied", "Status should be updated to applied");
    assert.strictEqual(afterRoles[0].status, "tracked", "List-membership status field should be untouched");
    assert.strictEqual(afterRoles[0].company, "Acme Corp", "Company should remain unchanged");
    assert.strictEqual(afterRoles[0].title, "Senior Engineer", "Title should remain unchanged");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: matches company and title case-insensitively", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      company: "acme corp",
      title: "SENIOR ENGINEER",
      status: "applied",
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    assert.strictEqual(afterRoles[0].application.status, "applied");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: matches a role that uses `role` instead of `title` (documented schema alias)", async () => {
  const tmpDir = createFixtureWorkspace([
    {
      id: "role-003",
      company: "AliasCo",
      role: "Staff Engineer",
      status: "tracked",
      urls: { job: "", apply: "" },
      notes: [],
      followUpQuestions: [],
      updatedAt: "2026-06-03",
    },
  ]);
  try {
    await run({
      workspace: tmpDir,
      company: "AliasCo",
      title: "Staff Engineer",
      status: "interview",
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    const role = afterRoles.find((candidate) => candidate.id === "role-003");
    assert.strictEqual(role.application.status, "interview");
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

test("set-status: uses current date when date not provided and status is applied", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    await run({
      workspace: tmpDir,
      company: "TechStart Inc",
      title: "Product Manager",
      status: "applied",
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    const role = afterRoles[1];
    assert(role.application, "Role should have application object");
    assert.strictEqual(role.application.appliedAt, today, "appliedAt should be today");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: leaves appliedAt unset when a role skips straight to a non-applied status", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    // A referral-driven interview with no formal "applied" step ever
    // recorded — appliedAt has no real value to report and must stay unset,
    // not get stamped with today's date just because it was previously empty.
    await run({
      workspace: tmpDir,
      company: "TechStart Inc",
      title: "Product Manager",
      status: "interview",
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    const role = afterRoles[1];
    assert.strictEqual(role.application.status, "interview");
    assert.strictEqual(role.application.appliedAt, undefined, "appliedAt should stay unset without an actual apply event");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: preserves the original appliedAt across later status transitions", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "applied",
      date: "2026-06-15",
    });

    // Move to interview later, with no --date — must NOT overwrite the
    // original applied date, only the status.
    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "interview",
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    const role = afterRoles[0];
    assert.strictEqual(role.application.status, "interview");
    assert.strictEqual(role.application.appliedAt, "2026-06-15", "Original applied date must survive later transitions");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: a repeat call to 'applied' (no --date) must not reset an already-set appliedAt", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "applied",
      date: "2026-06-15",
    });

    // Idempotent retry / accidental re-run of the same "applied" call, no
    // --date — must not silently reset appliedAt to today.
    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "applied",
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    assert.strictEqual(afterRoles[0].application.appliedAt, "2026-06-15", "Repeat 'applied' call must not reset the original date");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: an explicit --date on a later transition still overrides appliedAt", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "applied",
      date: "2026-06-15",
    });

    await run({
      workspace: tmpDir,
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "interview",
      date: "2026-07-01",
    });

    const afterRoles = readJson(workspacePaths(tmpDir).rolesTracked);
    assert.strictEqual(afterRoles[0].application.appliedAt, "2026-07-01");
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
    assert.match(afterTracker, /Rejected 2026-06-10/, "Tracker text should show the actual status, not just a bare date");
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

    // Avoid comparing against a second, independently-timestamped
    // renderHtmlTracker() call (embeds `new Date().toISOString()` internally
    // and was observed to flake on a millisecond-boundary mismatch) — assert
    // on the content that actually matters instead.
    assert.match(htmlTracker, /Rejected 2026-06-10/, "HTML tracker should show the status + date");
    assert.match(htmlTracker, /badge-rejected/, "HTML tracker should bucket a rejected status into the rejected badge");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: supports all enum statuses and each renders visibly (not silently dropped)", async () => {
  const statusBuckets = {
    interested: "not-applied",
    applied: "applied",
    interview: "interview",
    offer: "offer",
    rejected: "rejected",
    withdrawn: "withdrawn",
  };

  for (const [status, expectedBucket] of Object.entries(statusBuckets)) {
    const workspace = createFixtureWorkspace();
    try {
      await run({
        workspace,
        company: "Acme Corp",
        title: "Senior Engineer",
        status,
      });

      const roles = readJson(workspacePaths(workspace).rolesTracked);
      assert.strictEqual(roles[0].application.status, status, `Status should be set to ${status}`);

      const tracker = fs.readFileSync(workspacePaths(workspace).tracker, "utf8");
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      assert.ok(tracker.includes(label), `Tracker should visibly show "${label}" for status ${status}`);

      // Each status must land in its own distinct badge bucket in the HTML
      // tracker, not lumped into the generic "other" bucket alongside any
      // unrecognized/garbage status — the entire point of a deterministic
      // status enum is that it's visibly distinguishable.
      const htmlTracker = fs.readFileSync(workspacePaths(workspace).htmlTracker, "utf8");
      assert.match(
        htmlTracker,
        new RegExp(`"statusBucket":\\s*"${expectedBucket}"`),
        `HTML tracker should bucket status "${status}" as "${expectedBucket}", not "other"`,
      );
    } finally {
      cleanupWorkspace(workspace);
    }
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

test("set-status: throws error on malformed --date", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await assert.rejects(
      async () => {
        await run({
          workspace: tmpDir,
          company: "Acme Corp",
          title: "Senior Engineer",
          status: "applied",
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

test("set-status: throws an ambiguous-match error for duplicate company+title instead of silently picking one", async () => {
  const tmpDir = createFixtureWorkspace([
    {
      id: "role-dup",
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "tracked",
      urls: { job: "", apply: "" },
      notes: [],
      followUpQuestions: [],
      updatedAt: "2026-06-05",
      application: { status: "rejected", appliedAt: "2026-05-01" },
    },
  ]);
  try {
    await assert.rejects(
      async () => {
        await run({
          workspace: tmpDir,
          company: "Acme Corp",
          title: "Senior Engineer",
          status: "applied",
        });
      },
      /ambiguous/i,
      "Should throw an ambiguous-match error rather than silently updating one of the two"
    );

    // Confirm neither role was mutated by the rejected call.
    const roles = readJson(workspacePaths(tmpDir).rolesTracked);
    assert.strictEqual(roles[0].application, undefined, "role-001 must be untouched");
    assert.strictEqual(roles.find((r) => r.id === "role-dup").application.status, "rejected", "role-dup must be untouched");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("set-status: --id disambiguates duplicate company+title matches", async () => {
  const tmpDir = createFixtureWorkspace([
    {
      id: "role-dup",
      company: "Acme Corp",
      title: "Senior Engineer",
      status: "tracked",
      urls: { job: "", apply: "" },
      notes: [],
      followUpQuestions: [],
      updatedAt: "2026-06-05",
      application: { status: "rejected", appliedAt: "2026-05-01" },
    },
  ]);
  try {
    await run({
      workspace: tmpDir,
      id: "role-dup",
      status: "withdrawn",
    });

    const roles = readJson(workspacePaths(tmpDir).rolesTracked);
    assert.strictEqual(roles.find((r) => r.id === "role-dup").application.status, "withdrawn");
    assert.strictEqual(roles[0].application, undefined, "role-001 must be untouched");
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
