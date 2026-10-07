"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const command = require("../../src/cli/commands/ingest");
const init = require("../../src/cli/commands/init");
const { readJson, readJsonLines, workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");
const { createDefaultProfile } = require("../../src/core/candidate-profile");
const { defaultOnboardingState } = require("../../src/core/onboarding-state");

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

async function captureLogs(fn) {
  const logs = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (...args) => {
    logs.push(args.map(String).join(" "));
  };
  console.warn = (...args) => {
    logs.push(args.map(String).join(" "));
  };
  try {
    await fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }
  return logs;
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

// Coverage for design plan 0006 D1 (issue #128): ingest marks
// materialIngested once real sources are provided.

test("ingest with at least one source marks onboarding-state.materialIngested true", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    writeJson(paths.onboardingState, defaultOnboardingState());
    const linksFixture = fs.mkdtempSync(path.join(os.tmpdir(), "links-fixture-"));
    const linksFile = path.join(linksFixture, "links.md");
    fs.writeFileSync(linksFile, "https://github.com/sample-user");

    try {
      await command.run({ workspace, links: linksFile });
      const state = readJson(paths.onboardingState);
      assert.strictEqual(state.materialIngested, true);
    } finally {
      fs.rmSync(linksFixture, { recursive: true, force: true });
    }
  });
});

test("ingest with zero sources leaves onboarding-state.materialIngested untouched", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    writeJson(paths.onboardingState, defaultOnboardingState());

    await command.run({ workspace });

    const state = readJson(paths.onboardingState);
    assert.strictEqual(state.materialIngested, false, "a no-op ingest call must not flip materialIngested");
    Object.keys(state.sections).forEach((key) => {
      assert.strictEqual(state.sections[key], false, `ingest with no sources must not mark sections.${key}`);
    });
  });
});

test("ingest with a source marks materialIngested only, not intake sections", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    writeJson(paths.onboardingState, defaultOnboardingState());
    const linksFixture = fs.mkdtempSync(path.join(os.tmpdir(), "links-fixture-"));
    const linksFile = path.join(linksFixture, "links.md");
    fs.writeFileSync(linksFile, "https://github.com/sample-user");

    try {
      await command.run({ workspace, links: linksFile });
      const state = readJson(paths.onboardingState);
      assert.strictEqual(state.materialIngested, true);
      Object.keys(state.sections).forEach((key) => {
        assert.strictEqual(state.sections[key], false, `ingest must not mark sections.${key} without that data`);
      });
      assert.strictEqual(state.firstRoleAdded, false);
    } finally {
      fs.rmSync(linksFixture, { recursive: true, force: true });
    }
  });
});

test("ingest with no source flags reads inputs/resumes and inputs/notes and lists skips", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    writeJson(paths.onboardingState, defaultOnboardingState());
    ensureDir(paths.resumes);
    ensureDir(paths.notes);
    fs.writeFileSync(path.join(paths.resumes, "resume.txt"), "Senior engineer at Contoso.\n");
    fs.writeFileSync(path.join(paths.notes, "career.md"), "Led a platform rewrite.\n");
    fs.writeFileSync(path.join(paths.resumes, ".hidden.txt"), "dotfile should skip\n");
    fs.writeFileSync(path.join(paths.notes, "empty.txt"), "");
    fs.writeFileSync(path.join(paths.resumes, "photo.bin"), "not a supported type");
    fs.mkdirSync(path.join(paths.notes, "subdir"));

    const logs = await captureLogs(() => command.run({ workspace }));
    const joined = logs.join("\n");

    assert.match(joined, /Read inputs\/resumes\/resume\.txt/);
    assert.match(joined, /Read inputs\/notes\/career\.md/);
    assert.match(joined, /Skipped inputs\/resumes\/\.hidden\.txt: dotfile/);
    assert.match(joined, /Skipped inputs\/notes\/empty\.txt: empty/);
    assert.match(joined, /Skipped inputs\/resumes\/photo\.bin: unsupported type/);
    assert.match(joined, /Skipped inputs\/notes\/subdir: directory/);

    const entries = readJsonLines(paths.evidence);
    assert.equal(entries.length, 2);
    assert.ok(entries.some((entry) => entry.source.kind === "resume" && entry.source.path.includes("resume.txt")));
    assert.ok(entries.some((entry) => entry.source.kind === "notes" && entry.source.path.includes("career.md")));
    assert.equal(readJson(paths.onboardingState).materialIngested, true);
  });
});

test("ingest with an explicit source flag does not scan input folders", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    ensureDir(paths.resumes);
    ensureDir(paths.notes);
    fs.writeFileSync(path.join(paths.resumes, "decoy.txt"), "should not be ingested\n");
    const notesFixture = fs.mkdtempSync(path.join(os.tmpdir(), "notes-fixture-"));
    const notesFile = path.join(notesFixture, "explicit.md");
    fs.writeFileSync(notesFile, "explicit notes only\n");

    try {
      const logs = await captureLogs(() => command.run({ workspace, notes: notesFile }));
      const joined = logs.join("\n");
      assert.doesNotMatch(joined, /decoy\.txt/);
      assert.doesNotMatch(joined, /Read inputs\/resumes/);
      const entries = readJsonLines(paths.evidence);
      assert.equal(entries.length, 1);
      assert.equal(entries[0].source.kind, "notes");
      assert.match(entries[0].snippet, /explicit notes only/);
    } finally {
      fs.rmSync(notesFixture, { recursive: true, force: true });
    }
  });
});

test("ingest with empty or missing input folders prints a clear message and exits", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    writeJson(paths.onboardingState, defaultOnboardingState());
    const logs = await captureLogs(() => command.run({ workspace }));
    const joined = logs.join("\n");
    assert.match(joined, /No files found in .*inputs\/resumes or .*inputs\/notes\. Add files there or pass --resume\/--notes\./);
    assert.doesNotMatch(joined, /No sources provided/);
    assert.equal(readJsonLines(paths.evidence).length, 0);
    assert.equal(readJson(paths.onboardingState).materialIngested, false);
  });
});

test("ingest default scan after a successful read updates onboarding state", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    writeJson(paths.onboardingState, defaultOnboardingState());
    ensureDir(paths.notes);
    fs.writeFileSync(path.join(paths.notes, "facts.md"), "I shipped a search API.\n");
    await command.run({ workspace });
    assert.equal(readJson(paths.onboardingState).materialIngested, true);
  });
});

test("ingest after setup skips blank intake.md template and does not mark materialIngested", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-setup-"));
  try {
    await init.run({ workspace, noServe: true });
    const paths = workspacePaths(workspace);
    const logs = await captureLogs(() => command.run({ workspace }));
    const joined = logs.join("\n");
    assert.match(joined, /Skipped inputs\/notes\/intake\.md: blank template/);
    assert.equal(readJson(paths.onboardingState).materialIngested, false);
    assert.equal(readJsonLines(paths.evidence).length, 0);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("ingest reads an edited intake.md", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-intake-"));
  try {
    await init.run({ workspace, noServe: true });
    const paths = workspacePaths(workspace);
    const intakePath = path.join(paths.notes, "intake.md");
    const original = fs.readFileSync(intakePath, "utf8");
    fs.writeFileSync(intakePath, original.replace("- Preferred name:", "- Preferred name: Sam Test"));
    const logs = await captureLogs(() => command.run({ workspace }));
    assert.match(logs.join("\n"), /Read inputs\/notes\/intake\.md/);
    const entries = readJsonLines(paths.evidence);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].source.kind, "notes");
    assert.match(entries[0].snippet, /Sam Test/);
    assert.equal(readJson(paths.onboardingState).materialIngested, true);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("ingest default scan skips links.md with only comments", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    writeJson(paths.onboardingState, defaultOnboardingState());
    ensureDir(path.dirname(paths.links));
    fs.writeFileSync(paths.links, "# Public source links\n#\n# One link per line\n\n");
    const logs = await captureLogs(() => command.run({ workspace }));
    assert.match(logs.join("\n"), /Skipped inputs\/links\.md: no links \(only blank or comment lines\)/);
    assert.equal(readJsonLines(paths.evidence).length, 0);
    assert.equal(readJson(paths.onboardingState).materialIngested, false);
  });
});

test("ingest default scan reads links.md when it has a URL", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    ensureDir(path.dirname(paths.links));
    fs.writeFileSync(paths.links, "# comment\nhttps://github.com/sample-user\n");
    await command.run({ workspace });
    const entries = readJsonLines(paths.evidence);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].type, "links");
    assert.match(entries[0].snippet, /github.com\/sample-user/);
  });
});

test("ingest --links plus folders reads both", async () => {
  await withWorkspace(async ({ workspace, paths }) => {
    ensureDir(paths.resumes);
    fs.writeFileSync(path.join(paths.resumes, "resume.txt"), "Engineer at Contoso.\n");
    const extraDir = fs.mkdtempSync(path.join(os.tmpdir(), "extra-links-"));
    const extra = path.join(extraDir, "more.md");
    fs.writeFileSync(extra, "https://portfolio.example.invalid/me\n");
    try {
      const logs = await captureLogs(() => command.run({ workspace, links: extra }));
      assert.match(logs.join("\n"), /Read inputs\/resumes\/resume\.txt/);
      const entries = readJsonLines(paths.evidence);
      assert.equal(entries.length, 2);
      assert.ok(entries.some((entry) => entry.source.kind === "resume"));
      assert.ok(entries.some((entry) => entry.source.kind === "links"));
    } finally {
      fs.rmSync(extraDir, { recursive: true, force: true });
    }
  });
});
