"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readDocxText } = require("../helpers/read-docx-text");

function fictionalConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Acme Corp",
    candidate: {
      name: "Sample Candidate",
      contact: [{ text: "Remote, US" }],
    },
    summary: { text: "Fictional summary for the render-resume CLI test." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Fictional Engineer",
            company: "Northwind Widgets",
            dates: "2022 - Present",
            bullets: ["Did a fictional thing worth mentioning."],
          },
        ],
      },
    ],
    skills: [["Languages", "JavaScript"]],
    ...overrides,
  };
}

function makeWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "render-resume-workspace-"));
  const configPath = path.join(workspace, "resume-config.json");
  fs.writeFileSync(configPath, JSON.stringify(fictionalConfig(), null, 2));
  return { workspace, configPath };
}

test("render-resume command writes a docx to outputs/resumes/<Company>/<file>.docx (golden render seam)", async () => {
  const { workspace, configPath } = makeWorkspace();
  const command = require("../../src/cli/commands/render-resume");

  await command.run({ workspace, config: configPath });

  const expectedPath = path.join(workspace, "outputs", "resumes", "Acme Corp", "sample-candidate-acme-corp.docx");
  assert.ok(fs.existsSync(expectedPath), `expected rendered file at ${expectedPath}`);

  const text = readDocxText(expectedPath);
  assert.match(text, /Sample Candidate/);
  assert.match(text, /Fictional summary for the render-resume CLI test\./);
  assert.match(text, /Senior Fictional Engineer/);

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("render-resume command honors an explicit outputFileName", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "render-resume-workspace-"));
  const configPath = path.join(workspace, "resume-config.json");
  fs.writeFileSync(configPath, JSON.stringify(fictionalConfig({ outputFileName: "custom-name.docx" }), null, 2));
  const command = require("../../src/cli/commands/render-resume");

  await command.run({ workspace, config: configPath });

  const expectedPath = path.join(workspace, "outputs", "resumes", "Acme Corp", "custom-name.docx");
  assert.ok(fs.existsSync(expectedPath));

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("render-resume command throws a clear error for an invalid config", async () => {
  const { workspace, configPath } = makeWorkspace();
  fs.writeFileSync(configPath, JSON.stringify({ company: "Acme Corp" }));
  const command = require("../../src/cli/commands/render-resume");

  await assert.rejects(() => command.run({ workspace, config: configPath }), /Invalid resume config/);

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("render-resume command requires --config", async () => {
  const { workspace } = makeWorkspace();
  const command = require("../../src/cli/commands/render-resume");

  await assert.rejects(() => command.run({ workspace }), /--config/);

  fs.rmSync(workspace, { recursive: true, force: true });
});
