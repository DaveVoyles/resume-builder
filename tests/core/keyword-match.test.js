"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { matchKeyword, termVariants } = require("../../src/core/keyword-match");

describe("matchKeyword word boundaries", () => {
  test("Java does not match JavaScript, but does match Java", () => {
    assert.equal(matchKeyword("Built apps in JavaScript and TypeScript.", "Java"), null);
    assert.equal(matchKeyword("Built services in Java and Go.", "Java"), "Java");
  });

  test("is case-insensitive for normal terms and allows a plural", () => {
    assert.ok(matchKeyword("Ran weekly WORKFLOWS reviews", "workflow"));
    assert.ok(matchKeyword("Used react daily", "React"));
    assert.equal(matchKeyword("They reacted quickly", "React"), null);
  });

  test("C does not match C++, C#, or Chicago; C++ and C# match themselves", () => {
    assert.equal(matchKeyword("Wrote C++ and C# services in Chicago.", "C"), null);
    assert.ok(matchKeyword("Wrote C++ services.", "C++"));
    assert.ok(matchKeyword("Wrote C# services.", "C#"));
    assert.ok(matchKeyword("Languages: C, Go", "C"));
    assert.equal(matchKeyword("Wrote C# services.", "C++"), null);
  });

  test("Node.js matches with trailing punctuation and not inside other words", () => {
    assert.ok(matchKeyword("Stack: Node.js.", "Node.js"));
    assert.ok(matchKeyword("Stack: (Node.js), React", "Node.js"));
    assert.equal(matchKeyword("Used Nodes for storage", "Node.js"), null);
  });

  test("terms with slashes and hyphens match literally", () => {
    assert.ok(matchKeyword("Owned CI/CD pipelines", "CI/CD"));
    assert.ok(matchKeyword("Shipped AI-assisted tooling", "AI-assisted"));
    assert.equal(matchKeyword("Owned CI pipelines", "CI/CD"), null);
  });

  test("multi-word terms tolerate extra whitespace", () => {
    assert.ok(matchKeyword("Led  developer\nplatform launches", "developer platform"));
  });
});

describe("matchKeyword aliases", () => {
  test("aliases apply in both directions", () => {
    assert.equal(matchKeyword("Ran Kubernetes clusters", "K8s"), "Kubernetes");
    assert.equal(matchKeyword("Ran K8s clusters", "Kubernetes"), "K8s");
    assert.ok(matchKeyword("Tuned Postgres queries", "PostgreSQL"));
    assert.ok(matchKeyword("Tuned PostgreSQL queries", "Postgres"));
    assert.ok(matchKeyword("Wrote JS tooling", "JavaScript"));
    assert.ok(matchKeyword("Shipped continuous integration", "CI/CD"));
    assert.ok(matchKeyword("Built machine learning models", "ML"));
    assert.ok(matchKeyword("Led product management for the platform", "PM"));
    assert.ok(matchKeyword("Wrote NodeJS tooling", "Node.js"));
  });

  test("two-letter acronyms are case-exact so pm and js inside other text do not match", () => {
    assert.equal(matchKeyword("Meetings at 5 pm", "PM"), null);
    assert.equal(matchKeyword("Built with Node.js", "JS"), null);
    assert.ok(matchKeyword("Built with JS", "JS"));
  });

  test("termVariants lists the keyword first and dedupes", () => {
    const variants = termVariants("K8s");
    assert.equal(variants[0], "K8s");
    assert.ok(variants.includes("Kubernetes"));
    assert.equal(new Set(variants.map((v) => v.toLowerCase())).size, variants.length);
    assert.deepEqual(termVariants("Cobol"), ["Cobol"]);
  });
});
