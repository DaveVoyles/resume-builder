"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { auditFacts, employersMatch, normalizeEmployer, parseDateRange } = require("../../src/core/fact-audit");

// Fictional fixtures only.

function entry(id, text, extra = {}) {
  return { id, type: "resume", fact: text, snippet: text, summary: `resume ${id}`, confidence: "source-text", source: { kind: "resume", path: `inputs/${id}.md` }, ...extra };
}

function profile(overrides = {}) {
  return {
    schemaVersion: "1.0",
    candidate: { id: "c", preferredName: "Sample Person", links: [] },
    skills: [{ name: "Kubernetes" }, "Python"],
    experience: [
      { id: "exp-1", organization: "Contoso Labs", title: "Senior Platform Program Manager", startDate: "2022-04", endDate: null, highlights: [] },
      { id: "exp-2", organization: "Fabrikam, Inc.", title: "Program Manager", startDate: "2018-06", endDate: "2022-03", highlights: [] },
    ],
    projects: [],
    education: [{ id: "edu-1", institution: "Example State University", degree: "B.S. Information Systems" }],
    sources: [],
    ...overrides,
  };
}

function job(overrides = {}) {
  return {
    title: "Senior Platform Program Manager",
    company: "Contoso Labs",
    dates: "2022 - Present",
    bullets: ["Coordinated launch readiness reviews for a developer platform."],
    ...overrides,
  };
}

function config({ jobs = [job()], summary = "Program manager for developer platforms.", education, skills = [["Platforms", "Python, Kubernetes"]], extra = {} } = {}) {
  return {
    company: "Target Co",
    candidate: { name: "Sample Person", headline: "Program manager", contact: [{ text: "x" }] },
    summary: { text: summary },
    experienceSections: [{ heading: "Experience", jobs }],
    skills,
    ...(education ? { education } : {}),
    ...extra,
  };
}

const evidence = [entry("ev-1", "Coordinated launch readiness reviews for a developer platform at Contoso Labs.")];

describe("employer matching", () => {
  test("normalizes case, punctuation, suffixes, and ampersands", () => {
    assert.equal(normalizeEmployer("Fabrikam, Inc."), "fabrikam");
    assert.ok(employersMatch("ACME & Sons LLC", "Acme and Sons"));
    assert.ok(employersMatch("contoso labs", "Contoso Labs Corp."));
    assert.ok(!employersMatch("Contoso Labs", "Northwind Traders"));
  });

  test("suffix and case differences still match the profile", () => {
    const result = auditFacts(config({ jobs: [job({ company: "CONTOSO LABS, LLC" })] }), profile(), evidence);
    assert.deepEqual(result.errors, []);
  });

  test("an employer that appears nowhere blocks", () => {
    const result = auditFacts(config({ jobs: [job({ company: "Globex Dynamics" })] }), profile(), evidence);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Employer not found/);
    assert.match(result.errors[0], /Globex Dynamics/);
    assert.match(result.errors[0], /experienceSections\[0\]\.jobs\[0\]/);
  });

  test("an employer found only in evidence is accepted", () => {
    const only = [entry("ev-9", "Worked at Globex Dynamics on an internal tool.")];
    const result = auditFacts(config({ jobs: [job({ company: "Globex Dynamics", title: "Engineer" })] }), profile({ experience: [] }), only);
    assert.deepEqual(result.errors, []);
  });
});

describe("titles", () => {
  test("an added seniority word blocks", () => {
    const result = auditFacts(config({ jobs: [job({ company: "Fabrikam", title: "Senior Program Manager", dates: "2018 - 2022" })] }), profile(), evidence);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Job title does not match/);
    assert.match(result.errors[0], /"senior"/);
  });

  test("Head of / Director / Lead added to the title blocks", () => {
    for (const title of ["Head of Platform Program Management", "Director, Program Management", "Lead Program Manager"]) {
      const result = auditFacts(config({ jobs: [job({ company: "Fabrikam", title, dates: "2018 - 2022" })] }), profile(), evidence);
      assert.ok(result.errors.some((error) => /Job title does not match/.test(error)), title);
    }
  });

  test("titleAliases allows a documented alternate title", () => {
    const p = profile();
    p.experience[1].titleAliases = ["Senior Program Manager"];
    const result = auditFacts(config({ jobs: [job({ company: "Fabrikam", title: "Senior Program Manager", dates: "2018 - 2022" })] }), p, evidence);
    assert.deepEqual(result.errors, []);
  });

  test("a title containing or contained by the profile title passes without added seniority", () => {
    const shorter = auditFacts(config({ jobs: [job({ title: "Platform Program Manager" })] }), profile(), evidence);
    assert.deepEqual(shorter.errors, []);
    const longer = auditFacts(config({ jobs: [job({ company: "Fabrikam", title: "Program Manager, Platforms", dates: "2018 - 2022" })] }), profile(), evidence);
    assert.deepEqual(longer.errors, []);
    const unrelated = auditFacts(config({ jobs: [job({ company: "Fabrikam", title: "Chief Marketing Officer", dates: "2018 - 2022" })] }), profile(), evidence);
    assert.ok(unrelated.errors.some((error) => /Job title does not match/.test(error)));
    const sr = auditFacts(config({ jobs: [job({ title: "Sr. Platform Program Manager" })] }), profile(), evidence);
    assert.deepEqual(sr.errors, []);
  });
});

describe("dates", () => {
  test("parses common formats", () => {
    assert.ok(parseDateRange("Jan 2020 – Mar 2022"));
    assert.ok(parseDateRange("2022 - Present").end.present);
    assert.equal(parseDateRange("not a date"), null);
  });

  test("a start earlier than the profile start blocks", () => {
    const result = auditFacts(config({ jobs: [job({ dates: "2020 - Present" })] }), profile(), evidence);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Start date does not match/);
  });

  test("an end later than the profile end blocks; within a month passes", () => {
    const late = auditFacts(config({ jobs: [job({ company: "Fabrikam", title: "Program Manager", dates: "Jun 2018 - Dec 2022" })] }), profile(), evidence);
    assert.ok(late.errors.some((error) => /End date does not match/.test(error)));
    const near = auditFacts(config({ jobs: [job({ company: "Fabrikam", title: "Program Manager", dates: "Jun 2018 - Apr 2022" })] }), profile(), evidence);
    assert.deepEqual(near.errors, []);
  });

  test("Present requires the profile end to be empty", () => {
    const result = auditFacts(config({ jobs: [job({ company: "Fabrikam", title: "Program Manager", dates: "2018 - Present" })] }), profile(), evidence);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /"Present"/);
  });

  test("year-only dates inside the profile range pass", () => {
    const result = auditFacts(config({ jobs: [job({ company: "Fabrikam", title: "Program Manager", dates: "2018 - 2022" })] }), profile(), evidence);
    assert.deepEqual(result.errors, []);
  });
});

describe("education", () => {
  test("matching institution passes; unknown institution blocks; wrong degree blocks", () => {
    const abbreviated = auditFacts(config({ education: [{ degree: "B.S. Information Systems", institution: "Example State Univ.", dates: "2014 - 2018" }] }), profile(), evidence);
    assert.ok(abbreviated.errors.some((error) => /Education not found/.test(error)), "abbreviated institution is not guessed");
    const exact = auditFacts(config({ education: [{ degree: "B.S. Information Systems", institution: "Example State University", dates: "2018" }] }), profile(), evidence);
    assert.deepEqual(exact.errors, []);
    const bad = auditFacts(config({ education: [{ degree: "Ph.D. Astrophysics", institution: "Example State University", dates: "2018" }] }), profile(), evidence);
    assert.ok(bad.errors.some((error) => /Degree does not match/.test(error)));
    const missing = auditFacts(config({ education: [{ degree: "MBA", institution: "Imaginary Business School", dates: "2020" }] }), profile(), evidence);
    assert.ok(missing.errors.some((error) => /Education not found/.test(error)));
  });
});

describe("scope verbs", () => {
  const scopeJob = (bullet, extra = {}) => job({ bullets: [bullet], ...extra });

  test("unbound 'led' with no organization evidence blocks, with a plain-language fix", () => {
    const result = auditFacts(config({ jobs: [scopeJob("Led a migration of the billing platform.")] }), profile(), [entry("ev-1", "Coordinated reviews at Contoso Labs.")]);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Unsupported scope claim/);
    assert.match(result.errors[0], /Ask the candidate whether they led this/);
    assert.match(result.errors[0], /soften to "contributed to"/);
  });

  test("evidence for the same organization containing the verb passes", () => {
    const result = auditFacts(config({ jobs: [scopeJob("Led a migration of the billing platform.")] }), profile(), [entry("ev-1", "Led the billing migration at Contoso Labs.")]);
    assert.deepEqual(result.errors, []);
  });

  test("bound evidence is checked, not the whole organization", () => {
    const ledger = [entry("ev-1", "Led the billing migration at Contoso Labs."), entry("ev-2", "Supported the billing migration at Contoso Labs.")];
    const bad = auditFacts(config({ jobs: [scopeJob("Led a migration of the billing platform.", { bulletEvidenceIds: [["ev-2"]] })] }), profile(), ledger);
    assert.equal(bad.errors.length, 1);
    assert.match(bad.errors[0], /ev-2/);
    const good = auditFacts(config({ jobs: [scopeJob("Led a migration of the billing platform.", { evidenceIds: ["ev-1"] })] }), profile(), ledger);
    assert.deepEqual(good.errors, []);
  });

  test("a matching profile highlight counts as a recorded claim", () => {
    const p = profile();
    p.experience[0].highlights = [{ text: "Owned the launch calendar." }];
    const result = auditFacts(config({ jobs: [scopeJob("Owned the launch calendar for three product lines.")] }), p, []);
    assert.deepEqual(result.errors, []);
  });

  test("other strong claims are caught: founded, architected, managed a team, sole, from scratch, director, head of", () => {
    const bullets = [
      "Founded the internal tools group.",
      "Architected the event pipeline.",
      "Managed a team of engineers.",
      "Sole maintainer of the release tooling.",
      "Built the portal from scratch.",
      "Worked as director of delivery for one program.",
      "Became head of release operations.",
    ];
    const result = auditFacts(config({ jobs: [job({ bullets })] }), profile(), []);
    assert.equal(result.errors.filter((error) => /Unsupported scope claim/.test(error)).length, bullets.length);
  });

  test("summary text is checked against the whole record", () => {
    const bad = auditFacts(config({ summary: "Founder and operator of developer tooling." }), profile(), evidence);
    assert.ok(bad.errors.some((error) => /summary\.text/.test(error)));
    const good = auditFacts(config({ summary: "Led platform launches." }), profile(), [entry("ev-1", "Led platform launches at Contoso Labs.")]);
    assert.deepEqual(good.errors, []);
  });

  test("ordinary wording does not trigger", () => {
    const result = auditFacts(config({ jobs: [scopeJob("Contributed to launch reviews and supported the rollout plan.")] }), profile(), evidence);
    assert.deepEqual(result.errors, []);
  });
});

describe("tools (advisory)", () => {
  test("a tool absent from profile and evidence warns without blocking", () => {
    const result = auditFacts(config({ jobs: [job({ bullets: ["Coordinated releases using Terraform and Jira."] })] }), profile(), evidence);
    assert.deepEqual(result.errors, []);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /"Terraform", "Jira"/);
    assert.match(result.warnings[0], /confirm with the candidate/);
  });

  test("tools found in profile skills or evidence do not warn; sentence-start words and stop words are ignored", () => {
    const ledger = [...evidence, entry("ev-2", "Shipped dashboards in Grafana for Contoso Labs.")];
    const result = auditFacts(config({ jobs: [job({ bullets: ["Used Python and Grafana to report on KPIs in the US.", "Kubernetes upgrades were scheduled monthly."] })] }), profile(), ledger);
    assert.deepEqual(result.warnings, []);
  });

  test("skills rows are checked too", () => {
    const result = auditFacts(config({ skills: [["Cloud", "AWS, Kubernetes"]] }), profile(), evidence);
    assert.ok(result.warnings.some((warning) => /skills\[0\]\.description/.test(warning) && /"AWS"/.test(warning)));
  });
});
