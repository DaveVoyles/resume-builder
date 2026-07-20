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

test("study-guide-bundle: does not silently match a config for an unrelated company via filename substring coincidence", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    // "Ab" is a substring of "test-company...json"'s neighbor below — the
    // old filename-substring matcher would have silently paired this role
    // with an unrelated company's config just because the slug happened to
    // appear inside the filename. Add a role whose company is a substring
    // of an existing filename fragment, but whose config's own `company`
    // field does NOT match — this must fail loud, not silently succeed.
    const paths = workspacePaths(tmpDir);
    const roles = readJson(paths.rolesTracked);
    roles.push({
      id: "role-tracked-002",
      company: "Comp",
      title: "Other Role",
      status: "tracked",
      urls: {},
      updatedAt: "2026-06-08",
    });
    writeJson(paths.rolesTracked, roles);

    await assert.rejects(
      () => run({ workspace: tmpDir, id: "role-tracked-002" }),
      /Resume config not found/i,
      "A company-name substring coincidence in the filename must not produce a silent wrong match"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("study-guide-bundle: prefers role.resume.configPath (set by tailor, D4) over content-matching by company", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const paths = workspacePaths(tmpDir);

    // A second config with a DIFFERENT company than the role, linked via
    // resume.configPath — if the lookup were still content-matching by
    // company, this config would never be selected (the role's company is
    // "Test Company", not "Linked Co"). Selecting it proves the explicit
    // link is used instead of the fallback scan.
    const linkedConfigPath = path.join(tmpDir, "resume-configs", "linked-config.json");
    writeJson(linkedConfigPath, {
      schemaVersion: "1.0",
      company: "Linked Co",
      candidate: { name: "Test User", contact: [{ text: "test@example.invalid" }] },
      summary: { text: "Config reached only via the explicit resume.configPath link." },
      experienceSections: [{ heading: "Experience", jobs: [{ title: "X", company: "Y", dates: "Z", bullets: ["b"] }] }],
      skills: [["A", "B"]],
    });

    const roles = readJson(paths.rolesTracked);
    roles[0].resume = { configPath: "resume-configs/linked-config.json" };
    writeJson(paths.rolesTracked, roles);

    await run({ workspace: tmpDir, id: "role-tracked-001" });

    const bundlePath = path.join(tmpDir, "outputs", "study-guide-bundles", "role-tracked-001.json");
    const bundle = readJson(bundlePath);
    assert.equal(bundle.resumeConfig.company, "Linked Co", "should bundle the linked config, not the content-matched one");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("study-guide-bundle: falls back to content-matching instead of following a path-traversal resume.configPath", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    // roles.tracked.json is a plain, hand-editable JSON file — a
    // `../`-laden resume.configPath must not be trusted to escape the
    // workspace. Point it at this test file itself (a real file outside
    // the workspace) to prove an escaping path is never read, not just that
    // a missing one falls back.
    const paths = workspacePaths(tmpDir);
    const roles = readJson(paths.rolesTracked);
    roles[0].resume = { configPath: "../../../study-guide-bundle.test.js" };
    writeJson(paths.rolesTracked, roles);

    await run({ workspace: tmpDir, id: "role-tracked-001" });

    const bundlePath = path.join(tmpDir, "outputs", "study-guide-bundles", "role-tracked-001.json");
    const bundle = readJson(bundlePath);
    assert.equal(bundle.resumeConfig.company, "Test Company", "must fall back to the content-matched config, not read the traversal target");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("study-guide-bundle: falls back to content-matching when resume.configPath points to a missing file", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const paths = workspacePaths(tmpDir);
    const roles = readJson(paths.rolesTracked);
    roles[0].resume = { configPath: "resume-configs/does-not-exist.json" };
    writeJson(paths.rolesTracked, roles);

    await run({ workspace: tmpDir, id: "role-tracked-001" });

    const bundlePath = path.join(tmpDir, "outputs", "study-guide-bundles", "role-tracked-001.json");
    const bundle = readJson(bundlePath);
    assert.equal(bundle.resumeConfig.company, "Test Company", "should fall back to the content-matched config");
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("study-guide-bundle: fails loud (ambiguous) rather than guessing when two configs match the same company", async () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const configDir = path.join(tmpDir, "resume-configs");
    writeJson(path.join(configDir, "test-company-second-config.json"), {
      schemaVersion: "1.0",
      company: "Test Company",
      candidate: { name: "Test User", contact: [{ text: "test@example.invalid" }] },
      summary: { text: "A second, different config for the same company." },
      experienceSections: [{ heading: "Experience", jobs: [{ title: "X", company: "Y", dates: "Z", bullets: ["b"] }] }],
      skills: [["A", "B"]],
    });

    await assert.rejects(
      () => run({ workspace: tmpDir, id: "role-tracked-001" }),
      /Ambiguous resume config/i,
      "Two configs matching the same company must fail loud instead of silently picking one"
    );
  } finally {
    cleanupWorkspace(tmpDir);
  }
});
