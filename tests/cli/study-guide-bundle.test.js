"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const command = require("../../src/cli/commands/study-guide-bundle");
const { readJson, writeJson, workspacePaths, ensureDir } = require("../../src/core/workspace");

// Tests for the study-guide-bundle command, including the cover letter output path inclusion.

function createFixtureWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "study-guide-bundle-workspace-"));
  const paths = workspacePaths(workspace);

  // Create required directories
  ensureDir(paths.resumeConfigs);
  ensureDir(paths.outputResumes);

  // Create a profile
  writeJson(paths.profile, {
    candidate: { name: "Test Candidate" },
  });

  // Create evidence
  const evidence = [
    { id: "ev-001", type: "resume", fact: "Some fact" },
  ];
  fs.writeFileSync(paths.evidence, `${evidence.map((e) => JSON.stringify(e)).join("\n")}\n`);

  // Create a tracked role
  const role = {
    id: "role-001",
    company: "Test Company",
    title: "Test Role",
    status: "tracked",
    application: { status: "interested" },
    urls: { job: "https://jobs.example.com/test", apply: "https://apply.example.com" },
    resume: {
      configPath: "resume-configs/test.json",
      outputPath: "outputs/resumes/Test Company/test.docx",
      status: "review-needed",
    },
  };
  writeJson(paths.rolesTracked, [role]);

  // Create a resume config
  const resumeConfig = {
    schemaVersion: "1.0",
    company: "Test Company",
    candidate: { name: "Test Candidate" },
  };
  writeJson(path.join(paths.resumeConfigs, "test.json"), resumeConfig);

  return { workspace, paths, role, resumeConfig };
}

function cleanupWorkspace(workspace) {
  fs.rmSync(workspace, { recursive: true, force: true });
}

test("study-guide-bundle includes coverLetterOutputPath when role.coverLetter exists", async () => {
  const { workspace, paths, role } = createFixtureWorkspace();

  try {
    // Add a cover letter to the role
    role.coverLetter = {
      configPath: "resume-configs/test-cover-letter.json",
      outputPath: "outputs/cover-letters/Test Company/test-cover-letter.docx",
      status: "review-needed",
    };
    writeJson(paths.rolesTracked, [role]);

    const bundlePath = await command.run({
      workspace,
      id: "role-001",
    });

    const bundle = readJson(bundlePath);

    // The bundle should include the cover letter output path
    assert.strictEqual(
      bundle.coverLetterOutputPath,
      "outputs/cover-letters/Test Company/test-cover-letter.docx",
      "coverLetterOutputPath should match the role's cover letter output path"
    );
  } finally {
    cleanupWorkspace(workspace);
  }
});

test("study-guide-bundle sets coverLetterOutputPath to null when role.coverLetter does not exist", async () => {
  const { workspace, paths, role } = createFixtureWorkspace();

  try {
    // Role has no cover letter field
    writeJson(paths.rolesTracked, [role]);

    const bundlePath = await command.run({
      workspace,
      id: "role-001",
    });

    const bundle = readJson(bundlePath);

    // The bundle should have null for coverLetterOutputPath
    assert.strictEqual(
      bundle.coverLetterOutputPath,
      null,
      "coverLetterOutputPath should be null when role has no cover letter"
    );
  } finally {
    cleanupWorkspace(workspace);
  }
});

test("study-guide-bundle includes all expected fields alongside coverLetterOutputPath", async () => {
  const { workspace, paths, role } = createFixtureWorkspace();

  try {
    role.coverLetter = {
      configPath: "resume-configs/test-cover-letter.json",
      outputPath: "outputs/cover-letters/Test Company/test-cover-letter.docx",
      status: "review-needed",
    };
    writeJson(paths.rolesTracked, [role]);

    const bundlePath = await command.run({
      workspace,
      id: "role-001",
    });

    const bundle = readJson(bundlePath);

    // Verify all required fields are present
    assert.ok(bundle.role, "bundle should have role field");
    assert.ok(bundle.profile, "bundle should have profile field");
    assert.ok(bundle.evidence, "bundle should have evidence field");
    assert.ok(bundle.resumeConfig, "bundle should have resumeConfig field");
    assert.ok("coverLetterOutputPath" in bundle, "bundle should have coverLetterOutputPath field");
    assert.ok(bundle.jobPosting, "bundle should have jobPosting field");
    assert.ok(bundle.generatedAt, "bundle should have generatedAt field");
  } finally {
    cleanupWorkspace(workspace);
  }
});
