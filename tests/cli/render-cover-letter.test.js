"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readDocxText } = require("../helpers/read-docx-text");
const command = require("../../src/cli/commands/render-cover-letter");

function fictionalConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Acme Corp",
    candidate: {
      name: "Sample Candidate",
      contact: [{ text: "Remote, US" }],
    },
    salutation: "Dear Hiring Manager,",
    bodyParagraphs: ["Fictional body paragraph for the render-cover-letter CLI test, with no metric claims in it."],
    closing: "Sincerely, Sample Candidate",
    ...overrides,
  };
}

function makeWorkspace(config = fictionalConfig()) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "render-cover-letter-workspace-"));
  const configPath = path.join(workspace, "cover-letter-config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return { workspace, configPath };
}

async function withWorkspace(config, fn) {
  const { workspace, configPath } = makeWorkspace(config);
  try {
    await fn({ workspace, configPath });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test("render-cover-letter command writes a docx to outputs/cover-letters/<Company>/<file>.docx (golden render seam)", async () => {
  await withWorkspace(fictionalConfig(), async ({ workspace, configPath }) => {
    await command.run({ workspace, config: configPath });

    const expectedPath = path.join(workspace, "outputs", "cover-letters", "Acme Corp", "sample-candidate-acme-corp-cover-letter.docx");
    assert.ok(fs.existsSync(expectedPath), `expected rendered file at ${expectedPath}`);

    const text = readDocxText(expectedPath);
    assert.match(text, /Sample Candidate/);
    assert.match(text, /Dear Hiring Manager,/);
    assert.match(text, /Fictional body paragraph/);
    assert.match(text, /Sincerely, Sample Candidate/);
  });
});

test("render-cover-letter command throws a clear error for an invalid config", async () => {
  await withWorkspace({ company: "Acme Corp" }, async ({ workspace, configPath }) => {
    await assert.rejects(() => command.run({ workspace, config: configPath }), /Invalid cover letter config/);
  });
});

test("render-cover-letter command requires --config", async () => {
  await withWorkspace(fictionalConfig(), async ({ workspace }) => {
    await assert.rejects(() => command.run({ workspace }), /--config/);
  });
});

test("render-cover-letter command blocks on an unsupported metric claim and writes no file", async () => {
  await withWorkspace(
    fictionalConfig({ bodyParagraphs: ["I led a team that grew revenue by 40% in one year."] }),
    async ({ workspace, configPath }) => {
      await assert.rejects(() => command.run({ workspace, config: configPath }), /evidence-backed claim audit/);

      const companyDir = path.join(workspace, "outputs", "cover-letters", "Acme Corp");
      assert.ok(!fs.existsSync(companyDir), "no file should be written when the claim audit blocks");
    },
  );
});

test("render-cover-letter command renders once the claim is backed by an evidence.jsonl entry", async () => {
  await withWorkspace(
    fictionalConfig({ bodyParagraphs: ["I led a team that grew revenue by 40% in one year."] }),
    async ({ workspace, configPath }) => {
      const evidencePath = path.join(workspace, "evidence.jsonl");
      fs.writeFileSync(evidencePath, `${JSON.stringify({ fact: "Grew revenue by 40% in one year", confidence: "high" })}\n`);

      await command.run({ workspace, config: configPath });

      const expectedPath = path.join(workspace, "outputs", "cover-letters", "Acme Corp", "sample-candidate-acme-corp-cover-letter.docx");
      assert.ok(fs.existsSync(expectedPath), `expected rendered file at ${expectedPath}`);
    },
  );
});

test("render-cover-letter command rejects a path-traversal-attempt company value instead of writing outside outputs/cover-letters/", async () => {
  await withWorkspace(fictionalConfig({ company: "../../../../tmp/escaped-cover-letter" }), async ({ workspace, configPath }) => {
    await command.run({ workspace, config: configPath });

    const outputCoverLettersDir = path.join(workspace, "outputs", "cover-letters");
    const entries = fs.readdirSync(outputCoverLettersDir);
    entries.forEach((entry) => {
      const fullPath = path.resolve(outputCoverLettersDir, entry);
      assert.ok(
        fullPath === outputCoverLettersDir || fullPath.startsWith(outputCoverLettersDir + path.sep),
        `expected ${fullPath} to stay under ${outputCoverLettersDir}`,
      );
    });
    assert.ok(!fs.existsSync("/tmp/escaped-cover-letter"), "traversal attempt must not create /tmp/escaped-cover-letter");
  });
});

test("render-cover-letter command rejects an all-dot company value instead of silently writing to the parent directory", async () => {
  await withWorkspace(fictionalConfig({ company: ".." }), async ({ workspace, configPath }) => {
    await assert.rejects(() => command.run({ workspace, config: configPath }), /company/);
  });
});

test("render-cover-letter command strips null bytes from the company value instead of passing them to the filesystem", async () => {
  await withWorkspace(fictionalConfig({ company: "Acme\0Corp" }), async ({ workspace, configPath }) => {
    await command.run({ workspace, config: configPath });
    const expectedPath = path.join(workspace, "outputs", "cover-letters", "AcmeCorp", "sample-candidate-acme-corp-cover-letter.docx");
    assert.ok(fs.existsSync(expectedPath), `expected rendered file at ${expectedPath}`);
  });
});

test("render-cover-letter command rejects an excessively long company value with a clean error, not a raw ENAMETOOLONG crash", async () => {
  await withWorkspace(fictionalConfig({ company: "A".repeat(500) }), async ({ workspace, configPath }) => {
    await assert.rejects(() => command.run({ workspace, config: configPath }), /company must be \d+ characters or fewer/);
  });
});
