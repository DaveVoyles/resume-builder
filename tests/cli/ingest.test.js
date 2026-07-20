"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const command = require("../../src/cli/commands/ingest");
const { readJsonLines, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");
const { createDefaultProfile } = require("../../src/core/candidate-profile");

// Integration tests for the ingest command. Exercises local source collection,
// evidence entry creation, and profile updates.

function createFixtureWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-workspace-"));
  const paths = workspacePaths(workspace);
  ensureDir(paths.inputs);
  ensureDir(paths.outputResumes);

  // Create required profile.json for ingest to read
  writeJson(paths.profile, createDefaultProfile());

  // Initialize empty evidence.jsonl
  fs.writeFileSync(paths.evidence, "");

  return { workspace, paths };
}

async function withWorkspace(fn) {
  const { workspace, paths } = createFixtureWorkspace();
  try {
    await fn({ workspace, paths });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test("ingest with --links creates evidence entries with type='links' and source.kind='links'", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    // Create a fixture links.md file outside the workspace
    const linksFixture = fs.mkdtempSync(path.join(os.tmpdir(), "links-fixture-"));
    const linksFile = path.join(linksFixture, "test-links.md");
    const linksContent = `# My Public Links

https://github.com/sample-user/project-one
https://portfolio.example.invalid/my-work
https://medium.com/@sample/article-title`;

    fs.writeFileSync(linksFile, linksContent);

    try {
      // Run ingest with the links file
      await command.run({
        workspace,
        links: linksFile,
      });

      // Read and verify evidence.jsonl
      const entries = readJsonLines(paths.evidence);

      // Should have at least one entry
      assert.ok(entries.length > 0, "evidence.jsonl should contain entries");

      // Find the links entry
      const linksEntry = entries.find((entry) => entry.type === "links");
      assert.ok(linksEntry, "should have an evidence entry with type='links'");

      // Verify the source kind is "links"
      assert.strictEqual(linksEntry.source.kind, "links", "source.kind should be 'links'");

      // Verify the snippet contains some of the fixture content
      assert.ok(
        linksEntry.snippet.includes("github.com") || linksEntry.snippet.includes("portfolio"),
        "snippet should contain fixture content",
      );

      // Verify confidence is source-text (since we provided content)
      assert.strictEqual(
        linksEntry.confidence,
        "source-text",
        "confidence should be 'source-text' when snippet has content",
      );

      // Verify summary mentions links
      assert.ok(linksEntry.summary.includes("links"), "summary should mention 'links' source type");
    } finally {
      fs.rmSync(linksFixture, { recursive: true, force: true });
    }
  });
});

test("ingest with multiple --links files creates separate evidence entries", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    // Create two fixture links files
    const linksFixture = fs.mkdtempSync(path.join(os.tmpdir(), "links-fixture-"));
    const linksFile1 = path.join(linksFixture, "links-1.md");
    const linksFile2 = path.join(linksFixture, "links-2.md");

    fs.writeFileSync(linksFile1, "https://github.com/user-one\nhttps://blog1.example.invalid");
    fs.writeFileSync(linksFile2, "https://github.com/user-two\nhttps://blog2.example.invalid");

    try {
      // Run ingest with both links files (array-style via direct option passing)
      // Since asArray handles both single values and arrays, we pass an array
      await command.run({
        workspace,
        links: [linksFile1, linksFile2],
      });

      // Read and verify evidence.jsonl
      const entries = readJsonLines(paths.evidence);

      // Should have multiple entries
      assert.ok(entries.length >= 2, "evidence.jsonl should contain at least 2 entries");

      // All should be links type
      const linksEntries = entries.filter((entry) => entry.type === "links");
      assert.ok(linksEntries.length >= 2, "should have at least 2 links-type entries");

      // Each should reference one of our fixture files
      linksEntries.forEach((entry) => {
        assert.strictEqual(entry.source.kind, "links");
        assert.ok(entry.source.path.includes("links"), "path should reference a links file");
      });
    } finally {
      fs.rmSync(linksFixture, { recursive: true, force: true });
    }
  });
});
