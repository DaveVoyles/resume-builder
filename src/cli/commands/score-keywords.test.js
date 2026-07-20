"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { run } = require("./score-keywords");

function fictionalConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Acme Corp",
    candidate: {
      name: "Sample Candidate",
      contact: [{ text: "Remote, US" }],
    },
    summary: { text: "Experienced engineer with skills in React and Node.js" },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Engineer",
            company: "TechCorp",
            dates: "2022 - Present",
            bullets: ["Developed microservices using Kubernetes and Docker", "Built REST APIs with TypeScript"],
          },
        ],
      },
    ],
    skills: [["Languages", "JavaScript, TypeScript"], ["Tools", "React, Node.js, Kubernetes"]],
    ...overrides,
  };
}

function makeWorkspace(config = fictionalConfig(), keywordsList = ["React", "Node.js", "Kubernetes", "Python"]) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "score-keywords-workspace-"));
  const configPath = path.join(workspace, "resume-config.json");
  const keywordsPath = path.join(workspace, "keywords.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  fs.writeFileSync(keywordsPath, JSON.stringify(keywordsList, null, 2));
  return { workspace, configPath, keywordsPath };
}

async function withWorkspace(config, keywords, fn) {
  const { workspace, configPath, keywordsPath } = makeWorkspace(config, keywords);
  try {
    await fn({ workspace, configPath, keywordsPath });
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

test("score-keywords: returns correct coverage percentage", async () => {
  await withWorkspace(fictionalConfig(), ["React", "Node.js", "Kubernetes", "Python"], async ({ configPath, keywordsPath }) => {
    const result = await run({ config: configPath, keywords: keywordsPath });

    assert.strictEqual(result.percent, 75, "Expected 75% coverage (3 out of 4 keywords found)");
    assert.strictEqual(result.present.length, 3, "Expected 3 keywords present");
    assert.strictEqual(result.missing.length, 1, "Expected 1 keyword missing");
  });
});

test("score-keywords: identifies present keywords correctly", async () => {
  await withWorkspace(fictionalConfig(), ["React", "Node.js", "Kubernetes"], async ({ configPath, keywordsPath }) => {
    const result = await run({ config: configPath, keywords: keywordsPath });

    assert.strictEqual(result.percent, 100);
    assert.deepStrictEqual(result.present.sort(), ["Kubernetes", "Node.js", "React"]);
    assert.deepStrictEqual(result.missing, []);
  });
});

test("score-keywords: identifies missing keywords correctly", async () => {
  await withWorkspace(fictionalConfig(), ["React", "Python", "Go"], async ({ configPath, keywordsPath }) => {
    const result = await run({ config: configPath, keywords: keywordsPath });

    // 1 out of 3 = 33.33%, which rounds to 33
    assert.strictEqual(result.percent, 33, "Expected 33% coverage (1 out of 3)");
    assert.deepStrictEqual(result.present, ["React"]);
    assert.deepStrictEqual(result.missing.sort(), ["Go", "Python"]);
  });
});

test("score-keywords: performs case-insensitive matching", async () => {
  await withWorkspace(fictionalConfig(), ["react", "NODE.JS", "kubernetes"], async ({ configPath, keywordsPath }) => {
    const result = await run({ config: configPath, keywords: keywordsPath });

    assert.strictEqual(result.percent, 100, "Expected 100% coverage with different cases");
    assert.strictEqual(result.present.length, 3);
  });
});

test("score-keywords: human-readable output prints without --json flag", async () => {
  await withWorkspace(fictionalConfig(), ["React", "Node.js", "Python"], async ({ configPath, keywordsPath }) => {
    let capturedLogs = [];
    const originalLog = console.log;
    console.log = (msg) => {
      capturedLogs.push(msg);
    };

    try {
      const result = await run({ config: configPath, keywords: keywordsPath });
      // 2/3 = 66.67%, rounds to 67 — assert the exact rendered lines, not just label presence,
      // so a format regression (wrong separator, dropped count, broken pluralization) is caught.
      assert.strictEqual(capturedLogs[0], "Keyword coverage: 67% (2/3)");
      assert.strictEqual(capturedLogs[1], "Present: React, Node.js");
      assert.strictEqual(capturedLogs[2], "Missing: Python");
      assert.strictEqual(result.percent, 67);
    } finally {
      console.log = originalLog;
    }
  });
});

test("score-keywords: human-readable output uses (none) fallback for empty present/missing lists", async () => {
  await withWorkspace(fictionalConfig(), ["React"], async ({ configPath, keywordsPath }) => {
    let capturedLogs = [];
    const originalLog = console.log;
    console.log = (msg) => {
      capturedLogs.push(msg);
    };

    try {
      await run({ config: configPath, keywords: keywordsPath });
      assert.strictEqual(capturedLogs[0], "Keyword coverage: 100% (1/1)");
      assert.strictEqual(capturedLogs[1], "Present: React");
      assert.strictEqual(capturedLogs[2], "Missing: (none)");
    } finally {
      console.log = originalLog;
    }
  });
});

test("score-keywords: --json flag outputs valid JSON", async () => {
  await withWorkspace(fictionalConfig(), ["React", "Node.js", "Python"], async ({ configPath, keywordsPath }) => {
    let capturedLogs = [];
    const originalLog = console.log;
    console.log = (msg) => {
      capturedLogs.push(msg);
    };

    try {
      const result = await run({ config: configPath, keywords: keywordsPath, json: true });
      const output = capturedLogs.join("\n");
      const parsed = JSON.parse(output);
      // 2/3 = 66.67%, rounds to 67
      assert.strictEqual(parsed.percent, 67);
      assert.ok(Array.isArray(parsed.present));
      assert.ok(Array.isArray(parsed.missing));
      assert.strictEqual(parsed.present.length, 2);
      assert.strictEqual(parsed.missing.length, 1);
    } finally {
      console.log = originalLog;
    }
  });
});

test("score-keywords: requires --config", async () => {
  await withWorkspace(fictionalConfig(), ["React"], async ({ keywordsPath }) => {
    await assert.rejects(() => run({ keywords: keywordsPath }), /--config/);
  });
});

test("score-keywords: requires --keywords", async () => {
  await withWorkspace(fictionalConfig(), ["React"], async ({ configPath }) => {
    await assert.rejects(() => run({ config: configPath }), /--keywords/);
  });
});

test("score-keywords: rejects keywords file that is not a JSON array", async () => {
  const { workspace, configPath, keywordsPath } = makeWorkspace(fictionalConfig());
  fs.writeFileSync(keywordsPath, JSON.stringify({ keywords: ["React", "Node.js"] }));

  try {
    await assert.rejects(() => run({ config: configPath, keywords: keywordsPath }), /JSON array/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("score-keywords: handles empty keywords list", async () => {
  await withWorkspace(fictionalConfig(), [], async ({ configPath, keywordsPath }) => {
    const result = await run({ config: configPath, keywords: keywordsPath });

    assert.strictEqual(result.percent, 0);
    assert.deepStrictEqual(result.present, []);
    assert.deepStrictEqual(result.missing, []);
  });
});

test("score-keywords: filters out empty string keywords", async () => {
  await withWorkspace(fictionalConfig(), ["React", "", "Node.js", "  "], async ({ configPath, keywordsPath }) => {
    const result = await run({ config: configPath, keywords: keywordsPath });

    // Only non-empty keywords are counted: React and Node.js are found (both present)
    assert.strictEqual(result.percent, 100);
    assert.strictEqual(result.present.length, 2);
  });
});
