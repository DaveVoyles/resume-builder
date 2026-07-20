"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { scoreKeywordCoverage } = require("../../src/core/keyword-coverage");

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function resumeConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Acme Corp",
    candidate: { name: "Test Candidate", contact: [{ text: "Remote, US" }] },
    summary: { text: "Experienced platform engineer with 5 years of Node.js and React expertise." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Software Engineer",
            company: "Tech Company",
            dates: "2020 - Present",
            bullets: [
              "Architected microservices using Node.js and TypeScript.",
              "Built REST APIs and GraphQL endpoints for mobile and web clients.",
              "Mentored junior developers on JavaScript best practices.",
            ],
          },
          {
            title: "Full Stack Developer",
            company: "Previous Corp",
            dates: "2018 - 2020",
            bullets: [
              "Developed React components for dashboard interfaces.",
              "Implemented Python automation scripts for CI/CD pipelines.",
            ],
          },
        ],
      },
    ],
    skills: [
      ["Languages", "JavaScript, Python, TypeScript, Go"],
      ["Frontend", "React, Vue.js, HTML, CSS"],
      ["Backend", "Node.js, Express, Django, PostgreSQL"],
      ["Tools", "Docker, Kubernetes, AWS, Git"],
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// scoreKeywordCoverage
// ---------------------------------------------------------------------------

describe("scoreKeywordCoverage", () => {
  describe("full match cases", () => {
    test("finds all keywords when they exist in the resume", () => {
      const config = resumeConfig();
      const keywords = ["React", "Node.js", "TypeScript", "GraphQL"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 100);
      assert.deepEqual(result.present, keywords);
      assert.deepEqual(result.missing, []);
    });

    test("performs case-insensitive matching", () => {
      const config = resumeConfig();
      const keywords = ["react", "NODE.JS", "typescript"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 100);
      assert.deepEqual(result.present, keywords);
      assert.deepEqual(result.missing, []);
    });

    test("matches keywords from summary field", () => {
      const config = resumeConfig();
      const keywords = ["platform engineer", "Node.js"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 100);
      assert.deepEqual(result.present, keywords);
      assert.deepEqual(result.missing, []);
    });

    test("matches keywords from experience bullets", () => {
      const config = resumeConfig();
      const keywords = ["microservices", "GraphQL endpoints", "REST APIs"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 100);
      assert.deepEqual(result.present, keywords);
      assert.deepEqual(result.missing, []);
    });

    test("matches keywords from skills field", () => {
      const config = resumeConfig();
      const keywords = ["Docker", "Kubernetes", "PostgreSQL"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 100);
      assert.deepEqual(result.present, keywords);
      assert.deepEqual(result.missing, []);
    });
  });

  describe("partial match cases", () => {
    test("returns correct percentage for partial matches", () => {
      const config = resumeConfig();
      const keywords = ["React", "Vue.js", "Perl", "Scala"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 50);
      assert.deepEqual(result.present, ["React", "Vue.js"]);
      assert.deepEqual(result.missing, ["Perl", "Scala"]);
    });

    test("handles mixed case keywords in partial matches", () => {
      const config = resumeConfig();
      const keywords = ["react", "EXPRESS", "rust", "golang"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 50);
      assert.deepEqual(result.present, ["react", "EXPRESS"]);
      assert.deepEqual(result.missing, ["rust", "golang"]);
    });

    test("correctly scores 25% coverage", () => {
      const config = resumeConfig();
      const keywords = ["Node.js", "Rust", "Haskell", "Clojure"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 25);
      assert.deepEqual(result.present, ["Node.js"]);
      assert.deepEqual(result.missing, ["Rust", "Haskell", "Clojure"]);
    });

    test("correctly scores 75% coverage", () => {
      const config = resumeConfig();
      const keywords = ["React", "Python", "TypeScript", "Elixir"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 75);
      assert.deepEqual(result.present, ["React", "Python", "TypeScript"]);
      assert.deepEqual(result.missing, ["Elixir"]);
    });
  });

  describe("zero-match cases", () => {
    test("returns 0% when no keywords are found", () => {
      const config = resumeConfig();
      const keywords = ["Fortran", "Cobol", "Rust", "Haskell"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 0);
      assert.deepEqual(result.present, []);
      assert.deepEqual(result.missing, keywords);
    });

    test("handles empty keywords array", () => {
      const config = resumeConfig();
      const result = scoreKeywordCoverage([], config);

      assert.equal(result.percent, 0);
      assert.deepEqual(result.present, []);
      assert.deepEqual(result.missing, []);
    });

    test("handles null/undefined resume config", () => {
      const result = scoreKeywordCoverage(["React", "Node.js"], null);

      assert.equal(result.percent, 0);
      assert.deepEqual(result.present, []);
      assert.deepEqual(result.missing, ["React", "Node.js"]);
    });

    test("handles null/undefined keywords without throwing", () => {
      const config = { summary: { text: "React developer" } };

      const nullResult = scoreKeywordCoverage(null, config);
      assert.equal(nullResult.percent, 0);
      assert.deepEqual(nullResult.present, []);
      assert.deepEqual(nullResult.missing, []);

      const undefinedResult = scoreKeywordCoverage(undefined, config);
      assert.equal(undefinedResult.percent, 0);
      assert.deepEqual(undefinedResult.present, []);
      assert.deepEqual(undefinedResult.missing, []);
    });

    test("filters out empty strings in keywords array from percentage calculation", () => {
      const config = resumeConfig();
      const result = scoreKeywordCoverage(["React", "", "Node.js"], config);

      // With 2 non-empty keywords both present, should be 100%
      assert.equal(result.percent, 100);
      assert.deepEqual(result.present, ["React", "Node.js"]);
      assert.deepEqual(result.missing, []);
    });
  });

  describe("edge cases", () => {
    test("uses exact substring matching, not word boundaries", () => {
      const config = resumeConfig();
      // "Script" should match within "TypeScript"
      const keywords = ["Script"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 100);
      assert.deepEqual(result.present, ["Script"]);
    });

    test("handles keywords with special characters", () => {
      const config = resumeConfig();
      const keywords = ["Node.js", "Vue.js", "C++"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 67); // 2 out of 3
      assert.deepEqual(result.present, ["Node.js", "Vue.js"]);
      assert.deepEqual(result.missing, ["C++"]);
    });

    test("handles config with missing optional fields", () => {
      const config = {
        company: "Test",
        candidate: { name: "Test", contact: [{ text: "Test" }] },
        summary: { text: "Node.js developer" },
        experienceSections: [],
        skills: [],
      };
      const keywords = ["Node.js", "React"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 50);
      assert.deepEqual(result.present, ["Node.js"]);
      assert.deepEqual(result.missing, ["React"]);
    });

    test("ignores empty experience sections and jobs", () => {
      const config = {
        company: "Test",
        candidate: { name: "Test", contact: [{ text: "Test" }] },
        summary: { text: "React expert" },
        experienceSections: [
          {
            heading: "Experience",
            jobs: [
              {
                title: "Test",
                company: "Test",
                dates: "2020",
                bullets: [],
              },
            ],
          },
        ],
        skills: [],
      };
      const keywords = ["React"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 100);
      assert.deepEqual(result.present, ["React"]);
    });

    test("ignores skills with missing second element", () => {
      const config = {
        company: "Test",
        candidate: { name: "Test", contact: [{ text: "Test" }] },
        summary: { text: "JavaScript developer" },
        experienceSections: [],
        skills: [
          ["Languages", "JavaScript, Python"],
          ["Frontend"], // Missing second element
        ],
      };
      const keywords = ["JavaScript"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 100);
      assert.deepEqual(result.present, ["JavaScript"]);
    });

    test("handles whitespace in keywords correctly", () => {
      const config = resumeConfig();
      const keywords = ["REST APIs", "GraphQL endpoints"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 100);
      assert.deepEqual(result.present, keywords);
    });

    test("rounds percentage correctly", () => {
      const config = resumeConfig();
      // 1 out of 3 = 33.333... should round to 33
      const keywords = ["React", "Fortran", "Cobol"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 33);
      assert.deepEqual(result.present, ["React"]);
      assert.deepEqual(result.missing, ["Fortran", "Cobol"]);
    });

    test("rounds percentage with .5 correctly (banker's rounding)", () => {
      const config = resumeConfig();
      // 1 out of 2 = 50.0
      const keywords = ["React", "Fortran"];
      const result = scoreKeywordCoverage(keywords, config);

      assert.equal(result.percent, 50);
      assert.deepEqual(result.present, ["React"]);
      assert.deepEqual(result.missing, ["Fortran"]);
    });
  });
});
