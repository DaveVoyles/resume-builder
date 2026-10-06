"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateResumeConfig } = require("../../src/core/resume-config");

function validConfig() {
  return {
    schemaVersion: "1.0",
    company: "Acme Corp",
    outputFileName: "sample-candidate-acme-corp.docx",
    candidate: {
      name: "Sample Candidate",
      headline: "Fictional engineer for tests",
      contact: [
        { text: "Remote, US" },
        { text: "sample.candidate@example.invalid", link: "mailto:sample.candidate@example.invalid" },
      ],
    },
    summary: { text: "Fictional summary sentence for a fictional candidate." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Engineer",
            company: "Acme Corp",
            dates: "2022 - Present",
            bullets: ["Did a fictional thing.", "Did another fictional thing."],
          },
        ],
      },
    ],
    skills: [["Languages", "JavaScript, Python"]],
  };
}

test("validateResumeConfig accepts a well-formed config", () => {
  const { valid, errors } = validateResumeConfig(validConfig());
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test("validateResumeConfig rejects a non-object config", () => {
  const { valid, errors } = validateResumeConfig(null);
  assert.equal(valid, false);
  assert.ok(errors.length > 0);
});

test("validateResumeConfig requires company", () => {
  const config = validConfig();
  delete config.company;
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("company")));
});

test("validateResumeConfig requires candidate.name", () => {
  const config = validConfig();
  config.candidate.name = "";
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("candidate.name")));
});

test("validateResumeConfig requires candidate.contact to be a non-empty array", () => {
  const config = validConfig();
  config.candidate.contact = [];
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("candidate.contact")));
});

test("validateResumeConfig requires summary.text", () => {
  const config = validConfig();
  config.summary = {};
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("summary.text")));
});

test("validateResumeConfig requires at least one experience section with at least one job", () => {
  const config = validConfig();
  config.experienceSections = [];
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("experienceSections")));
});

test("validateResumeConfig requires job bullets to be non-empty strings", () => {
  const config = validConfig();
  config.experienceSections[0].jobs[0].bullets = ["", "  "];
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("bullets")));
});

test("validateResumeConfig requires skills to be [label, value] string pairs", () => {
  const config = validConfig();
  config.skills = [["only-one-entry"]];
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("skills")));
});

test("validateResumeConfig accepts optional education, publications, and speaking arrays", () => {
  const config = validConfig();
  config.education = [{ degree: "B.S. Fictional Studies", institution: "Example University", dates: "2010 - 2014" }];
  config.publications = [{ title: "A Fictional Paper", publisher: "Fictional Press", dates: "2020" }];
  config.speaking = [{ heading: "Fictional Conference Talks", organizations: "ExampleConf", dates: "2021" }];
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test("validateResumeConfig rejects an invalid publicationsSpeakingLayout", () => {
  const config = validConfig();
  config.publicationsSpeakingLayout = "not-a-real-layout";
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("publicationsSpeakingLayout")));
});

test("validateResumeConfig rejects an unsupported schemaVersion", () => {
  const config = validConfig();
  config.schemaVersion = "2.0";
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("schemaVersion")));
});

test("validateResumeConfig rejects a non-object candidate", () => {
  const config = validConfig();
  config.candidate = "Sample Candidate";
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("candidate")));
});

test("validateResumeConfig rejects a non-object summary", () => {
  const config = validConfig();
  config.summary = "just a string";
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("summary")));
});

test("validateResumeConfig rejects malformed education entries", () => {
  const config = validConfig();
  config.education = [{ degree: "B.S. Fictional Studies" }]; // missing institution, dates
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("education[0].institution")));
  assert.ok(errors.some((error) => error.includes("education[0].dates")));
});

test("validateResumeConfig rejects malformed publications entries", () => {
  const config = validConfig();
  config.publications = ["not an object"];
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("publications[0]")));
});

test("validateResumeConfig rejects malformed speaking entries", () => {
  const config = validConfig();
  config.speaking = [{ heading: "Fictional Conference Talks" }]; // missing organizations, dates
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("speaking[0].organizations")));
  assert.ok(errors.some((error) => error.includes("speaking[0].dates")));
});

test("validateResumeConfig rejects non-boolean includeEducation/includePublicationsSpeaking", () => {
  const config = validConfig();
  config.includeEducation = "yes";
  config.includePublicationsSpeaking = "no";
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("includeEducation")));
  assert.ok(errors.some((error) => error.includes("includePublicationsSpeaking")));
});

test("validateResumeConfig rejects a non-string subHeader", () => {
  const config = validConfig();
  config.experienceSections[0].jobs[0].subHeader = 42;
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((error) => error.includes("subHeader")));
});

test("validateResumeConfig requires a headline of at most 80 characters", () => {
  const missing = validConfig();
  delete missing.candidate.headline;
  assert.equal(validateResumeConfig(missing).valid, false);
  const long = validConfig();
  long.candidate.headline = "x".repeat(81);
  assert.equal(validateResumeConfig(long).valid, false);
});

test("validateResumeConfig rejects a summary over 120 words", () => {
  const config = validConfig();
  config.summary.text = Array(121).fill("word").join(" ");
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.startsWith("summary.text")));
});

test("validateResumeConfig limits bullets: 6 for the first job, 4 for later jobs", () => {
  const job = (count) => ({
    title: "Engineer",
    company: "Acme Corp",
    dates: "2020",
    bullets: Array.from({ length: count }, (_, i) => `Fictional bullet ${i}.`),
  });
  const ok = validConfig();
  ok.experienceSections[0].jobs = [job(6), job(4)];
  assert.equal(validateResumeConfig(ok).valid, true);

  const tooManyFirst = validConfig();
  tooManyFirst.experienceSections[0].jobs = [job(7)];
  assert.equal(validateResumeConfig(tooManyFirst).valid, false);

  const tooManyLater = validConfig();
  tooManyLater.experienceSections[0].jobs = [job(2), job(5)];
  assert.equal(validateResumeConfig(tooManyLater).valid, false);
});

test("validateResumeConfig rejects a ResumeProxyScore over 1000", () => {
  const config = validConfig();
  const bullet = Array(60).fill("word").join(" ");
  config.experienceSections[0].jobs = [0, 1, 2, 3, 4].map(() => ({
    title: "Engineer",
    company: "Acme Corp",
    dates: "2020",
    bullets: [bullet, bullet, bullet, bullet],
  }));
  const { valid, errors } = validateResumeConfig(config);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("ResumeProxyScore")));
});

test("the Northwind sample config passes validation", () => {
  const fs = require("fs");
  const path = require("path");
  const file = path.join(__dirname, "..", "..", "examples", "sample-candidate", "resume-configs", "northwind-tools-senior-pm.json");
  const { valid, errors } = validateResumeConfig(JSON.parse(fs.readFileSync(file, "utf8")));
  assert.deepEqual(errors, []);
  assert.equal(valid, true);
});
