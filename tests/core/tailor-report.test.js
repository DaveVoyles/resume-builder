"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { analyzeTailorReport, buildTailorReport, reportRelativePath, STATUS } = require("../../src/core/tailor-report");
const { validateRoles } = require("../../src/core/schemas");
const { buildTailorReportHtml, buildTailorReportModel } = require("../../src/core/tailor-report");

// Fictional data only.
const GENERATED_AT = "2026-10-08T12:00:00.000Z";

function config(overrides = {}) {
  return {
    schemaVersion: "1.0",
    company: "Fabrikam AI",
    candidate: { name: "Sample Candidate", headline: "Fictional product manager", contact: [{ text: "Remote, US" }] },
    summary: { text: "Fictional product leader focused on developer platforms." },
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

function role(resume = {}) {
  return {
    id: "fabrikam-ai-developer-platform-pm",
    company: "Fabrikam AI",
    title: "Developer platform product manager",
    status: "tracked",
    urls: {},
    notes: [],
    followUpQuestions: [],
    resume: {
      configPath: "resume-configs/fabrikam-ai.json",
      outputPath: "outputs/resumes/Fabrikam AI/sample-candidate-fabrikam-ai.docx",
      ...resume,
    },
  };
}

const clean = { errors: [], warnings: [], claimsFound: [{ text: "40%" }, { text: "3 teams" }] };
const cleanFacts = { errors: [], warnings: [] };
const noStyle = { findings: [] };

function build(extra = {}) {
  return buildTailorReport({
    role: role(),
    config: config(),
    profile: null,
    evidence: [],
    claimAudit: clean,
    factAudit: cleanFacts,
    styleLint: noStyle,
    generatedAt: GENERATED_AT,
    ...extra,
  });
}

const SECTIONS = ["## What changed for this job", "## Needs your confirmation", "## What the checks found", "## Job match", "## Fit", "## Open gaps", "## Where the files are"];

const CHECKED = { keywordCoverage: { score: 1, covered: [{ keyword: "Python", where: "skills" }], missing: [] }, pageCount: { pages: 1 } };

test("report has the headline and every section, in order", () => {
  const md = build({ role: role(CHECKED) });
  assert.match(md, /^# Resume report: Developer platform product manager at Fabrikam AI/u);
  assert.match(md, /\*\*Status: Ready to review\*\*/u);
  assert.match(md, /Resume file: sample-candidate-fabrikam-ai\.docx/u);
  assert.match(md, /Report written: 2026-10-08/u);
  let last = -1;
  for (const heading of SECTIONS) {
    const at = md.indexOf(heading);
    assert.ok(at > last, `${heading} should appear after the previous section`);
    last = at;
  }
});

test("status: ready, needs confirmation, blocked", () => {
  assert.equal(analyzeTailorReport({ role: role(CHECKED), config: config(), claimAudit: clean, factAudit: cleanFacts, styleLint: noStyle }).status, STATUS.ready);
  const warn = { ...clean, warnings: ['Not tied to specific evidence at summary.text: "40%" matches something in evidence.jsonl, but this line does not say which entry. Add the entry id to evidenceIds'] };
  assert.equal(analyzeTailorReport({ role: role(), config: config(), claimAudit: warn, factAudit: cleanFacts, styleLint: noStyle }).status, STATUS.confirm);
  const bad = { errors: ['Unsupported claim at summary.text: "500%" in "Grew 500%" — no evidence.jsonl entry supports this percentage. Add'], warnings: [], claimsFound: [] };
  const analysis = analyzeTailorReport({ role: role(), config: config(), claimAudit: bad, factAudit: cleanFacts, styleLint: noStyle });
  assert.equal(analysis.status, STATUS.blocked);
  assert.match(buildTailorReport({ role: role(), config: config(), claimAudit: bad, factAudit: cleanFacts, styleLint: noStyle, generatedAt: GENERATED_AT }), /\*\*Status: Blocked\*\*/u);
});

test("unbound claim warning becomes a question that names the line", () => {
  const warn = {
    ...clean,
    warnings: [
      'Not tied to specific evidence at experienceSections[0].jobs[0].bullets[0] (Senior Platform Program Manager — Contoso Labs): "40%" matches something in evidence.jsonl, but this line does not say which entry. Add the entry id to evidenceIds (on the job)',
    ],
  };
  const md = build({ claimAudit: warn });
  assert.match(md, /1\. Which job or note backs "40%" in bullet 1 under your Senior Platform Program Manager at Contoso Labs job\?/u);
  assert.doesNotMatch(md, /evidenceIds|evidence\.jsonl/u);
});

test("unfamiliar tool warning becomes a question", () => {
  const facts = {
    errors: [],
    warnings: ['Tool or technology not found in the candidate\'s profile or evidence at experienceSections[0].jobs[0].bullets[0]: "Kubernetes", "Terraform" — confirm with the candidate before sending.'],
  };
  const md = build({ factAudit: facts });
  assert.match(md, /Have you used "Kubernetes", "Terraform" in bullet 1 under your Senior Platform Program Manager at Contoso Labs job\?/u);
  assert.match(md, /If not, I'll take them out\./u);
});

test("low-confidence evidence behind a line becomes a question", () => {
  const cfg = config();
  cfg.experienceSections[0].jobs[0].evidenceIds = ["ev-009"];
  const evidence = [{ id: "ev-009", fact: "Ran a pilot with about 12 users.", snippet: "Ran a pilot with about 12 users.", confidence: "low" }];
  const md = build({ config: cfg, evidence });
  assert.match(md, /rests on a note I'm not fully sure about \("Ran a pilot with about 12 users\."\)\. Is it accurate as written\?/u);
  assert.match(md, /\*\*Status: Needs your confirmation\*\*/u);
});

test("missing keywords the person can't back up are asked about; supported ones are suggestions", () => {
  const keywordCoverage = {
    score: 0.5,
    covered: [{ keyword: "Roadmapping", where: "summary" }, { keyword: "Python", where: ["skills", "bullets"] }],
    missing: [{ keyword: "SQL", supported: true }, { keyword: "Kubernetes", supported: false }],
    checkedAt: GENERATED_AT,
  };
  const md = build({ keywordCoverage });
  assert.match(md, /covers 2 of 4 keywords \(50%\)/u);
  assert.match(md, /Covered: Roadmapping \(summary\), Python \(skills, bullets\)/u);
  assert.match(md, /you have the experience \(could add\): SQL\./u);
  assert.match(md, /found no proof \(don't claim\): Kubernetes\./u);
  assert.match(md, /The posting asks for "Kubernetes", and I found nothing in your record that shows it\. Have you done this\?/u);
  assert.doesNotMatch(md, /The posting asks for "SQL"/u);
});

test("keyword coverage and page count are read from the role when not passed", () => {
  const stored = role({
    keywordCoverage: { score: 80, covered: [{ keyword: "Python", where: "skills" }], missing: [], checkedAt: GENERATED_AT },
    pageCount: { pages: 2, checkedAt: GENERATED_AT },
  });
  const md = build({ role: stored });
  assert.match(md, /covers 1 of 1 keywords \(80%\)/u);
  assert.match(md, /Runs over 1 page \(2 pages\): trim the weakest bullets under Senior Platform Program Manager at Contoso Labs|Runs over 1 page \(2 pages\): trim the summary and the longest bullets/u);
  assert.match(md, /The resume runs to 2 pages\./u);
  assert.match(md, /\*\*Status: Needs your confirmation\*\*/u);
});

test("checks that have not run are listed once under Not done yet, with no placeholder lines", () => {
  const md = build();
  assert.match(md, /\*\*Status: Draft made; job match not checked yet\*\*/u);
  assert.doesNotMatch(md, /Ready to review/u);
  assert.match(md, /## Not done yet\n\n- Give me the job posting text so I can check how well the resume matches it\./u);
  assert.match(md, /- Ask me to check the page count/u);
  assert.doesNotMatch(md, /Not checked yet|not checked yet\./u);
  assert.doesNotMatch(md, /## Job match|## Fit/u);
});

test("the person-facing report never shows the length proxy or a limit number", () => {
  for (const extra of [{}, { role: role(CHECKED) }, { role: role({ pageCount: { pages: 3 } }) }]) {
    const md = build(extra);
    assert.doesNotMatch(md, /Length estimate|out of a \d+ limit|1000/u);
  }
});

test("fit says Fits on 1 page, or Runs over 1 page with what to trim", () => {
  assert.match(build({ role: role({ pageCount: { pages: 1 } }) }), /## Fit\n\nFits on 1 page\./u);
  const two = build({ role: role({ pageCount: { pages: 2 } }) });
  assert.match(two, /## Fit\n\nRuns over 1 page \(2 pages\): trim /u);
  const cfg = config();
  cfg.experienceSections[0].jobs[0].bullets = ["One.", "Two.", "Three."];
  assert.match(build({ config: cfg, role: role({ pageCount: { pages: 2 } }) }), /trim the weakest bullets under Senior Platform Program Manager at Contoso Labs first/u);
});

test("malformed stored keyword and page data do not throw and read as not done", () => {
  const md = build({ role: role({ keywordCoverage: "oops", pageCount: { pages: "many" } }) });
  assert.match(md, /## Not done yet/u);
  assert.match(md, /Draft made; job match not checked yet/u);
});

test("single page and no unsupported keywords stays ready", () => {
  const md = build({
    role: role({ keywordCoverage: { score: 1, covered: [{ keyword: "A", where: "summary" }], missing: [{ keyword: "B", supported: true }] }, pageCount: { pages: 1 } }),
  });
  assert.match(md, /Fits on 1 page\./u);
  assert.match(md, /\*\*Status: Ready to review\*\*/u);
  assert.doesNotMatch(md, /## Not done yet/u);
});

// --- What changed for this job ---------------------------------------------

function baseAndTailored() {
  const base = config({
    summary: { text: "Fictional product leader." },
    skills: [["Developer platforms", "Platform strategy"]],
  });
  base.experienceSections[0].jobs[0].bullets = ["Alpha bullet one.", "Beta bullet two.", "Gamma bullet three."];
  const tailored = config({
    summary: { text: "Fictional product leader focused on developer platforms and launches." },
    skills: [["Developer platforms", "Platform strategy, Internal tooling"]],
  });
  tailored.experienceSections[0].jobs[0].bullets = ["Gamma bullet three.", "Alpha bullet one.", "Delta new bullet four."];
  return { base, tailored };
}

test("what changed lists summary, bullet and skills edits against the base, at most five lines", () => {
  const { base, tailored } = baseAndTailored();
  const md = build({ config: tailored, baseConfig: base });
  const section = md.split("## What changed for this job")[1].split("## ")[0];
  const bullets = section.split("\n").filter((l) => l.startsWith("- "));
  assert.ok(bullets.length >= 3 && bullets.length <= 5, `got ${bullets.length}`);
  assert.match(section, /Reworded the summary to: "Fictional product leader focused on developer platforms/u);
  assert.match(section, /Added a bullet under Senior Platform Program Manager at Contoso Labs: "Delta new bullet four"/u);
  assert.match(section, /Removed a bullet under .*: "Beta bullet two"/u);
  assert.match(section, /Reordered the bullets under .* so "Gamma bullet three" comes first/u);
  assert.match(section, /Added to skills: Internal tooling/u);
  assert.doesNotMatch(section, /nothing to compare/u);
});

test("what changed says so when the resume matches its base", () => {
  const { base } = baseAndTailored();
  const md = build({ config: base, baseConfig: base });
  assert.match(md, /No wording changes: this resume matches the one it was based on\./u);
});

test("what changed without a base says there is nothing to compare and lists keywords with where they are used", () => {
  const md = build({
    role: role({
      keywordCoverage: {
        score: 1,
        covered: [{ keyword: "roadmap", where: "summary" }, { keyword: "launch", where: "bullet 1 of Senior Platform Program Manager at Contoso Labs" }, { keyword: "Python", where: "skills: Developer platforms" }],
        missing: [],
      },
    }),
  });
  assert.match(md, /This is the first resume for this role, so there is nothing to compare yet\./u);
  assert.match(md, /- roadmap: now in summary/u);
  assert.match(md, /- launch: now in a bullet/u);
  assert.match(md, /- Python: now in skills/u);
});

test("what changed compares the summary with the general resume when there is no base config", () => {
  const md = build({ profile: { summary: "General product leader." } });
  assert.match(md, /Compared with your general resume/u);
  assert.match(md, /Reworded the summary to: "Fictional product leader focused on developer platforms"/u);
});

test("what changed on a blocked report says nothing was made", () => {
  const bad = { errors: ['Unsupported claim at summary.text: "500%" in "Grew 500%" — no evidence.jsonl entry supports this percentage. Add'], warnings: [], claimsFound: [] };
  assert.match(build({ claimAudit: bad }), /No resume file was made yet, so there is nothing to compare\./u);
});

test("style findings name the field and offer a plain fix", () => {
  const styleLint = {
    findings: [
      { type: "buzzword", description: 'AI-style buzzwords detected: "leverage", "synergy"', source: "experience[0].jobs[0].bullets[0]", sourceLabel: "Job 1 bullet 1" },
      { type: "uniformity", description: "Sentences are suspiciously uniform in length (10-11 words, avg 10 words)", source: "summary", sourceLabel: "Professional summary" },
      { type: "repetition", description: 'Repeated words: "platform"', source: "skills[0][1]", sourceLabel: 'Skill category "Developer platforms"' },
    ],
  };
  const md = build({ styleLint });
  assert.match(md, /3 spots could sound more like you/u);
  assert.match(md, /Bullet 1 under your Senior Platform Program Manager at Contoso Labs job: stock phrases .*"leverage", "synergy".* Fix: say what you actually did/u);
  assert.match(md, /Professional summary: the sentences are all about the same length/u);
  assert.match(md, /Skill category "Developer platforms": some words repeat \("platform"\)/u);
});

test("blocked errors are explained in plain language with what to do", () => {
  const fixtures = [
    ['Employer not found in the candidate\'s record at experienceSections[0].jobs[0]: "Initech" does not appear in profile.json experience or in any evidence entry. Ask', /"Initech" \(your Senior Platform Program Manager at Contoso Labs job\), but I can't find it.*Did you work there\?/u],
    ['Job title does not match the profile at experienceSections[0].jobs[0]: the resume says "Director" at Contoso Labs but profile.json says "Manager"; it adds "director". Use', /says your title was "Director".*profile says "Manager"\. Which one is right\?/u],
    ['End date does not match the profile at experienceSections[0].jobs[0]: the resume says "2022 - Present" but profile.json has this job ending 2023-01. Ask', /The dates "2022 - Present" on .* don't match your profile\. Which dates are right\?/u],
    ['Unsupported scope claim at experienceSections[0].jobs[0].bullets[0]: "led" (led) in "Led it" is not backed by any evidence. Ask the candidate whether they led this; record it in evidence or soften to "contributed to".', /Did you really "led" this work.*soften it to "contributed to"/u],
    ['Education not found in the candidate\'s record at education[0]: "Example University" does not appear in profile.json education. Ask', /lists "Example University".*Is it right\?/u],
  ];
  for (const [message, expected] of fixtures) {
    const md = build({ factAudit: { errors: [message], warnings: [] }, config: config({ education: [{ degree: "BA", institution: "Example University", dates: "2010" }] }) });
    assert.match(md, /\*\*Status: Blocked\*\*/u);
    assert.match(md, /I stopped before making the resume file/u);
    assert.match(md, expected);
    assert.doesNotMatch(md, /profile\.json|evidence\.jsonl/u);
  }
});

test("open gaps are listed from the gap report", () => {
  const md = build({ gapReport: { path: "outputs/roles/fabrikam-ai-developer-platform-pm/gap-report.md", gaps: [{ keyword: "SQL", type: "PresentationGap", recommendedAction: "Mention the reporting work in the summary." }] } });
  assert.match(md, /\*\*SQL\*\*: you have this, but it isn't visible yet\. Mention the reporting work/u);
  assert.match(md, /Gap review: `outputs\/roles\/fabrikam-ai-developer-platform-pm\/gap-report\.md`/u);
  assert.match(build(), /No gap review has been written for this role yet\./u);
});

test("audits are computed from the config when not passed (regeneration from stored data)", () => {
  const cfg = config({ summary: { text: "Grew revenue 500% across the portfolio." } });
  const md = buildTailorReport({ role: role(), config: cfg, profile: null, evidence: [], generatedAt: GENERATED_AT });
  assert.match(md, /\*\*Status: Blocked\*\*/u);
  assert.match(md, /Where does "500%" in your summary come from\?/u);
});

test("no absolute paths and no command names in the text", () => {
  const warn = { ...clean, warnings: ['Not tied to specific evidence at summary.text: "40%" matches something in evidence.jsonl, but x'] };
  const md = build({
    claimAudit: warn,
    role: role({ keywordCoverage: { score: 50, covered: [], missing: [{ keyword: "Go", supported: false }] }, pageCount: { pages: 2 } }),
    gapReport: { path: "outputs/roles/x/gap-report.md", gaps: [] },
  });
  assert.doesNotMatch(md, /(^|[\s`(])\/(home|root|tmp|Users|var)\b/u);
  assert.doesNotMatch(md, /[A-Za-z]:\\/u);
  const prose = md.replace(/`[^`]*`/gu, "");
  assert.doesNotMatch(prose, /\bnpm\b|\bnode\b|workspace:|--[a-z]+|\btailor\b|\bvalidate\b|\bingest\b|\bCLI\b|\bJSON\b/iu);
});

test("report paths are workspace-relative and without ..", () => {
  assert.equal(reportRelativePath("abc-123"), "outputs/tailor-reports/abc-123.md");
  assert.equal(reportRelativePath("../evil/id"), "outputs/tailor-reports/-evil-id.md");
});

test("validateRoles accepts a clean reportPath and rejects absolute or .. paths", () => {
  const base = { id: "r1", title: "T", company: "C", status: "tracked", urls: {}, notes: [], followUpQuestions: [] };
  assert.deepEqual(validateRoles([{ ...base, resume: { reportPath: "outputs/tailor-reports/r1.md" } }], "roles"), []);
  assert.deepEqual(validateRoles([base], "roles"), []);
  for (const bad of ["../x.md", "outputs/../../x.md", "/etc/passwd", "C:\\x.md", "", 5]) {
    const errors = validateRoles([{ ...base, resume: { reportPath: bad } }], "roles");
    assert.equal(errors.length, 1, `expected an error for ${JSON.stringify(bad)}`);
    assert.match(errors[0], /resume\.reportPath/u);
  }
});

test("the coverage record stored by tailor is read: plain percent, and where from locations", () => {
  const stored = role({
    keywordCoverage: {
      score: 40,
      percent: 88,
      covered: [{ keyword: "scheduling", importance: "required", locations: ["summary", "bullet 2 of Office Manager at Riverside Dental", "skills: Operations"] }],
      missing: [{ keyword: "healthcare", importance: "required", supported: true, evidenceIds: [] }],
      checkedAt: GENERATED_AT,
    },
    pageCount: { pages: 1 },
  });
  const md = build({ role: stored });
  assert.match(md, /covers 1 of 2 keywords \(88%\)/u);
  assert.doesNotMatch(md, /\(40%\)/u);
  assert.match(md, /Covered: scheduling \(summary, bullet, skills\)/u);
});

// --- General resume baseline, coverage lift, per-edit why -------------------

const generalProfile = {
  summary: "General product leader.",
  skills: ["Roadmaps"],
  experience: [
    {
      title: "Senior Platform Program Manager",
      organization: "Contoso Labs",
      highlights: [
        { text: "Ran quarterly planning for three teams.", evidenceIds: ["ev-9"] },
        { text: "Led launch coordination for an internal developer platform.", evidenceIds: ["ev-1"] },
        { text: "Wrote the weekly status note." },
      ],
    },
  ],
};
const generalEvidence = [
  { id: "ev-1", type: "resume", source: { path: "inputs/resumes/old-resume.md" }, snippet: "Led launch coordination for an internal developer platform. Built internal tooling.", confidence: "source-text" },
  { id: "ev-9", type: "resume", source: { path: "inputs/notes/planning.md" }, snippet: "Ran quarterly planning.", confidence: "source-text" },
];
function generalCase(extra = {}) {
  const tailored = config({
    summary: { text: "Fictional product leader focused on developer platforms and internal tooling." },
    skills: [["Developer platforms", "Internal tooling"]],
  });
  tailored.experienceSections[0].jobs[0].bullets = ["Led launch coordination for an internal developer platform.", "Ran quarterly planning for three product teams."];
  tailored.experienceSections[0].jobs[0].bulletEvidenceIds = [["ev-1"], ["ev-9"]];
  const resume = { keywordCoverage: {
    percent: 100,
    covered: [{ keyword: "launch coordination", importance: "required", locations: ["bullet 1 of Senior Platform Program Manager at Contoso Labs"] }, { keyword: "internal tooling", importance: "required", locations: ["summary", "skills: Developer platforms"] }],
    missing: [],
  } };
  return { role: role(resume), config: tailored, profile: generalProfile, evidence: generalEvidence, ...extra };
}

test("without a base, the baseline is the general resume built from the profile", () => {
  const md = build(generalCase());
  const section = md.split("## What changed for this job")[1].split("\n## ")[0];
  assert.match(section, /Compared with your general resume/u);
  assert.match(section, /Reworded the summary to: "Fictional product leader focused on developer platforms/u);
  assert.match(section, /Reworded a bullet under Senior Platform Program Manager at Contoso Labs: "Ran quarterly planning for three teams" became "Ran quarterly planning for three product teams"/u);
  assert.match(section, /Removed a bullet under .*: "Wrote the weekly status note"/u);
  assert.doesNotMatch(section, /nothing to compare/u);
});

test("coverage lift compares the general resume with the tailored one and lists gained keywords", () => {
  const md = build(generalCase());
  assert.match(md, /Your general resume covers 1 of 2 keywords \(50%\)\. This resume covers 2 of 2 \(100%\)\./u);
  assert.match(md, /- internal tooling: now in summary and skills/u);
});

test("each edit says why: posting keywords used and the evidence behind it", () => {
  const md = build(generalCase());
  assert.match(md, /Why: uses "internal tooling" from the posting\./u);
  assert.match(md, /became "Ran quarterly planning for three product teams"\.\.* Why: backed by evidence ev-9/u);
});

test("the model carries before/after text, lift numbers and a gained keyword with no source as a question", () => {
  const input = generalCase({ evidence: [], profile: { ...generalProfile, experience: generalProfile.experience } });
  const model = buildTailorReportModel({ ...input, claimAudit: clean, factAudit: cleanFacts, styleLint: noStyle, generatedAt: GENERATED_AT });
  assert.equal(model.changes.diff.summary.before, "General product leader.");
  assert.equal(model.lift.baseline.percent, 50);
  assert.equal(model.lift.tailored.percent, 100);
  assert.ok(model.lift.gained.some((item) => item.keyword === "internal tooling" && !item.supported));
  assert.ok(model.confirm.some((q) => /"internal tooling" .* can't find it in your record/u.test(q)));
});

test("the html report shows before/after, a coverage bar, and escapes everything", () => {
  const input = generalCase();
  input.config.summary.text = 'Fictional <script>alert("x")</script> leader focused on internal tooling.';
  const html = buildTailorReportHtml({ ...input, claimAudit: clean, factAudit: cleanFacts, styleLint: noStyle, generatedAt: GENERATED_AT });
  assert.match(html, /^<!doctype html>/u);
  assert.match(html, /class="before"/u);
  assert.match(html, /class="after"/u);
  assert.match(html, /class="track"/u);
  assert.match(html, /covers 1 of 2 keywords \(50%\)/u);
  assert.doesNotMatch(html, /<script>alert/u);
  assert.match(html, /&lt;script&gt;/u);
  assert.doesNotMatch(html, /<script|https?:\/\//u);
  assert.match(html, /prefers-color-scheme: dark/u);
});

test("with nothing to build a baseline from, the first-resume message stays", () => {
  const md = build({ profile: { summary: "", skills: [], experience: [] }, evidence: [] });
  assert.match(md, /This is the first resume for this role, so there is nothing to compare yet\./u);
  assert.doesNotMatch(md, /general resume covers/u);
});
