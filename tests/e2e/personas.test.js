"use strict";

// Persona e2e scorecard + golden DOCX text (docs/testing.md).
// Regenerate goldens after an intended content/layout change:
//   UPDATE_GOLDEN=1 npm test
// Page-count checks need LibreOffice and run only via `npm run e2e`.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { parseConfirmations } = require("../../src/core/confirmations");
const { stableId } = require("../../src/core/ids");
const { matchKeyword } = require("../../src/core/keyword-match");
const { runPersona, listPersonas, assertSafeCommand, normalizeText, personaInputFiles, maxPagesFor } = require("../../scripts/e2e-persona");

const updateGolden = process.env.UPDATE_GOLDEN === "1";

test("there are at least three fictional personas", () => {
  assert.ok(listPersonas().length >= 3, listPersonas().join(", "));
});

for (const persona of listPersonas()) {
  test(`persona ${persona}: scorecard passes and rendered DOCX text matches golden`, async () => {
    const result = await runPersona(persona, { pages: false });
    const failures = result.checks.filter((check) => check.status === "fail");
    assert.deepEqual(failures, [], `failed checks: ${JSON.stringify(failures, null, 2)}`);

    assert.ok(result.outputs.length > 0, "persona rendered at least one resume");
    for (const output of result.outputs) {
      if (updateGolden) {
        fs.mkdirSync(path.dirname(output.goldenPath), { recursive: true });
        fs.writeFileSync(output.goldenPath, output.text);
        continue;
      }
      assert.ok(fs.existsSync(output.goldenPath), `missing golden ${path.relative(process.cwd(), output.goldenPath)}; run UPDATE_GOLDEN=1 npm test`);
      const golden = normalizeText(fs.readFileSync(output.goldenPath, "utf8"));
      assert.equal(output.text, golden, `${persona}/${output.id} DOCX text drifted from golden (UPDATE_GOLDEN=1 to regenerate)`);
    }
  });
}

test("a persona can point at input files elsewhere in the repo instead of copying them", () => {
  const ownerDir = path.join(__dirname, "..", "..", "examples", "personas", "owner");
  const expected = JSON.parse(fs.readFileSync(path.join(ownerDir, "expected.json"), "utf8"));
  const inputs = personaInputFiles(ownerDir, expected);
  assert.deepEqual(inputs.resumes.map((file) => path.relative(path.join(__dirname, "..", ".."), file)), ["examples/real-resume/owner/owner-resume.docx"]);
  assert.deepEqual(inputs.notes.map((file) => path.relative(path.join(__dirname, "..", ".."), file)), ["examples/personas/owner/inputs/notes/owner-confirmations.md"]);
  assert.ok(!fs.existsSync(path.join(ownerDir, "inputs", "resumes")), "the owner persona keeps no second copy of the resume");

  // Personas without "inputs" still read their own inputs/ folders.
  const jordanDir = path.join(__dirname, "..", "..", "examples", "personas", "jordan");
  const own = personaInputFiles(jordanDir, {});
  assert.ok(own.resumes.length > 0 && own.resumes.every((file) => file.startsWith(path.join(jordanDir, "inputs", "resumes"))));
  assert.ok(own.notes.length > 0);
});

test("persona inputs must exist and stay inside the repo", () => {
  const dir = path.join(__dirname, "..", "..", "examples", "personas", "owner");
  assert.throws(() => personaInputFiles(dir, { inputs: { resumes: ["../../real-resume/owner/nope.docx"] } }), /does not exist/u);
  assert.throws(() => personaInputFiles(dir, { inputs: { resumes: ["../../../../../etc/hosts"] } }), /outside the repo/u);
});

test("a posting's page limit defaults to 1 and only a positive whole number changes it", () => {
  assert.equal(maxPagesFor({}), 1);
  assert.equal(maxPagesFor({ maxPages: 2, maxPagesReason: "two jobs of leadership history" }), 2);
  assert.equal(maxPagesFor({ maxPages: 0 }), 1);
  assert.equal(maxPagesFor({ maxPages: "2" }), 1);
});

// The owner persona is built from a real resume, so its tailored resumes must not
// pick up skills the resume does not show (docs/testing.md; examples/personas/owner/JOBS.md).
// The nine keywords the owner confirmed on 2026-10-08 are checked in the next test instead.
test("owner persona: tailored resumes never name tools, platforms or credentials the resume lacks", () => {
  const ownerDir = path.join(__dirname, "..", "..", "examples", "personas", "owner");
  const resumeText = fs.readFileSync(path.join(__dirname, "..", "..", "examples", "real-resume", "owner", "owner-resume.txt"), "utf8").toLowerCase();
  const notOnResume = [
    "servicenow", "mulesoft", "apigee", "kong", "workato", "backstage", "oauth", "oidc", "usage-based billing", "rag pipeline",
    "claude", "gemini", "openai", "gpt", "onshore", "offshore", "computer science", "aws", "kubernetes", "terraform",
  ];
  for (const name of fs.readdirSync(path.join(ownerDir, "resume-configs"))) {
    const text = fs.readFileSync(path.join(ownerDir, "resume-configs", name), "utf8").toLowerCase();
    for (const term of notOnResume) {
      assert.ok(!resumeText.includes(term), `${term} is on the resume after all; update this list`);
      assert.ok(!new RegExp(`(?<![a-z])${term}(?![a-z])`, "u").test(text), `${name} claims "${term}", which the resume does not show`);
    }
    const addresses = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/giu) || [];
    assert.ok(addresses.every((address) => address === "email-removed@example.com"), `${name} has a real email address: ${addresses.join(", ")}`);
    assert.ok(!/\d{3}[\s.-]\d{3}[\s.-]\d{4}/u.test(text), `${name} has a phone number`);
    assert.match(text, /graduate coursework \(hiatus\)/u, `${name} keeps the MBA exactly as the resume has it`);
    assert.match(text, /bs — communication studies, business minor/u);
  }
});

test("owner persona: a changed figure in a tailored resume fails the scorecard", async () => {
  const result = await runPersona("owner", {
    pages: false,
    mutateConfig: (text) => text.replace("by 90%", "by 95%"),
  });
  assert.equal(result.ok, false);
  assert.ok(result.checks.some((check) => check.status === "fail" && /claim audit/u.test(JSON.stringify(check))));
});

test("e2e runner refuses apply, approve-apply, and --confirm-submit", () => {
  assert.throws(() => assertSafeCommand(["apply", "--dry-run"]), /never submit/);
  assert.throws(() => assertSafeCommand(["approve-apply", "--company", "X"]), /never submit/);
  assert.throws(() => assertSafeCommand(["tailor", "--confirm-submit"]), /--confirm-submit/);
  assert.doesNotThrow(() => assertSafeCommand(["validate", "--workspace", "x"]));
});

test("a broken claim makes the scorecard fail", async () => {
  const result = await runPersona("jordan", {
    pages: false,
    mutateConfig: (text) => text.replace("by 20%", "by 65%"),
  });
  assert.equal(result.ok, false);
  assert.ok(result.checks.some((check) => check.status === "fail" && /stage completed|claim audit/.test(check.check)));
});

test("an invented employer makes the scorecard fail", async () => {
  const result = await runPersona("jordan", {
    pages: false,
    mutateConfig: (text) => text.replace("Riverside Dental", "Globex Dynamics"),
  });
  assert.equal(result.ok, false);
  assert.ok(result.checks.some((check) => check.status === "fail" && /Employer not found/.test(JSON.stringify(check))));
});

test("a missing keyword makes the scorecard fail", async () => {
  const result = await runPersona("jordan", {
    pages: false,
    mutateConfig: (text) => text.replace(/scheduling|billing|checklist/giu, "xxxx"),
  });
  assert.equal(result.ok, false);
});

test("owner: a confirmed keyword on a summary or bullet cites the owner's confirmation note", () => {
  const ownerDir = path.join(__dirname, "..", "..", "examples", "personas", "owner");
  const noteId = stableId("ev", ["notes", "inputs/notes/owner-confirmations.md"]);
  const confirmed = parseConfirmations(fs.readFileSync(path.join(ownerDir, "inputs", "notes", "owner-confirmations.md"), "utf8"))
    .filter((item) => item.status === "confirmed")
    .map((item) => item.keyword);
  let uses = 0;
  for (const name of fs.readdirSync(path.join(ownerDir, "resume-configs"))) {
    const config = JSON.parse(fs.readFileSync(path.join(ownerDir, "resume-configs", name), "utf8"));
    const summaryHit = confirmed.filter((keyword) => matchKeyword(config.summary.text, keyword));
    if (summaryHit.length) {
      uses += summaryHit.length;
      assert.ok(config.summary.evidenceIds.includes(noteId), `${name}: the summary says ${summaryHit.join(", ")} without citing the confirmation note`);
    }
    for (const job of config.experienceSections.flatMap((section) => section.jobs)) {
      job.bullets.forEach((bullet, index) => {
        const hit = confirmed.filter((keyword) => matchKeyword(bullet, keyword));
        if (!hit.length) return;
        uses += hit.length;
        assert.ok((job.bulletEvidenceIds[index] || []).includes(noteId), `${name}: "${bullet.slice(0, 50)}..." says ${hit.join(", ")} without citing the confirmation note`);
        assert.ok((job.bulletEvidenceIds[index] || []).some((id) => id.startsWith("ev_resume-")), `${name}: "${bullet.slice(0, 50)}..." also cites the resume line it rewords`);
      });
    }
  }
  assert.ok(uses > 0, "the JPMC resume uses confirmed keywords");
});

test("owner: the confirmed keywords are recorded in the owner's words, and RAID, agile and ServiceNow never reach a resume", () => {
  const ownerDir = path.join(__dirname, "..", "..", "examples", "personas", "owner");
  const expected = JSON.parse(fs.readFileSync(path.join(ownerDir, "expected.json"), "utf8"));
  assert.deepEqual(expected.neverClaim, ["RAID", "agile", "ServiceNow"]);

  const note = fs.readFileSync(path.join(ownerDir, "inputs", "notes", "owner-confirmations.md"), "utf8");
  assert.ok(note.includes("Yes, add all nine; none of RAID, agile or ServiceNow"), "the owner's exact words are quoted");
  const answers = parseConfirmations(note);
  assert.deepEqual(
    answers.filter((item) => item.status === "confirmed").map((item) => item.keyword),
    ["leadership", "stakeholder management", "risk management", "dependency management", "release management", "change management", "product delivery", "deployment", "data analytics"],
  );
  assert.deepEqual(answers.filter((item) => item.status === "declined").map((item) => item.keyword), ["RAID", "agile", "ServiceNow"]);

  // Every quoted resume line is a real piece of the owner's resume, so the note adds no fact of its own.
  const squash = (text) => text.replace(/\s+/gu, " ").replace(/ ([);,.])/gu, "$1").replace(/\( /gu, "(").toLowerCase();
  const resume = squash(fs.readFileSync(path.join(__dirname, "..", "..", "examples", "real-resume", "owner", "owner-resume.txt"), "utf8"));
  for (const item of answers.filter((entry) => entry.status === "confirmed")) {
    for (const quote of item.quote.split(" | ")) {
      assert.ok(resume.includes(squash(quote)), `${item.keyword}: "${quote}" is not on the resume`);
    }
  }

  for (const posting of expected.postings) {
    const config = fs.readFileSync(path.join(ownerDir, posting.config), "utf8");
    for (const keyword of expected.neverClaim) {
      assert.ok(!matchKeyword(config, keyword), `${posting.id} must not contain ${keyword}`);
    }
  }
});
