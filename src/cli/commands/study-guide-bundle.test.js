"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { run } = require("./study-guide-bundle");
const { workspacePaths, readJson, writeJson, ensureDir } = require("../../core/workspace");

/**
 * Test helper: create a temporary fixture workspace with sample data
 */
function createFixtureWorkspace() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-bundle-"));
  const paths = workspacePaths(tmpDir);

  ensureDir(paths.outputs);
  ensureDir(path.join(tmpDir, "resume-configs"));

  // Create profile
  writeJson(paths.profile, {
    schemaVersion: "1.0",
    candidate: {
      id: "test-candidate",
      preferredName: "Test User",
      location: "Test City, TS",
    },
    summary: "Test candidate summary.",
    skills: ["JavaScript", "TypeScript"],
    experience: [
      {
        id: "exp-001",
        organization: "Test Corp",
        title: "Test Engineer",
        startDate: "2020-01",
        endDate: null,
        location: "Remote",
        highlights: [
          {
            text: "Did something important.",
            evidenceIds: ["ev-001"],
          },
        ],
      },
    ],
    updatedAt: "2026-06-08",
  });

  // Create evidence ledger
  fs.writeFileSync(
    paths.evidence,
    '{"id":"ev-001","type":"resume","fact":"Did something important.","summary":"test evidence","source":{"kind":"resume","path":"test.md"},"snippet":"Did something important.","confidence":"high","metadata":{},"createdAt":"2026-06-08T00:00:00Z"}\n'
  );

  // Create tracked roles
  writeJson(paths.rolesTracked, [
    {
      id: "role-tracked-001",
      company: "Test Company",
      title: "Senior Test Engineer",
      status: "tracked",
      urls: {
        job: "https://example.invalid/job",
        apply: "https://example.invalid/apply",
      },
      fit: {
        level: "strong",
        rationale: "Good fit for test skills.",
      },
      updatedAt: "2026-06-08",
    },
  ]);

  // Create role config
  const roleConfigPath = path.join(tmpDir, "resume-configs", "test-company-senior-test-engineer.json");
  writeJson(roleConfigPath, {
    schemaVersion: "1.0",
    company: "Test Company",
    candidate: {
      name: "Test User",
      contact: [{ text: "test@example.invalid" }],
    },
    summary: {
      text: "Test candidate with experience in testing.",
    },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Test Engineer",
            company: "Test Corp",
            dates: "2020 - Present",
            bullets: ["Led testing initiatives."],
          },
        ],
      },
    ],
    skills: [["Testing", "Test automation, QA"]],
  });

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

test("study-guide-bundle: creates bundle by role ID", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      id: "role-tracked-001",
    });

    const bundlePath = path.join(tmpDir, "outputs", "study-guide-bundles", "role-tracked-001.json");
    assert.ok(fs.existsSync(bundlePath), "Bundle file should exist");

    const bundle = readJson(bundlePath);
    assert.ok(bundle.profile, "Bundle should contain profile");
    assert.ok(bundle.evidence, "Bundle should contain evidence array");
    assert.ok(bundle.role, "Bundle should contain role");
    assert.ok(bundle.resumeConfig, "Bundle should contain resume config");
    assert.ok(bundle.jobPosting, "Bundle should contain job posting reference");

    assert.equal(bundle.role.id, "role-tracked-001");
    assert.equal(bundle.role.company, "Test Company");
    assert.equal(bundle.resumeConfig.company, "Test Company");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("study-guide-bundle: creates bundle by company and title", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      company: "Test Company",
      title: "Senior Test Engineer",
    });

    // Find the bundle file (may vary based on ID)
    const bundleDir = path.join(tmpDir, "outputs", "study-guide-bundles");
    const files = fs.readdirSync(bundleDir);
    assert.equal(files.length, 1, "Should create exactly one bundle");

    const bundle = readJson(path.join(bundleDir, files[0]));
    assert.equal(bundle.role.company, "Test Company");
    assert.equal(bundle.role.title, "Senior Test Engineer");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("study-guide-bundle: fails when role not found by ID", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await assert.rejects(
      () =>
        run({
          workspace: tmpDir,
          id: "nonexistent-role",
        }),
      /not found/i
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("study-guide-bundle: fails when no company or ID provided", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await assert.rejects(
      () =>
        run({
          workspace: tmpDir,
        }),
      /requires/i
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("study-guide-bundle: includes evidence references", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    await run({
      workspace: tmpDir,
      id: "role-tracked-001",
    });

    const bundlePath = path.join(tmpDir, "outputs", "study-guide-bundles", "role-tracked-001.json");
    const bundle = readJson(bundlePath);

    assert.ok(Array.isArray(bundle.evidence), "Evidence should be an array");
    assert.equal(bundle.evidence.length, 1, "Should include one evidence entry");
    assert.equal(bundle.evidence[0].id, "ev-001");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});
