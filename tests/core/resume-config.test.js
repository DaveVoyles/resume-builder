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
