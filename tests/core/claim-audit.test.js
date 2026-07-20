"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { extractClaims, auditResumeConfig, assessLedgerStrength, claimKey } = require("../../src/core/claim-audit");

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function resumeConfig(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Northwind Tools",
    candidate: { name: "Sample Candidate", contact: [{ text: "Remote, US" }] },
    summary: { text: "Fictional platform leader focused on developer experience." },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Platform Program Manager",
            company: "Contoso Labs",
            dates: "2022 - Present",
            bullets: ["Led launch coordination for an internal developer platform."],
          },
        ],
      },
    ],
    skills: [["Developer platforms", "Platform strategy, internal tooling"]],
    ...overrides,
  };
}

function sourceBackedEvidence(id, text, extra = {}) {
  return {
    id,
    type: "resume",
    fact: text,
    summary: `resume source ingested from inputs/resumes/${id}.md`,
    source: { kind: "resume", path: `inputs/resumes/${id}.md` },
    snippet: text,
    confidence: "source-text",
    createdAt: "2026-06-08T12:00:00.000Z",
    ...extra,
  };
}

function metadataOnlyEvidence(id, fact) {
  return {
    id,
    type: "notes",
    fact,
    summary: fact,
    source: { kind: "notes", path: `inputs/notes/${id}.md` },
    snippet: "",
    confidence: "metadata-only",
    createdAt: "2026-06-08T12:00:00.000Z",
  };
}

// A ledger with the minimum recommended number of source-backed entries, so
// tests that aren't specifically about thin-ledger messaging don't trip it.
function healthyLedger(extraFacts = []) {
  return [
    sourceBackedEvidence("ev-001", "Led launch coordination for an internal developer platform."),
    sourceBackedEvidence("ev-002", "Coordinated cross-functional rollout planning for platform adoption."),
    sourceBackedEvidence("ev-003", "Documented developer workflow experiments for internal tooling."),
    ...extraFacts.map((fact, i) => sourceBackedEvidence(`ev-extra-${i}`, fact)),
  ];
}

// ---------------------------------------------------------------------------
// extractClaims
// ---------------------------------------------------------------------------

describe("extractClaims", () => {
  test("finds a percentage claim", () => {
    const claims = extractClaims("Reduced page load time by 40%.");
    assert.equal(claims.length, 1);
    assert.equal(claims[0].category, "percentage");
    assert.equal(claims[0].value, "40");
  });

  test("finds a percentage claim spelled out as 'percent'", () => {
    const claims = extractClaims("Improved throughput by 25 percent.");
    assert.equal(claims.length, 1);
    assert.equal(claims[0].value, "25");
  });

  test("does not match 'percentile' as a percentage claim", () => {
    const claims = extractClaims("Scored in the 90th percentile internally.");
    assert.equal(claims.filter((c) => c.category === "percentage").length, 0);
  });

  test("finds a multiplier claim", () => {
    const claims = extractClaims("Grew adoption 3x within two quarters.");
    assert.equal(claims.length, 1);
    assert.equal(claims[0].category, "multiplier");
    assert.equal(claims[0].value, "3");
  });

  test("finds a money claim with a scale word", () => {
    const claims = extractClaims("Managed a $2.5 million annual budget.");
    assert.equal(claims.length, 1);
    assert.equal(claims[0].category, "money");
    assert.equal(claims[0].value, "2.5");
    assert.equal(claims[0].scale, "million");
  });

  test("finds a money claim with a K/M/B suffix", () => {
    const claims = extractClaims("Saved the team $150K annually.");
    assert.equal(claims.length, 1);
    assert.equal(claims[0].category, "money");
    assert.equal(claims[0].value, "150");
    assert.equal(claims[0].scale, "thousand");
  });

  test("finds a money claim with finance-style 'MM' shorthand", () => {
    const claims = extractClaims("Managed a $5MM budget.");
    assert.equal(claims.length, 1);
    assert.equal(claims[0].category, "money");
    assert.equal(claims[0].value, "5");
    assert.equal(claims[0].scale, "million");
  });

  test("finds a scaled-count claim without a dollar sign", () => {
    const claims = extractClaims("Reached 50 million users worldwide.");
    const scaled = claims.filter((c) => c.category === "scaled-count");
    assert.equal(scaled.length, 1);
    assert.equal(scaled[0].value, "50");
    assert.equal(scaled[0].scale, "million");
  });

  test("finds a scaled-count claim with a bare letter-shorthand scale (no dollar sign)", () => {
    const claims = extractClaims("Reached 50M users worldwide.");
    assert.equal(claims.length, 1);
    assert.equal(claims[0].category, "scaled-count");
    assert.equal(claims[0].value, "50");
    assert.equal(claims[0].scale, "million");
  });

  test("finds a counted-noun claim", () => {
    const claims = extractClaims("Supported 200 customers across the region.");
    assert.equal(claims.length, 1);
    assert.equal(claims[0].category, "counted-noun");
    assert.equal(claims[0].value, "200");
    assert.equal(claims[0].qualifier, "customers");
  });

  test("finds exactly one claim for 'team of N nouns' — the team-size match wins over the overlapping counted-noun match", () => {
    const claims = extractClaims("Led a team of 12 engineers.");
    assert.equal(claims.length, 1);
    assert.equal(claims[0].category, "team-size");
    assert.equal(claims[0].value, "12");
  });

  test("finds a years-of-experience claim", () => {
    const claims = extractClaims("Brings 8+ years of experience in platform engineering.");
    const yearsClaims = claims.filter((c) => c.category === "years-experience");
    assert.equal(yearsClaims.length, 1);
    assert.equal(yearsClaims[0].value, "8");
  });

  test("is case-insensitive for scale and unit words", () => {
    const claims = extractClaims("Brings 8 YEARS OF EXPERIENCE and managed a $2 MILLION budget.");
    assert.equal(claims.length, 2);
    const years = claims.find((c) => c.category === "years-experience");
    const money = claims.find((c) => c.category === "money");
    assert.equal(years.value, "8");
    assert.equal(money.scale, "million");
  });

  test("normalizes trailing-zero formatting so '40.0%' and '40%' produce the same claim key", () => {
    const withZero = extractClaims("Reduced errors by 40.0%.");
    const bare = extractClaims("Reduced errors by 40%.");
    assert.equal(withZero[0].value, bare[0].value);
    assert.equal(claimKey(withZero[0]), claimKey(bare[0]));
  });

  test("finds no claims in plain prose without numbers", () => {
    const claims = extractClaims("Led launch coordination for an internal developer platform.");
    assert.deepEqual(claims, []);
  });

  test("does not treat a bare year as a claim", () => {
    const claims = extractClaims("Joined the team in 2022 and grew steadily since.");
    assert.deepEqual(claims, []);
  });

  test("handles non-string input safely", () => {
    assert.deepEqual(extractClaims(undefined), []);
    assert.deepEqual(extractClaims(null), []);
    assert.deepEqual(extractClaims(42), []);
  });
});

// ---------------------------------------------------------------------------
// auditResumeConfig — fixture pairs (role config, evidence ledger)
// ---------------------------------------------------------------------------

describe("auditResumeConfig — supported-claim pass", () => {
  test("passes when a bullet's metric claim is backed by a matching evidence entry", () => {
    const config = resumeConfig({
      experienceSections: [
        {
          heading: "Experience",
          jobs: [
            {
              title: "Senior Platform Program Manager",
              company: "Contoso Labs",
              dates: "2022 - Present",
              bullets: ["Reduced onboarding time by 40% through workflow automation."],
            },
          ],
        },
      ],
    });
    const evidence = healthyLedger(["Reduced onboarding time by 40% through workflow automation, confirmed in Q3 review notes."]);

    const result = auditResumeConfig(config, evidence);
    assert.deepEqual(result.errors, []);
  });

  test("passes when a config makes no numeric claims at all", () => {
    const result = auditResumeConfig(resumeConfig(), healthyLedger());
    assert.deepEqual(result.errors, []);
  });

  test("passes when the bullet and evidence format the same figure with different trailing-zero precision", () => {
    const config = resumeConfig({
      experienceSections: [
        {
          heading: "Experience",
          jobs: [
            {
              title: "Senior Platform Program Manager",
              company: "Contoso Labs",
              dates: "2022 - Present",
              bullets: ["Reduced onboarding time by 40.0% through workflow automation."],
            },
          ],
        },
      ],
    });
    const evidence = healthyLedger(["Reduced onboarding time by 40% through workflow automation, confirmed in Q3 review notes."]);

    const result = auditResumeConfig(config, evidence);
    assert.deepEqual(result.errors, []);
  });

  test("matches a counted-noun claim regardless of the exact noun wording", () => {
    const config = resumeConfig({
      experienceSections: [
        {
          heading: "Experience",
          jobs: [
            {
              title: "Senior Platform Program Manager",
              company: "Contoso Labs",
              dates: "2022 - Present",
              bullets: ["Supported 200 customers across three regions."],
            },
          ],
        },
      ],
    });
    // Evidence phrases the same figure with a different (but still recognized) noun.
    const evidence = healthyLedger(["Directly supported 200 clients across three regions in FY25."]);

    const result = auditResumeConfig(config, evidence);
    assert.deepEqual(result.errors, []);
  });
});

describe("auditResumeConfig — unsupported-claim fail", () => {
  test("fails with a clear per-claim message when no evidence supports the figure", () => {
    const config = resumeConfig({
      experienceSections: [
        {
          heading: "Experience",
          jobs: [
            {
              title: "Senior Platform Program Manager",
              company: "Contoso Labs",
              dates: "2022 - Present",
              bullets: ["Increased throughput by 250% in six months."],
            },
          ],
        },
      ],
    });
    const evidence = healthyLedger();

    const result = auditResumeConfig(config, evidence);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /experienceSections\[0\]\.jobs\[0\]\.bullets\[0\]/);
    assert.match(result.errors[0], /250%/);
    assert.match(result.errors[0], /no evidence\.jsonl entry/i);
  });

  test("fails when the evidence figure exists but the scale differs ($2 vs $2 million)", () => {
    const config = resumeConfig({
      experienceSections: [
        {
          heading: "Experience",
          jobs: [
            {
              title: "Senior Platform Program Manager",
              company: "Contoso Labs",
              dates: "2022 - Present",
              bullets: ["Managed a $2 million vendor contract."],
            },
          ],
        },
      ],
    });
    const evidence = healthyLedger(["Reviewed a $2 vendor invoice line item."]);

    const result = auditResumeConfig(config, evidence);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /\$2 million/);
  });

  test("does not let metadata-only evidence support a claim", () => {
    const config = resumeConfig({
      experienceSections: [
        {
          heading: "Experience",
          jobs: [
            {
              title: "Senior Platform Program Manager",
              company: "Contoso Labs",
              dates: "2022 - Present",
              bullets: ["Cut deployment failures by 60% company-wide."],
            },
          ],
        },
      ],
    });
    const evidence = [
      ...healthyLedger(),
      metadataOnlyEvidence("ev-meta-001", "Cut deployment failures by 60% company-wide."),
    ];

    const result = auditResumeConfig(config, evidence);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /60%/);
  });

  test("flags a claim inside a skills value string", () => {
    const config = resumeConfig({
      skills: [["Impact", "Cut costs by 35% year over year"]],
    });
    const evidence = healthyLedger();

    const result = auditResumeConfig(config, evidence);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /skills\[0\]/);
    assert.match(result.errors[0], /35%/);
  });

  test("flags multiple unsupported claims independently", () => {
    const config = resumeConfig({
      experienceSections: [
        {
          heading: "Experience",
          jobs: [
            {
              title: "Senior Platform Program Manager",
              company: "Contoso Labs",
              dates: "2022 - Present",
              bullets: ["Grew revenue 10x.", "Led a team of 40 engineers."],
            },
          ],
        },
      ],
    });
    const evidence = healthyLedger();

    const result = auditResumeConfig(config, evidence);
    assert.equal(result.errors.length, 2);
  });
});

describe("auditResumeConfig — thin-ledger warning", () => {
  test("warns when the evidence ledger has fewer than the recommended source-backed entries", () => {
    const config = resumeConfig();
    const evidence = [sourceBackedEvidence("ev-001", "Led launch coordination for an internal developer platform.")];

    const result = auditResumeConfig(config, evidence);
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /thin/i);
    assert.match(result.warnings[0], /1 source-backed/i);
  });

  test("does not warn once the ledger reaches the recommended minimum", () => {
    const result = auditResumeConfig(resumeConfig(), healthyLedger());
    assert.equal(result.warnings.length, 0);
  });

  test("metadata-only entries do not count toward ledger strength", () => {
    const evidence = [
      metadataOnlyEvidence("ev-meta-001", "some fact"),
      metadataOnlyEvidence("ev-meta-002", "another fact"),
      metadataOnlyEvidence("ev-meta-003", "a third fact"),
    ];
    const result = assessLedgerStrength(evidence);
    assert.equal(result.thin, true);
    assert.equal(result.sourceBackedCount, 0);
  });
});
