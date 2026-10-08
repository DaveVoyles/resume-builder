"use strict";

// Saved real-page postings carry more than the job text: source and requisition
// lines, a saved-page note, pay and legal text, benefits, sub-headings. These
// tests use a fictional posting built the same way (docs/testing.md).

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { extractPostingKeywords, MAX_KEYWORDS } = require("../../src/core/posting-keywords");

const SNAPSHOT_POSTING = `# Lead Platform Engineer

Company: Northwind Systems (fictional)
Location: Hybrid, Springfield, Ohio, United States
Source: https://jobs.example.invalid/northwind/RC81
Retrieved: 2026-10-08
Posted: 2026-10-01
Requisition: RC81

> Saved on 2026-10-08 for illustration and testing. The wording belongs to the employer.

Job Information
- Job Identification
210763533
- Posting Date
07/20/2026, 09:52 AM
Job Description
As a Lead Platform Engineer within the Enterprise Technology – Infrastructure Platforms Data & Specialty Services Group, you will guide delivery of complex programs for the firm and its many clients every single day.
Responsibilities
Client Engagement
- Run release management and dependency management across teams
GenAI Solution Development
- Design human-in-the-loop controls for end-to-end delivery
Required qualifications
- 5+ years of experience with Python, Kubernetes and API gateway design
- Deep, hands-on experience with MuleSoft and OAuth 2.0 / OIDC
Preferred qualifications
- Experience of ServiceNOW or similar workflow technologies
#LI-Hybrid
The wage range for this role is $100,000 to $200,000.
What We Offer:
- Free lunch and Docker-flavoured snacks, Terraform stickers
Who We Are:
Northwind Systems (Nasdaq: NWS) is the infrastructure software company.
Equal Opportunity Employer, including Disability/Veterans
`;

const all = (result) => [...result.required, ...result.preferred];
const lower = (list) => list.map((keyword) => keyword.toLowerCase());

test("posting-keywords ignores metadata lines, saved-page notes, requisition tags and ids", () => {
  const found = lower(all(extractPostingKeywords(SNAPSHOT_POSTING)));
  for (const junk of ["rc81", "requisition", "source", "retrieved", "li-hybrid", "210763533", "am", "saved"]) {
    assert.ok(!found.includes(junk), `${junk} should not be a keyword: ${found.join(", ")}`);
  }
});

test("posting-keywords skips employer boilerplate (benefits, about us, pay, equal opportunity)", () => {
  const found = lower(all(extractPostingKeywords(SNAPSHOT_POSTING)));
  assert.ok(!found.includes("terraform"), `benefits text should be skipped: ${found.join(", ")}`);
  assert.ok(!found.includes("docker"), found.join(", "));
  assert.ok(!found.some((keyword) => /equal|opportunity|veterans|disability|nasdaq|wage|northwind/u.test(keyword)), found.join(", "));
});

test("posting-keywords skips sub-headings and organisation names in running prose", () => {
  const found = lower(all(extractPostingKeywords(SNAPSHOT_POSTING)));
  for (const junk of ["client engagement", "solution development", "enterprise technology", "specialty services group", "infrastructure platforms data"]) {
    assert.ok(!found.includes(junk), `${junk} should be skipped: ${found.join(", ")}`);
  }
});

test("posting-keywords keeps meaningful skills and splits required from preferred on a saved page", () => {
  const { required, preferred } = extractPostingKeywords(SNAPSHOT_POSTING);
  for (const skill of ["release management", "dependency management", "python", "kubernetes", "api gateway", "mulesoft", "oauth", "oidc"]) {
    assert.ok(lower(required).includes(skill), `${skill} should be required: ${required.join(", ")}`);
  }
  assert.ok(lower(preferred).includes("servicenow"), preferred.join(", "));
});

test("posting-keywords does not split hyphenated words like end-to-end or human-in-the-loop", () => {
  const found = all(extractPostingKeywords(SNAPSHOT_POSTING));
  assert.ok(found.every((keyword) => !/^-|-$/u.test(keyword)), found.join(", "));
});

test("posting-keywords over the cap drops plain phrases before known skills", () => {
  const filler = Array.from({ length: 40 }, (_, i) => `- Experience with plain thing number${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + ((i * 7) % 26))}`).join("\n");
  const { required } = extractPostingKeywords(`Requirements:\n${filler}\n- Kubernetes and Terraform\n`);
  assert.ok(required.length <= MAX_KEYWORDS);
  assert.ok(required.includes("Kubernetes") && required.includes("Terraform"), required.join(", "));
});
