"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { run } = require("../../src/cli/commands/validate");
const { workspacePaths, writeJson, ensureDir } = require("../../src/core/workspace");
const { renderTracker } = require("../../src/renderers/markdown-tracker");

// Fixture-based tests for the evidence-backed claim audit seam (design plan
// 0001, D3 Testing Decisions): fixture pairs of (role config, evidence
// ledger) covering supported-claim pass, unsupported-claim fail, and
// thin-ledger warning copy, exercised through the real `validate` CLI
// command (not just the core claim-audit module in isolation).

function baseResumeConfig(bullets) {
  return {
    schemaVersion: "1.0",
    company: "Acme Corp",
    candidate: { name: "Sample Candidate", contact: [{ text: "Remote, US" }] },
    summary: { text: "Fictional summary for the validate CLI claim-audit test." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Fictional Engineer",
            company: "Northwind Widgets",
            dates: "2022 - Present",
            bullets,
          },
        ],
      },
    ],
    skills: [["Languages", "JavaScript"]],
  };
}

function evidenceLine(entry) {
  return JSON.stringify(entry);
}

function sourceBackedEntry(id, text) {
  return {
    id,
    type: "resume",
    fact: text,
    summary: `resume source ingested from inputs/resumes/${id}.md`,
    source: { kind: "resume", path: `inputs/resumes/${id}.md` },
    snippet: text,
    confidence: "source-text",
    metadata: { sha256: "fixture", extractionMode: "utf8" },
    createdAt: "2026-06-08T12:00:00.000Z",
  };
}

/**
 * Builds a minimal, otherwise-valid fixture workspace so the claim-audit
 * seam can be tested in isolation.
 *
 * `resumeConfig` writes a single resume-configs/role.json (the common case).
 * `resumeConfigFiles` is the general form for multi-file or malformed-file
 * fixtures: a { "<filename>.json": object | rawString } map. A string value
 * is written verbatim (byte-for-byte), letting a test construct invalid
 * JSON on purpose; an object value is JSON-stringified normally.
 * `emptyResumeConfigsDir` creates resume-configs/ with no files in it.
 */
function createFixtureWorkspace({ resumeConfig, resumeConfigFiles, emptyResumeConfigsDir, evidenceEntries = [] } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-validate-"));
  const paths = workspacePaths(tmpDir);
  ensureDir(paths.outputs);

  writeJson(paths.profile, {
    schemaVersion: "1.0",
    candidate: { id: "test-candidate", preferredName: "Test User", links: [] },
    skills: [],
    experience: [],
    projects: [],
    education: [],
    sources: [],
  });

  const roles = [];
  writeJson(paths.rolesSeed, roles);
  writeJson(paths.rolesTracked, roles);
  fs.writeFileSync(paths.tracker, renderTracker(roles));

  const evidenceText = evidenceEntries.length > 0 ? `${evidenceEntries.map(evidenceLine).join("\n")}\n` : "";
  fs.writeFileSync(paths.evidence, evidenceText);

  if (resumeConfig) {
    ensureDir(paths.resumeConfigs);
    writeJson(path.join(paths.resumeConfigs, "role.json"), resumeConfig);
  }

  if (resumeConfigFiles) {
    ensureDir(paths.resumeConfigs);
    Object.entries(resumeConfigFiles).forEach(([fileName, content]) => {
      const filePath = path.join(paths.resumeConfigs, fileName);
      if (typeof content === "string") {
        fs.writeFileSync(filePath, content);
      } else {
        writeJson(filePath, content);
      }
    });
  }

  if (emptyResumeConfigsDir) {
    ensureDir(paths.resumeConfigs);
  }

  return tmpDir;
}

function cleanupWorkspace(tmpDir) {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
}

// validate's `run` is synchronous (it throws directly rather than returning
// a rejected promise), so these use assert.throws/doesNotThrow rather than
// assert.rejects/doesNotReject.

test("validate passes a workspace with no resume-configs directory at all (backward compatible)", () => {
  const tmpDir = createFixtureWorkspace();
  try {
    assert.doesNotThrow(() => run({ workspace: tmpDir }));
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate passes when every claim in a resume config is backed by evidence", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfig: baseResumeConfig(["Reduced build times by 30% through pipeline caching."]),
    evidenceEntries: [
      sourceBackedEntry("ev-001", "Reduced build times by 30% through pipeline caching, confirmed via CI dashboards."),
      sourceBackedEntry("ev-002", "Documented pipeline caching architecture for the platform team."),
      sourceBackedEntry("ev-003", "Presented build-time improvements at a quarterly engineering review."),
    ],
  });
  try {
    assert.doesNotThrow(() => run({ workspace: tmpDir }));
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate fails, blocking, when a resume config claims a metric with no supporting evidence entry", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfig: baseResumeConfig(["Increased revenue by 500% in one quarter."]),
    evidenceEntries: [
      sourceBackedEntry("ev-001", "Contributed to revenue-generating feature work."),
      sourceBackedEntry("ev-002", "Documented pipeline caching architecture for the platform team."),
      sourceBackedEntry("ev-003", "Presented build-time improvements at a quarterly engineering review."),
    ],
  });
  try {
    assert.throws(() => run({ workspace: tmpDir }), (error) => {
      assert.match(error.message, /Workspace validation failed/);
      assert.match(error.message, /role\.json/);
      assert.match(error.message, /Unsupported claim/);
      assert.match(error.message, /500%/);
      assert.match(error.message, /experienceSections\[0\]\.jobs\[0\]\.bullets\[0\]/);
      return true;
    });
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate passes when resume-configs/ exists but is empty", () => {
  const tmpDir = createFixtureWorkspace({ emptyResumeConfigsDir: true });
  try {
    assert.doesNotThrow(() => run({ workspace: tmpDir }));
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate fails, blocking, with a clear message when a resume-config file is malformed JSON", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfigFiles: { "broken.json": "{ this is not valid json" },
  });
  try {
    assert.throws(() => run({ workspace: tmpDir }), (error) => {
      assert.match(error.message, /Workspace validation failed/);
      assert.match(error.message, /broken\.json/);
      return true;
    });
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate fails, blocking, with schema errors (not a claim-audit crash) when a resume config fails schema validation", () => {
  const tmpDir = createFixtureWorkspace({
    // Missing required fields (candidate, summary, experienceSections, skills).
    resumeConfigFiles: { "invalid-schema.json": { schemaVersion: "1.0", company: "Acme Corp" } },
  });
  try {
    assert.throws(() => run({ workspace: tmpDir }), (error) => {
      assert.match(error.message, /Workspace validation failed/);
      assert.match(error.message, /invalid-schema\.json/);
      assert.match(error.message, /candidate: required object/);
      assert.doesNotMatch(error.message, /Unsupported claim/);
      return true;
    });
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate attributes errors and warnings to the correct file when resume-configs/ has multiple configs", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfigFiles: {
      "passing.json": baseResumeConfig(["Reduced build times by 30% through pipeline caching."]),
      "failing.json": baseResumeConfig(["Increased revenue by 500% in one quarter."]),
    },
    evidenceEntries: [
      sourceBackedEntry("ev-001", "Reduced build times by 30% through pipeline caching, confirmed via CI dashboards."),
      sourceBackedEntry("ev-002", "Documented pipeline caching architecture for the platform team."),
      sourceBackedEntry("ev-003", "Presented build-time improvements at a quarterly engineering review."),
    ],
  });
  try {
    assert.throws(() => run({ workspace: tmpDir }), (error) => {
      assert.match(error.message, /failing\.json/);
      assert.match(error.message, /500%/);
      // The passing config's own file name must not be blamed for the other file's unsupported claim.
      assert.doesNotMatch(error.message, /passing\.json: Unsupported claim/);
      return true;
    });
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate passes (does not block) but warns when the evidence ledger is thin", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfig: baseResumeConfig(["Led launch coordination for an internal developer platform."]),
    evidenceEntries: [sourceBackedEntry("ev-001", "Led launch coordination for an internal developer platform.")],
  });

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  try {
    assert.doesNotThrow(() => run({ workspace: tmpDir }));
    assert.ok(
      warnings.some((message) => /thin/i.test(message) && /role\.json/.test(message)),
      `expected a thin-ledger warning, got: ${JSON.stringify(warnings)}`,
    );
  } finally {
    console.warn = originalWarn;
    cleanupWorkspace(tmpDir);
  }
});

test("validate passes when feedback.jsonl is absent (optional file)", () => {
  const tmpDir = createFixtureWorkspace();
  try {
    // feedback.jsonl file is not created by createFixtureWorkspace, so validation should pass
    assert.doesNotThrow(() => run({ workspace: tmpDir }));
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

// Coverage for design plan 0006 D1 (issue #128): .onboarding-state.json is
// optional, same as feedback.jsonl — older workspaces created before this
// feature existed must still validate cleanly.

test("validate passes when .onboarding-state.json is absent (optional file, predates plan 0006)", () => {
  const tmpDir = createFixtureWorkspace();
  try {
    assert.doesNotThrow(() => run({ workspace: tmpDir }));
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate passes when .onboarding-state.json is present and well-formed", () => {
  const tmpDir = createFixtureWorkspace();
  try {
    const { defaultOnboardingState } = require("../../src/core/onboarding-state");
    writeJson(workspacePaths(tmpDir).onboardingState, defaultOnboardingState());
    assert.doesNotThrow(() => run({ workspace: tmpDir }));
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate fails when .onboarding-state.json has a malformed shape", () => {
  const tmpDir = createFixtureWorkspace();
  try {
    writeJson(workspacePaths(tmpDir).onboardingState, { sections: "not-an-object" });
    assert.throws(() => run({ workspace: tmpDir }), /onboarding-state\.sections must be an object/);
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate passes when feedback.jsonl contains a valid entry", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfig: baseResumeConfig(["Sample bullet."]),
    evidenceEntries: [],
  });

  const feedbackPath = path.join(tmpDir, "feedback.jsonl");
  const feedbackEntry = {
    schemaVersion: "1.0",
    id: "fb-001",
    context: "interview",
    question: "Tell me about your experience with system design.",
    answer: "I discussed a project I led.",
    sentiment: "confident",
    proposedAnswer: "I would walk through the architecture and trade-offs.",
    createdAt: "2026-07-20T14:30:00.000Z",
  };
  fs.writeFileSync(feedbackPath, `${JSON.stringify(feedbackEntry)}\n`);

  try {
    assert.doesNotThrow(() => run({ workspace: tmpDir }));
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate fails when feedback.jsonl has malformed JSON and reports the correct line number", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfig: baseResumeConfig(["Sample bullet."]),
    evidenceEntries: [],
  });

  const feedbackPath = path.join(tmpDir, "feedback.jsonl");
  const validEntry = {
    schemaVersion: "1.0",
    id: "fb-001",
    context: "interview",
    question: "Question 1",
    answer: "Answer 1",
    sentiment: "confident",
    proposedAnswer: "Better answer 1",
    createdAt: "2026-07-20T14:30:00.000Z",
  };
  const content = `${JSON.stringify(validEntry)}\n{ invalid json\n`;
  fs.writeFileSync(feedbackPath, content);

  try {
    assert.throws(() => run({ workspace: tmpDir }), (error) => {
      assert.match(error.message, /feedback.jsonl line 2/i);
      assert.match(error.message, /JSON/i);
      return true;
    });
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate fails when feedback.jsonl entry is missing a required field", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfig: baseResumeConfig(["Sample bullet."]),
    evidenceEntries: [],
  });

  const feedbackPath = path.join(tmpDir, "feedback.jsonl");
  // Missing the 'question' field
  const invalidEntry = {
    schemaVersion: "1.0",
    id: "fb-001",
    context: "interview",
    answer: "Answer 1",
    sentiment: "confident",
    proposedAnswer: "Better answer 1",
    createdAt: "2026-07-20T14:30:00.000Z",
  };
  fs.writeFileSync(feedbackPath, `${JSON.stringify(invalidEntry)}\n`);

  try {
    assert.throws(() => run({ workspace: tmpDir }), (error) => {
      assert.match(error.message, /feedback line 1/);
      assert.match(error.message, /question/);
      return true;
    });
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate fails when feedback.jsonl entry has invalid context enum value", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfig: baseResumeConfig(["Sample bullet."]),
    evidenceEntries: [],
  });

  const feedbackPath = path.join(tmpDir, "feedback.jsonl");
  const invalidEntry = {
    schemaVersion: "1.0",
    id: "fb-001",
    context: "invalid-context",
    question: "Question 1",
    answer: "Answer 1",
    sentiment: "confident",
    proposedAnswer: "Better answer 1",
    createdAt: "2026-07-20T14:30:00.000Z",
  };
  fs.writeFileSync(feedbackPath, `${JSON.stringify(invalidEntry)}\n`);

  try {
    assert.throws(() => run({ workspace: tmpDir }), (error) => {
      assert.match(error.message, /feedback line 1/);
      assert.match(error.message, /context/);
      assert.match(error.message, /invalid-context/);
      return true;
    });
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate fails when feedback.jsonl entry has invalid sentiment enum value", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfig: baseResumeConfig(["Sample bullet."]),
    evidenceEntries: [],
  });

  const feedbackPath = path.join(tmpDir, "feedback.jsonl");
  const invalidEntry = {
    schemaVersion: "1.0",
    id: "fb-001",
    context: "interview",
    question: "Question 1",
    answer: "Answer 1",
    sentiment: "bad-sentiment",
    proposedAnswer: "Better answer 1",
    createdAt: "2026-07-20T14:30:00.000Z",
  };
  fs.writeFileSync(feedbackPath, `${JSON.stringify(invalidEntry)}\n`);

  try {
    assert.throws(() => run({ workspace: tmpDir }), (error) => {
      assert.match(error.message, /feedback line 1/);
      assert.match(error.message, /sentiment/);
      assert.match(error.message, /bad-sentiment/);
      return true;
    });
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate fails when feedback.jsonl entry has an invalid schemaVersion", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfig: baseResumeConfig(["Sample bullet."]),
    evidenceEntries: [],
  });

  const feedbackPath = path.join(tmpDir, "feedback.jsonl");
  const invalidEntry = {
    schemaVersion: "2.0",
    id: "fb-001",
    context: "interview",
    question: "Question 1",
    answer: "Answer 1",
    sentiment: "confident",
    proposedAnswer: "Better answer 1",
    createdAt: "2026-07-20T14:30:00.000Z",
  };
  fs.writeFileSync(feedbackPath, `${JSON.stringify(invalidEntry)}\n`);

  try {
    assert.throws(() => run({ workspace: tmpDir }), (error) => {
      assert.match(error.message, /feedback line 1/);
      assert.match(error.message, /schemaVersion/);
      return true;
    });
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate fails when feedback.jsonl has two entries with the same id", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfig: baseResumeConfig(["Sample bullet."]),
    evidenceEntries: [],
  });

  const feedbackPath = path.join(tmpDir, "feedback.jsonl");
  const entry = {
    schemaVersion: "1.0",
    id: "fb-001",
    context: "interview",
    question: "Question 1",
    answer: "Answer 1",
    sentiment: "confident",
    proposedAnswer: "Better answer 1",
    createdAt: "2026-07-20T14:30:00.000Z",
  };
  fs.writeFileSync(feedbackPath, `${JSON.stringify(entry)}\n${JSON.stringify(entry)}\n`);

  try {
    assert.throws(() => run({ workspace: tmpDir }), (error) => {
      assert.match(error.message, /duplicate id fb-001/);
      return true;
    });
  } finally {
    cleanupWorkspace(tmpDir);
  }
});

test("validate fails when a feedback.jsonl line parses to a non-object value", () => {
  const tmpDir = createFixtureWorkspace({
    resumeConfig: baseResumeConfig(["Sample bullet."]),
    evidenceEntries: [],
  });

  const feedbackPath = path.join(tmpDir, "feedback.jsonl");
  fs.writeFileSync(feedbackPath, `${JSON.stringify("just a string")}\n`);

  try {
    assert.throws(() => run({ workspace: tmpDir }), (error) => {
      assert.match(error.message, /feedback line 1/);
      assert.match(error.message, /must be an object/);
      return true;
    });
  } finally {
    cleanupWorkspace(tmpDir);
  }
});
