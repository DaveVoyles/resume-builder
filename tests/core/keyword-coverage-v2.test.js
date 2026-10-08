"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  UNSUPPORTED_NOTE,
  buildCoverageRecord,
  classifyMissingKeywords,
  scoreKeywordCoverage,
} = require("../../src/core/keyword-coverage");

function resumeConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Acme Corp",
    candidate: { name: "Test Candidate", contact: [{ text: "Remote, US" }] },
    summary: { text: "Platform engineer with 5 years of Node.js and React expertise." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Software Engineer",
            company: "Tech Company",
            dates: "2020 - Present",
            bullets: ["Architected microservices using Node.js.", "Built REST APIs and GraphQL endpoints for web clients."],
          },
          {
            title: "Full Stack Developer",
            company: "Previous Corp",
            dates: "2018 - 2020",
            bullets: ["Developed React components for dashboards."],
          },
        ],
      },
    ],
    skills: [
      ["Languages", "JavaScript, Python"],
      ["Frontend", "React, HTML"],
      ["Tools", "Docker, Kubernetes, Postgres"],
    ],
    ...overrides,
  };
}

describe("scoreKeywordCoverage with boundaries, aliases, weights, and locations", () => {
  test("does not match Java inside JavaScript or a partial word", () => {
    const result = scoreKeywordCoverage(["Java", "Script", "React"], resumeConfig());
    assert.deepEqual(result.present, ["React"]);
    assert.deepEqual(result.missing, ["Java", "Script"]);
  });

  test("handles C++ and Node.js terms", () => {
    const config = resumeConfig({ summary: { text: "Wrote C++ and Node.js services." } });
    const result = scoreKeywordCoverage(["C++", "C", "Node.js"], config);
    assert.deepEqual(result.present, ["C++", "Node.js"]);
    assert.deepEqual(result.missing, ["C"]);
  });

  test("matches aliases both ways and reports what matched", () => {
    const result = scoreKeywordCoverage(["K8s", "PostgreSQL"], resumeConfig());
    assert.deepEqual(result.present, ["K8s", "PostgreSQL"]);
    assert.equal(result.details.find((item) => item.keyword === "K8s").matchedAs, "Kubernetes");
  });

  test("reports where each keyword is covered", () => {
    const result = scoreKeywordCoverage(["React", "GraphQL", "Docker", "Fortran", "Node.js"], resumeConfig());
    const where = (keyword) => result.details.find((item) => item.keyword === keyword).locations;
    assert.deepEqual(where("GraphQL"), ["bullet 2 of Senior Software Engineer at Tech Company"]);
    assert.deepEqual(where("React"), ["summary", "bullet 1 of Full Stack Developer at Previous Corp", "skills: Frontend"]);
    assert.deepEqual(where("Docker"), ["skills: Tools"]);
    assert.deepEqual(where("Fortran"), []);
    assert.equal(where("Node.js")[0], "summary");
  });

  test("weights required keywords 2x and preferred 1x, alongside the plain percent", () => {
    const config = resumeConfig();
    const even = scoreKeywordCoverage({ required: ["React", "Fortran"], preferred: ["Docker", "Cobol"] }, config);
    assert.equal(even.percent, 50);
    assert.equal(even.weightedScore, 50); // found weight 2+1 of 6
    const requiredFound = scoreKeywordCoverage({ required: ["React", "Docker"], preferred: ["Cobol", "Fortran"] }, config);
    assert.equal(requiredFound.percent, 50);
    assert.equal(requiredFound.weightedScore, 67); // 4 of 6
    assert.equal(requiredFound.details.find((item) => item.keyword === "Cobol").importance, "preferred");
  });

  test("a keyword listed as required and preferred counts once, as required", () => {
    const result = scoreKeywordCoverage({ required: ["React"], preferred: ["react", "Docker"] }, resumeConfig());
    assert.equal(result.details.length, 2);
    assert.equal(result.details[0].importance, "required");
  });

  test("a plain list weighs every keyword the same", () => {
    const result = scoreKeywordCoverage(["React", "Fortran"], resumeConfig());
    assert.equal(result.weightedScore, result.percent);
  });
});

describe("classifyMissingKeywords", () => {
  const evidence = [
    { id: "ev-1", type: "resume", fact: "Ran Terraform modules for the platform.", snippet: "Ran Terraform modules for the platform.", confidence: "source-text" },
    { id: "ev-2", type: "resume", fact: "Used Snowflake once.", snippet: "Used Snowflake once.", confidence: "source-text", status: "rejected" },
    { id: "ev-3", type: "resume", fact: "Mentions Looker only as metadata.", snippet: "", confidence: "metadata-only" },
    { id: "ev-4", type: "job-posting", fact: "Wants Tableau.", snippet: "Wants Tableau.", confidence: "source-text" },
  ];
  const profile = {
    skills: ["Python"],
    experience: [{ id: "exp-1", organization: "Acme", title: "Analyst", highlights: [{ text: "Built SQL reports.", evidenceIds: ["ev-9"] }] }],
  };

  test("splits supported (in evidence or profile) from unsupported", () => {
    const result = classifyMissingKeywords(["Terraform", "SQL", "Python", "Snowflake", "Looker", "Tableau", "Kafka"], { profile, evidence });
    const by = Object.fromEntries(result.map((item) => [item.keyword, item]));
    assert.equal(by.Terraform.supported, true);
    assert.deepEqual(by.Terraform.evidenceIds, ["ev-1"]);
    assert.equal(by.SQL.supported, true);
    assert.equal(by.SQL.inProfile, true);
    assert.equal(by.Python.supported, true);
    for (const keyword of ["Snowflake", "Looker", "Tableau", "Kafka"]) {
      assert.equal(by[keyword].supported, false, `${keyword} must not be suggested`);
      assert.equal(by[keyword].note, UNSUPPORTED_NOTE);
    }
  });

  test("evidence ids inside the profile do not count as profile text", () => {
    assert.equal(classifyMissingKeywords(["ev-9"], { profile, evidence: [] })[0].supported, false);
  });

  test("buildCoverageRecord keeps score, covered, missing and checkedAt", () => {
    const scored = scoreKeywordCoverage({ required: ["React", "Terraform"], preferred: ["Kafka"] }, resumeConfig());
    const support = classifyMissingKeywords(scored.missing, { profile: {}, evidence });
    const record = buildCoverageRecord(scored, support, { checkedAt: "2026-01-02T00:00:00.000Z", source: "test" });
    assert.equal(record.score, scored.weightedScore);
    assert.equal(record.checkedAt, "2026-01-02T00:00:00.000Z");
    assert.equal(record.covered[0].keyword, "React");
    assert.ok(record.covered[0].locations.length > 0);
    const terraform = record.missing.find((item) => item.keyword === "Terraform");
    assert.equal(terraform.supported, true);
    assert.deepEqual(terraform.evidenceIds, ["ev-1"]);
    assert.equal(record.missing.find((item) => item.keyword === "Kafka").supported, false);
    assert.equal(record.source, "test");
  });
});
