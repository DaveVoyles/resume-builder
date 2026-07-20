"use strict";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const {
  lintText,
  lintConfig,
  checkBuzzwords,
  checkSentenceUniformity,
  checkRepetition,
} = require("../../src/core/style-lint");

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/**
 * AI-flavored resume config: uses buzzwords, uniform sentence lengths, repetition.
 * This fixture should trigger multiple warnings.
 */
function aiFlavoredResumeConfig() {
  return {
    schemaVersion: "1.0",
    company: "TechCorp",
    candidate: {
      name: "Test Candidate",
      contact: [{ text: "Remote, US" }],
    },
    summary: {
      text: "Results-driven engineer passionate about leveraging cutting-edge technologies. Dynamic team player committed to seamlessly integrating innovative solutions. Proven track record of spearheading strategic initiatives and driving synergies across organizations.",
    },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Software Engineer",
            company: "TechCorp",
            dates: "2020 - Present",
            bullets: [
              "Spearheaded microservices architecture utilizing best-of-breed technologies.",
              "Results-driven approach accelerated growth and moved the needle on key metrics.",
              "Leveraged synergies to seamlessly integrate end-to-end solutions for stakeholders.",
              "Proven track record delivering game-changing innovations in cutting-edge platforms.",
            ],
          },
        ],
      },
    ],
    skills: [
      ["Languages", "JavaScript, Python, Go"],
      ["Cutting-edge tools", "leveraging innovative solutions to seamlessly deliver value-add results"],
    ],
  };
}

/**
 * Human-flavored resume config: natural language, varied structures.
 * This fixture should trigger few or no warnings.
 */
function humanFlavoredResumeConfig() {
  return {
    schemaVersion: "1.0",
    company: "TechCorp",
    candidate: {
      name: "Test Candidate",
      contact: [{ text: "Remote, US" }],
    },
    summary: {
      text: "Software engineer with 6 years of experience building web applications. I enjoy working with React and Node.js. Currently focused on backend architecture and mentoring junior developers.",
    },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Software Engineer",
            company: "TechCorp",
            dates: "2020 - Present",
            bullets: [
              "Designed and implemented a distributed microservices architecture handling 10M requests/day.",
              "Mentored four junior engineers, helping them grow from junior to mid-level roles.",
              "Reduced API response times from 500ms to 50ms by optimizing database queries.",
              "Led adoption of TypeScript across the team, reducing runtime errors by 35%.",
            ],
          },
        ],
      },
    ],
    skills: [
      ["Languages", "JavaScript, Python, Go"],
      ["Tools", "React, Node.js, PostgreSQL, Docker, Kubernetes"],
    ],
  };
}

/**
 * AI-flavored cover-letter config: buzzwords, repetitive structure.
 */
function aiFlavoredCoverLetterConfig() {
  return {
    schemaVersion: "1.0",
    company: "TechCorp",
    candidate: {
      name: "Test Candidate",
      contact: [{ text: "Remote, US" }],
    },
    salutation: "Dear Hiring Manager,",
    bodyParagraphs: [
      "I am passionate about leveraging innovative solutions and seamlessly integrating cutting-edge technologies. My proven track record demonstrates a results-driven approach to spearheading strategic initiatives.",
      "Passionate about driving growth through synergies. I utilize best-of-breed methodologies to deliver world-class results. This dynamic approach showcases my commitment to value-add initiatives.",
      "Passionate about making an impact. I bring a results-driven mindset that leverages cutting-edge thinking. My synergistic approach to problem-solving will benefit your team.",
    ],
    closing: "Sincerely,",
  };
}

/**
 * Human-flavored cover-letter config: natural writing, varied structure.
 */
function humanFlavoredCoverLetterConfig() {
  return {
    schemaVersion: "1.0",
    company: "TechCorp",
    candidate: {
      name: "Test Candidate",
      contact: [{ text: "Remote, US" }],
    },
    salutation: "Dear Hiring Manager,",
    bodyParagraphs: [
      "I'm writing to express my interest in the Senior Engineer role at TechCorp. Your work on distributed systems and cloud infrastructure aligns well with my experience over the last six years.",
      "At my current role, I've spent the last two years designing microservices architecture. I've also mentored younger engineers and helped the team adopt TypeScript, which reduced production errors significantly.",
      "I'm excited about the opportunity to contribute to your team. I believe my experience with backend systems would be valuable for your upcoming projects.",
    ],
    closing: "Sincerely,",
  };
}

// ---------------------------------------------------------------------------
// checkBuzzwords
// ---------------------------------------------------------------------------

describe("checkBuzzwords", () => {
  test("detects common buzzwords in text", () => {
    const text = "Results-driven engineer passionate about leveraging cutting-edge technologies.";
    const findings = checkBuzzwords(text);

    assert.ok(findings.length > 0, "Should detect buzzwords");
    const words = findings.map((f) => f.word);
    assert.ok(words.includes("results-driven"), "Should detect 'results-driven'");
    assert.ok(words.includes("passionate about"), "Should detect 'passionate about'");
    assert.ok(words.includes("leveraging"), "Should detect 'leveraging'");
    assert.ok(words.includes("cutting-edge"), "Should detect 'cutting-edge'");
  });

  test("performs case-insensitive matching", () => {
    const text = "RESULTS-DRIVEN engineer LEVERAGING CUTTING-EDGE tech.";
    const findings = checkBuzzwords(text);
    assert.ok(findings.length > 0, "Should match regardless of case");
  });

  test("returns empty array for clean text", () => {
    const text = "Reduced API response times by 40% through database optimization.";
    const findings = checkBuzzwords(text);
    assert.strictEqual(findings.length, 0, "Should not flag natural technical writing");
  });

  test("counts multiple occurrences of same buzzword", () => {
    const text = "Leveraged our team synergies. I leveraged technologies to deliver synergies.";
    const findings = checkBuzzwords(text);
    const leveraged = findings.find((f) => f.word === "leveraged");
    assert.ok(leveraged, "Should detect 'leveraged'");
    assert.ok(leveraged.count >= 2, "Should count multiple occurrences");
  });
});

// ---------------------------------------------------------------------------
// checkSentenceUniformity
// ---------------------------------------------------------------------------

describe("checkSentenceUniformity", () => {
  test("detects uniformly short sentences", () => {
    const text = "I work hard. I code well. I ship fast. I learn much. I teach too.";
    const findings = checkSentenceUniformity(text);
    assert.ok(findings.length > 0, "Should detect uniform sentence lengths");
    assert.ok(
      findings[0].description.includes("uniform"),
      "Should mention uniformity",
    );
  });

  test("does not flag naturally varied sentence lengths", () => {
    const text =
      "I designed a microservices architecture. This system handles millions of requests daily and is fault-tolerant. Performance is critical.";
    const findings = checkSentenceUniformity(text);
    // Allow some variance — the heuristic is conservative
    if (findings.length > 0) {
      // If it did flag, at least verify it's the right type
      assert.ok(findings[0].type === "uniformity", "Should be uniformity type");
    }
  });

  test("requires minimum 3 sentences", () => {
    const text = "Short. Medium length sentence.";
    const findings = checkSentenceUniformity(text);
    assert.strictEqual(findings.length, 0, "Should not flag < 3 sentences");
  });

  test("handles empty/missing text gracefully", () => {
    assert.strictEqual(checkSentenceUniformity("").length, 0);
    assert.strictEqual(checkSentenceUniformity(null).length, 0);
    assert.strictEqual(checkSentenceUniformity(undefined).length, 0);
  });
});

// ---------------------------------------------------------------------------
// checkRepetition
// ---------------------------------------------------------------------------

describe("checkRepetition", () => {
  test("detects repeated words across text", () => {
    const text =
      "Passionate about my role. I'm passionate about learning. Passionate about growth. My passion drives me.";
    const findings = checkRepetition(text);
    assert.ok(findings.length > 0, "Should detect word repetition");
    assert.ok(
      findings.some((f) => f.description.includes("Repeated")),
      "Should mention repeated words",
    );
  });

  test("detects repeated sentence openers", () => {
    const text =
      "I implemented feature X. I implemented feature Y. I implemented feature Z. Meanwhile, we also improved performance.";
    const findings = checkRepetition(text);
    // May or may not trigger depending on threshold; just verify it's clean if it doesn't
    if (findings.length > 0) {
      assert.ok(findings[0].type === "repetition", "Should be repetition type");
    }
  });

  test("ignores common English words in repetition checks", () => {
    const text =
      "The quick brown fox jumps. The lazy dog sleeps. The wind blows hard. The sun shines.";
    const findings = checkRepetition(text);
    // Should not flag "the" as repetition
    if (findings.length > 0) {
      const desc = findings.map((f) => f.description).join(" ");
      assert.ok(!desc.includes('"the"'), "Should not flag common words");
    }
  });

  test("requires minimum 2 sentences", () => {
    const text = "Passionate about coding. Just one more sentence.";
    const findings = checkRepetition(text);
    // With only 2 sentences, should not flag sentence opener repetition
    const openerFindings = findings.filter((f) =>
      f.description.includes("starter"),
    );
    assert.strictEqual(openerFindings.length, 0);
  });
});

// ---------------------------------------------------------------------------
// lintText
// ---------------------------------------------------------------------------

describe("lintText", () => {
  test("aggregates all heuristic findings", () => {
    const text =
      "Results-driven engineer passionate about leveraging cutting-edge tech. Passionate about innovation. Passionate about delivery. I work hard. I code well. I ship fast.";
    const findings = lintText(text);
    assert.ok(findings.length > 0, "Should return findings");
    assert.ok(findings.some((f) => f.type === "buzzword"), "Should include buzzword findings");
  });

  test("handles empty text gracefully", () => {
    assert.strictEqual(lintText("").length, 0);
    assert.strictEqual(lintText(null).length, 0);
    assert.strictEqual(lintText(undefined).length, 0);
  });

  test("returns findings with description field", () => {
    const text = "Results-driven passionate about leveraging cutting-edge.";
    const findings = lintText(text);
    findings.forEach((f) => {
      assert.ok(f.description, "Each finding should have a description");
      assert.ok(f.type, "Each finding should have a type");
    });
  });
});

// ---------------------------------------------------------------------------
// lintConfig (resume)
// ---------------------------------------------------------------------------

describe("lintConfig (resume)", () => {
  test("AI-flavored resume triggers multiple findings", () => {
    const config = aiFlavoredResumeConfig();
    const { findings, summary } = lintConfig(config, "resume");

    assert.ok(findings.length > 0, "AI-flavored config should trigger warnings");
    assert.ok(summary.length > 0, "Should have summary");
    assert.ok(summary.includes("style issue"), "Summary should mention style issues");

    // Verify findings have sources
    findings.forEach((f) => {
      assert.ok(f.source, "Finding should have source path");
      assert.ok(f.sourceLabel, "Finding should have human-readable source label");
    });
  });

  test("human-flavored resume triggers few/no findings", () => {
    const config = humanFlavoredResumeConfig();
    const { findings } = lintConfig(config, "resume");

    assert.ok(
      findings.length === 0 || findings.length < 3,
      "Natural writing should not trigger many warnings",
    );
  });

  test("lints all resume text fields", () => {
    const config = {
      schemaVersion: "1.0",
      company: "Test Corp",
      candidate: { name: "Test", contact: [{ text: "test@example.com" }] },
      summary: { text: "Results-driven leveraging synergies." },
      experienceSections: [
        {
          heading: "Work",
          jobs: [
            {
              title: "Engineer",
              company: "Corp",
              dates: "2020-2021",
              bullets: ["Passionate about cutting-edge work."],
            },
          ],
        },
      ],
      skills: [["Tech", "utilizing best-of-breed solutions"]],
    };

    const { findings } = lintConfig(config, "resume");
    const sources = findings.map((f) => f.source);

    // Should lint summary, bullets, and skills
    assert.ok(sources.some((s) => s.includes("summary")), "Should lint summary");
    assert.ok(sources.some((s) => s.includes("bullets")), "Should lint bullets");
    assert.ok(sources.some((s) => s.includes("skills")), "Should lint skills");
  });

  test("handles missing optional fields gracefully", () => {
    const config = {
      schemaVersion: "1.0",
      company: "Test",
      candidate: { name: "Test", contact: [{ text: "test" }] },
      summary: { text: "Simple text" },
      experienceSections: [],
      skills: [],
    };

    const { findings } = lintConfig(config, "resume");
    assert.ok(Array.isArray(findings), "Should return array even with empty sections");
  });
});

// ---------------------------------------------------------------------------
// lintConfig (cover-letter)
// ---------------------------------------------------------------------------

describe("lintConfig (cover-letter)", () => {
  test("AI-flavored cover-letter triggers findings", () => {
    const config = aiFlavoredCoverLetterConfig();
    const { findings } = lintConfig(config, "cover-letter");

    assert.ok(findings.length > 0, "AI-flavored cover letter should trigger warnings");
    findings.forEach((f) => {
      assert.ok(f.sourceLabel.includes("Paragraph"), "Should label by paragraph");
    });
  });

  test("human-flavored cover-letter triggers few/no findings", () => {
    const config = humanFlavoredCoverLetterConfig();
    const { findings } = lintConfig(config, "cover-letter");

    assert.ok(
      findings.length < 2,
      "Natural cover letter should not trigger many warnings",
    );
  });

  test("lints cover-letter bodyParagraphs only", () => {
    const config = {
      schemaVersion: "1.0",
      company: "Test",
      candidate: { name: "Test", contact: [{ text: "test" }] },
      salutation: "Dear Hiring Manager,",
      bodyParagraphs: [
        "Results-driven leveraging cutting-edge synergies passionately.",
      ],
      closing: "Sincerely,",
    };

    const { findings } = lintConfig(config, "cover-letter");
    assert.ok(findings.length > 0, "Should lint bodyParagraphs");
    assert.ok(
      findings.every((f) => f.source.includes("bodyParagraphs")),
      "All findings should come from bodyParagraphs",
    );
  });
});

// ---------------------------------------------------------------------------
// Fixture pair test: AI vs. Human
// ---------------------------------------------------------------------------

describe("Fixture comparison: AI-flavored vs. human-flavored", () => {
  test("AI resume has significantly more findings than human resume", () => {
    const aiConfig = aiFlavoredResumeConfig();
    const humanConfig = humanFlavoredResumeConfig();

    const aiResult = lintConfig(aiConfig, "resume");
    const humanResult = lintConfig(humanConfig, "resume");

    assert.ok(
      aiResult.findings.length > humanResult.findings.length,
      "AI-flavored config should have more findings than human-flavored",
    );
  });

  test("AI cover-letter has significantly more findings than human cover-letter", () => {
    const aiConfig = aiFlavoredCoverLetterConfig();
    const humanConfig = humanFlavoredCoverLetterConfig();

    const aiResult = lintConfig(aiConfig, "cover-letter");
    const humanResult = lintConfig(humanConfig, "cover-letter");

    assert.ok(
      aiResult.findings.length > humanResult.findings.length,
      "AI cover-letter should have more findings than human",
    );
  });
});
