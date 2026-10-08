"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { extractPostingKeywords, containsTerm, MAX_KEYWORDS } = require("../../src/core/posting-keywords");
const { validateRoles } = require("../../src/core/schemas");

const POSTING = `# Platform Engineer

Company: Example Corp (fictional)

Requirements:
- 5 years of experience with Python and Kubernetes.
- Strong product management instincts.

Nice to have:
- Familiarity with Terraform
- Prior work on developer experience

Responsibilities
- Run launch coordination across teams.
`;

test("posting-keywords splits required from preferred by heading", () => {
  const { required, preferred } = extractPostingKeywords(POSTING);
  assert.ok(required.includes("Python"));
  assert.ok(required.includes("Kubernetes"));
  assert.ok(required.includes("product management"));
  assert.ok(required.includes("launch coordination"));
  assert.ok(preferred.includes("Terraform"));
  assert.ok(preferred.includes("developer experience"));
  assert.ok(!required.includes("Terraform"));
});

test("posting-keywords treats inline 'bonus' / 'a plus' lines as preferred", () => {
  const { required, preferred } = extractPostingKeywords("Requirements:\n- Python\n- Bonus: Rust and Go experience\n- SQL is a plus\n");
  assert.ok(required.includes("Python"));
  assert.ok(preferred.map((k) => k.toLowerCase()).includes("sql"));
  assert.ok(!required.map((k) => k.toLowerCase()).includes("sql"));
});

test("posting-keywords dedupes case-insensitively, with required winning over preferred", () => {
  const { required, preferred } = extractPostingKeywords("Requirements:\n- Python, python and PYTHON\n\nNice to have:\n- Python\n");
  assert.equal(required.filter((k) => k.toLowerCase() === "python").length, 1);
  assert.equal(preferred.filter((k) => k.toLowerCase() === "python").length, 0);
});

test("posting-keywords caps the total and keeps required first", () => {
  const many = Array.from({ length: 60 }, (_, i) => `- Experience with Tool${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(97 + (i % 26))}${i}X`).join("\n");
  const { required, preferred } = extractPostingKeywords(`Requirements:\n${many}\n\nNice to have:\n- Terraform\n`);
  assert.ok(required.length + preferred.length <= MAX_KEYWORDS);
  assert.equal(required.length, MAX_KEYWORDS);
  assert.equal(preferred.length, 0);
});

test("posting-keywords is deterministic and tolerates empty input", () => {
  assert.deepEqual(extractPostingKeywords(POSTING), extractPostingKeywords(POSTING));
  assert.deepEqual(extractPostingKeywords(""), { required: [], preferred: [] });
  assert.deepEqual(extractPostingKeywords(undefined), { required: [], preferred: [] });
});

test("containsTerm uses word boundaries", () => {
  assert.equal(containsTerm("We use React daily", "React"), true);
  assert.equal(containsTerm("reactive systems", "React"), false);
  assert.equal(containsTerm("Node.js and C++", "Node.js"), true);
});

function role(posting) {
  return [{ id: "r1", title: "T", company: "C", status: "tracked", urls: {}, notes: [], followUpQuestions: [], posting }];
}

const goodPosting = { path: "postings/r1.md", fetchedAt: "2026-10-08T00:00:00.000Z", source: "file", keywords: { required: ["a"], preferred: [] } };

test("validateRoles accepts a role with no posting, display-only posting fields, or valid metadata", () => {
  assert.deepEqual(validateRoles(role(undefined), "roles"), []);
  assert.deepEqual(validateRoles(role({ location: "Remote" }), "roles"), []);
  assert.deepEqual(validateRoles(role(goodPosting), "roles"), []);
});

test("validateRoles rejects malformed posting metadata", () => {
  const cases = [
    [{ ...goodPosting, path: "" }, /posting\.path/],
    [{ ...goodPosting, path: "../secret.md" }, /posting\.path/],
    [{ ...goodPosting, path: "/etc/passwd" }, /posting\.path/],
    [{ ...goodPosting, fetchedAt: "yesterday" }, /fetchedAt/],
    [{ ...goodPosting, source: "scraped" }, /posting\.source/],
    [{ ...goodPosting, keywords: ["a"] }, /posting\.keywords/],
    [{ ...goodPosting, keywords: { required: "a", preferred: [] } }, /keywords\.required/],
    [{ ...goodPosting, keywords: { required: [], preferred: [1] } }, /keywords\.preferred/],
    ["text", /posting: must be an object/],
  ];
  for (const [posting, pattern] of cases) {
    const errors = validateRoles(role(posting), "roles");
    assert.ok(errors.some((e) => pattern.test(e)), `expected ${pattern} in ${JSON.stringify(errors)}`);
  }
});

// --- Noise filtering (fictional postings) -----------------------------------

const CLINIC_POSTING = `# Operations manager

Company: Harborview Family Health (fictional)
Location: Philadelphia, PA (on site)

Harborview Family Health runs three neighborhood clinics and needs an operations manager.

You will:
- Own staff scheduling and patient billing questions.
- Keep patient records in order.

You have:
- Office operations experience in a healthcare setting.
`;

function allOf(result) {
  return [...result.required, ...result.preferred];
}

test("posting-keywords drops the company name and its fragments", () => {
  const found = allOf(extractPostingKeywords(CLINIC_POSTING)).map((k) => k.toLowerCase());
  for (const noisy of ["family health", "harborview", "harborview family health", "family"]) {
    assert.ok(!found.includes(noisy), `${noisy} should be filtered: ${found.join(", ")}`);
  }
  assert.ok(found.includes("scheduling"));
});

test("posting-keywords uses the company option when the posting has no Company line", () => {
  const text = "# Analyst\n\nAcme Dynamics is hiring. You will use Snowflake and Acme Dynamics Portal daily.\n";
  const withOption = allOf(extractPostingKeywords(text, { company: "Acme Dynamics" })).map((k) => k.toLowerCase());
  assert.ok(!withOption.some((k) => k.includes("acme")), withOption.join(", "));
  assert.ok(withOption.includes("snowflake"));
});

test("posting-keywords strips filler words like setting and environment", () => {
  const found = allOf(extractPostingKeywords(CLINIC_POSTING)).map((k) => k.toLowerCase());
  assert.ok(!found.includes("healthcare setting"));
  assert.ok(found.includes("healthcare"));
  assert.ok(!allOf(extractPostingKeywords("# Role\n\nRequirements:\n- Experience in a fast-paced environment.\n")).some((k) => /environment/iu.test(k)));
});

test("posting-keywords drops location words, from the Location line and the option", () => {
  const text = "# Analyst\n\nCompany: Example Corp\nLocation: Raleigh, North Carolina, Remote\n\nRequirements:\n- Experience with SQL, based in Raleigh or remote United States.\n";
  const found = allOf(extractPostingKeywords(text, { location: "Raleigh, NC" })).map((k) => k.toLowerCase());
  for (const place of ["raleigh", "remote", "united states", "north carolina", "nc"]) assert.ok(!found.includes(place), `${place}: ${found.join(", ")}`);
  assert.ok(found.includes("sql"));
});

test("posting-keywords keeps a known skill when the company name is that one word", () => {
  const text = "# Engineer\n\nCompany: Docker\n\nRequirements:\n- Experience with Docker and Kubernetes.\n";
  const found = allOf(extractPostingKeywords(text));
  assert.ok(found.includes("Kubernetes"));
  assert.ok(found.includes("Docker"));
});

test("posting-keywords drops a longer phrase that restates a known term, and plurals", () => {
  const text = "# PM\n\nRequirements:\n- Own the developer platform roadmap and internal tooling priorities.\n- Experience with developer platforms.\n";
  const found = allOf(extractPostingKeywords(text));
  assert.ok(found.includes("developer platform"));
  assert.ok(found.includes("roadmap"));
  assert.ok(found.includes("internal tooling"));
  assert.ok(!found.includes("developer platform roadmap"));
  assert.ok(!found.includes("internal tooling priorities"));
  assert.ok(!found.includes("developer platforms"));
});

test("role-posting passes the role's company to extraction", () => {
  const { savePosting } = require("../../src/core/role-posting");
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kw-company-"));
  try {
    const role = { id: "zephyr-analyst", company: "Zephyr Analytics", title: "Analyst" };
    savePosting(dir, role, { text: "# Analyst\n\nRequirements:\n- Zephyr Analytics Portal and SQL experience.\n", source: "pasted" });
    const stored = allOf(role.posting.keywords).map((k) => k.toLowerCase());
    assert.ok(!stored.some((k) => k.includes("zephyr")), stored.join(", "));
    assert.ok(stored.includes("sql"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
