"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadResumeConfig, validateResumeConfig } = require("../../src/core/resume-config");
const init = require("../../src/cli/commands/init");
const validateCommand = require("../../src/cli/commands/validate");
const { writeJson } = require("../../src/core/workspace");

function baseConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Base Co",
    outputFileName: "base.docx",
    candidate: { name: "Sample Candidate", headline: "Fictional operations lead", contact: [{ text: "Remote, US" }] },
    summary: { text: "Base summary for a fictional candidate." },
    experienceSections: [
      { heading: "Experience", jobs: [{ title: "Lead", company: "Acme", dates: "2020 - Present", bullets: ["Ran the front desk."] }] },
    ],
    skills: [["Operations", "Scheduling, billing"]],
    ...overrides,
  };
}

function withDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "extends-"));
  const configs = path.join(dir, "resume-configs");
  fs.mkdirSync(configs, { recursive: true });
  try {
    return fn(configs, dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("a child overrides top-level sections and inherits the rest from its base", () => {
  withDir((dir) => {
    writeJson(path.join(dir, "base.json"), baseConfig());
    writeJson(path.join(dir, "child.json"), {
      extends: "base.json",
      company: "Child Co",
      summary: { text: "Child summary." },
      skills: [["Billing", "Claims"]],
    });
    const merged = loadResumeConfig(path.join(dir, "child.json"));
    assert.equal(merged.company, "Child Co");
    assert.equal(merged.summary.text, "Child summary.");
    assert.deepEqual(merged.skills, [["Billing", "Claims"]], "skills is replaced whole, not merged");
    assert.equal(merged.experienceSections[0].jobs[0].company, "Acme", "experience is inherited");
    assert.equal(merged.candidate.name, "Sample Candidate");
    assert.equal(merged.extends, undefined, "the resolved config has no extends key");
    assert.equal(merged.outputFileName, undefined, "the base's outputFileName is not inherited");
    assert.equal(validateResumeConfig(merged).valid, true);
  });
});

test("a child keeps its own outputFileName", () => {
  withDir((dir) => {
    writeJson(path.join(dir, "base.json"), baseConfig());
    writeJson(path.join(dir, "child.json"), { extends: "base.json", company: "Child Co", outputFileName: "child.docx" });
    assert.equal(loadResumeConfig(path.join(dir, "child.json")).outputFileName, "child.docx");
  });
});

test("extends chains resolve, nearest definition wins", () => {
  withDir((dir) => {
    writeJson(path.join(dir, "root.json"), baseConfig());
    writeJson(path.join(dir, "mid.json"), { extends: "root.json", company: "Mid Co", summary: { text: "Mid summary." } });
    writeJson(path.join(dir, "leaf.json"), { extends: "mid.json", company: "Leaf Co" });
    const merged = loadResumeConfig(path.join(dir, "leaf.json"));
    assert.equal(merged.company, "Leaf Co");
    assert.equal(merged.summary.text, "Mid summary.");
    assert.equal(merged.skills[0][0], "Operations");
  });
});

test("a configuration without extends loads unchanged", () => {
  withDir((dir) => {
    writeJson(path.join(dir, "plain.json"), baseConfig());
    assert.deepEqual(loadResumeConfig(path.join(dir, "plain.json")), baseConfig());
  });
});

test("a missing base file is a clear error without absolute paths", () => {
  withDir((dir) => {
    writeJson(path.join(dir, "child.json"), { extends: "nope.json", company: "Child Co" });
    assert.throws(() => loadResumeConfig(path.join(dir, "child.json")), (error) => {
      assert.match(error.message, /extends: base config not found: nope\.json/u);
      assert.ok(!error.message.includes(dir));
      return true;
    });
  });
});

test("cycles, self-extends, absolute paths, and over-long chains are rejected", () => {
  withDir((dir) => {
    writeJson(path.join(dir, "a.json"), { extends: "b.json", company: "A" });
    writeJson(path.join(dir, "b.json"), { extends: "a.json", company: "B" });
    assert.throws(() => loadResumeConfig(path.join(dir, "a.json")), /extends cycle: a\.json -> b\.json -> a\.json/u);
    writeJson(path.join(dir, "self.json"), { extends: "self.json", company: "S" });
    assert.throws(() => loadResumeConfig(path.join(dir, "self.json")), /extends cycle/u);
    writeJson(path.join(dir, "abs.json"), { extends: path.join(dir, "a.json"), company: "Abs" });
    assert.throws(() => loadResumeConfig(path.join(dir, "abs.json")), /must be a relative path/u);
    for (let i = 0; i < 8; i += 1) {
      writeJson(path.join(dir, `c${i}.json`), i === 7 ? baseConfig() : { extends: `c${i + 1}.json`, company: `C${i}` });
    }
    assert.throws(() => loadResumeConfig(path.join(dir, "c0.json")), /longer than 5/u);
  });
});

test("the schema flags a blank extends value", () => {
  assert.equal(validateResumeConfig(baseConfig({ extends: "" })).valid, false);
  assert.match(validateResumeConfig(baseConfig({ extends: 3 })).errors.join("\n"), /extends: must be a non-empty relative path/u);
});

test("validate resolves extends for configs under resume-configs/ and reports a missing base", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "extends-validate-"));
  const workspace = path.join(dir, "candidate");
  const quiet = async (fn) => {
    const original = { log: console.log, warn: console.warn };
    console.log = () => {};
    console.warn = () => {};
    try {
      return await fn();
    } finally {
      console.log = original.log;
      console.warn = original.warn;
    }
  };
  const validateMessage = async () => {
    try {
      await quiet(() => validateCommand.run({ workspace }));
      return "";
    } catch (error) {
      return error.message;
    }
  };
  try {
    await quiet(() => init.run({ workspace, noServe: true }));
    const configs = path.join(workspace, "resume-configs");
    fs.mkdirSync(configs, { recursive: true });
    writeJson(path.join(configs, "base.json"), baseConfig());
    writeJson(path.join(configs, "child.json"), { extends: "base.json", company: "Child Co", outputFileName: "child.docx" });
    const before = await validateMessage();
    assert.doesNotMatch(before, /child\.json: (company|candidate|summary|experienceSections|skills)/u, "the merged child passes the required-field checks");
    assert.doesNotMatch(before, /base config not found/u);

    writeJson(path.join(configs, "broken.json"), { extends: "missing.json", company: "Broken" });
    const after = await validateMessage();
    assert.match(after, /broken\.json/u);
    assert.match(after, /base config not found: missing\.json/u);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
