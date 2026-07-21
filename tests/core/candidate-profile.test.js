"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  extractFacts,
  mergeProfileSource,
  createDefaultProfile,
  isPubliclyShareableLink,
} = require("../../src/core/candidate-profile");

// isPubliclyShareableLink -----------------------------------------------

test("isPubliclyShareableLink accepts a normal public URL", () => {
  assert.equal(isPubliclyShareableLink("https://github.com/sample-user/project-one"), true);
});

test("isPubliclyShareableLink accepts other common public domains", () => {
  assert.equal(isPubliclyShareableLink("https://www.linkedin.com/in/sample-user"), true);
  assert.equal(isPubliclyShareableLink("https://portfolio.example.invalid/my-work"), true);
  assert.equal(isPubliclyShareableLink("https://medium.com/@sample/article-title"), true);
});

test("isPubliclyShareableLink excludes a URL with a token query param", () => {
  assert.equal(isPubliclyShareableLink("https://example.com/reset?token=abc123"), false);
});

test("isPubliclyShareableLink excludes URLs with other auth-looking query params", () => {
  assert.equal(isPubliclyShareableLink("https://example.com/share?auth=xyz"), false);
  assert.equal(isPubliclyShareableLink("https://example.com/doc?key=secret"), false);
  assert.equal(isPubliclyShareableLink("https://example.com/app?session=abc"), false);
  assert.equal(isPubliclyShareableLink("https://example.com/webhook?sig=abc"), false);
  assert.equal(isPubliclyShareableLink("https://example.com/api?jwt=abc"), false);
  assert.equal(isPubliclyShareableLink("https://example.com/oauth?access_token=abc"), false);
});

test("isPubliclyShareableLink excludes a URL with an auth-looking fragment param", () => {
  assert.equal(isPubliclyShareableLink("https://example.com/callback#access_token=abc123"), false);
});

test("isPubliclyShareableLink does not over-block unrelated query params", () => {
  assert.equal(isPubliclyShareableLink("https://example.com/search?keyword=engineer"), true);
});

test("isPubliclyShareableLink excludes localhost URLs", () => {
  assert.equal(isPubliclyShareableLink("http://localhost:3000/dashboard"), false);
  assert.equal(isPubliclyShareableLink("http://sub.localhost/page"), false);
});

test("isPubliclyShareableLink excludes IP literal URLs", () => {
  assert.equal(isPubliclyShareableLink("http://192.168.1.10/admin"), false);
  assert.equal(isPubliclyShareableLink("http://10.0.0.5:8080/status"), false);
  assert.equal(isPubliclyShareableLink("http://[::1]/status"), false);
});

test("isPubliclyShareableLink excludes internal-looking hostnames", () => {
  assert.equal(isPubliclyShareableLink("https://wiki.internal.example.com/docs"), false);
  assert.equal(isPubliclyShareableLink("https://portal.corp.example.com/hr"), false);
  assert.equal(isPubliclyShareableLink("https://intranet.example.com/home"), false);
});

test("isPubliclyShareableLink excludes bare hostnames with no public-looking TLD", () => {
  assert.equal(isPubliclyShareableLink("http://intranet/home"), false);
});

test("isPubliclyShareableLink excludes unparseable URLs", () => {
  assert.equal(isPubliclyShareableLink("not-a-url"), false);
});

test("isPubliclyShareableLink does not over-block domains that merely contain an internal-looking substring", () => {
  assert.equal(isPubliclyShareableLink("https://mycorp.com/careers"), true);
  assert.equal(isPubliclyShareableLink("https://corpus.io/blog"), true);
  assert.equal(isPubliclyShareableLink("https://internalfeaturesinc.com/product"), true);
});

test("isPubliclyShareableLink excludes tokenized/one-time-use link shapes (OAuth code, nonce, otp, presigned signature)", () => {
  assert.equal(isPubliclyShareableLink("https://example.com/callback?code=abc123"), false);
  assert.equal(isPubliclyShareableLink("https://example.com/verify?otp=445566"), false);
  assert.equal(isPubliclyShareableLink("https://example.com/login?nonce=xyz"), false);
  assert.equal(
    isPubliclyShareableLink("https://bucket.s3.amazonaws.com/file.pdf?X-Amz-Signature=abc123"),
    false,
  );
});

test("isPubliclyShareableLink does not over-block query keys that merely contain a suspicious substring", () => {
  assert.equal(isPubliclyShareableLink("https://example.com/lookup?zipcode=19103"), true);
});

// extractFacts -------------------------------------------------------------

test("extractFacts extracts email and public links", () => {
  const facts = extractFacts("Contact me at person@example.com or visit https://github.com/person.");
  assert.equal(facts.email, "person@example.com");
  assert.deepEqual(facts.links, ["https://github.com/person"]);
});

test("extractFacts filters tokenized links out of the returned links", () => {
  const text = [
    "Public: https://github.com/person",
    "Reset link: https://example.com/reset?token=abc123",
  ].join("\n");
  const facts = extractFacts(text);
  assert.deepEqual(facts.links, ["https://github.com/person"]);
});

test("extractFacts filters internal/localhost links out of the returned links", () => {
  const text = [
    "Public: https://github.com/person",
    "Internal: http://localhost:4000/dashboard",
    "Internal: https://tools.internal.example.com/panel",
  ].join("\n");
  const facts = extractFacts(text);
  assert.deepEqual(facts.links, ["https://github.com/person"]);
});

test("extractFacts returns an empty links array when every link in the text is filtered out", () => {
  const text = [
    "Internal: http://localhost:4000/dashboard",
    "Internal: https://tools.internal.example.com/panel",
    "Tokenized: https://example.com/reset?token=abc123",
  ].join("\n");
  const facts = extractFacts(text);
  assert.deepEqual(facts.links, []);
});

test("extractFacts still detects known skill keywords", () => {
  const facts = extractFacts("Experienced with React, Python, and cloud infrastructure on Azure.");
  assert.ok(facts.skills.includes("React"));
  assert.ok(facts.skills.includes("Python"));
  assert.ok(facts.skills.includes("cloud"));
  assert.ok(facts.skills.includes("Azure"));
});

test("extractFacts returns empty facts for empty/undefined text", () => {
  assert.deepEqual(extractFacts(""), { email: "", links: [], skills: [] });
  assert.deepEqual(extractFacts(undefined), { email: "", links: [], skills: [] });
});

// mergeProfileSource ---------------------------------------------------------

test("mergeProfileSource only merges publicly shareable links into candidate.links", () => {
  const profile = createDefaultProfile();
  const text = [
    "Public: https://github.com/person",
    "Tokenized: https://example.com/invite?token=abc123",
    "Internal: http://localhost:4000/dashboard",
  ].join("\n");

  const merged = mergeProfileSource(profile, { kind: "notes" }, text);

  assert.deepEqual(merged.candidate.links, ["https://github.com/person"]);
});

test("mergeProfileSource keeps merging public links across multiple sources", () => {
  let profile = createDefaultProfile();
  profile = mergeProfileSource(profile, { kind: "resume" }, "https://github.com/person");
  profile = mergeProfileSource(profile, { kind: "links" }, "https://www.linkedin.com/in/person");
  profile = mergeProfileSource(profile, { kind: "notes" }, "https://internal.example.com/wiki");

  assert.deepEqual(profile.candidate.links, [
    "https://github.com/person",
    "https://www.linkedin.com/in/person",
  ]);
});
