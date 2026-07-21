# Cover letter playbook

**Cover letter** generation follows the same shape as tailoring a resume: draft a
schema-conformant config, then hand it to the CLI, which validates it, audits every claim
against the evidence ledger, and renders a DOCX. It runs two ways — as an optional add-on to
the `tailor` command (one pass, alongside the resume), or standalone via `render-cover-letter`
for a role you've already tailored.

Before you start:

- The candidate should have completed intake (grill playbook) with `profile.json` and
  `evidence.jsonl` populated.
- You'll draft a cover-letter config under `candidate/cover-letter-configs/<role-slug>.json`
  (see [Workspace schemas](../workspace-schemas.md#cover-letter-render-config-render-cover-letter)).
- Every claim in the letter is audited against the evidence ledger, exactly like resume bullets —
  don't draft anything the candidate's evidence doesn't support.

---

## Start the cover-letter workflow

**Propose a recommended approach:**

"I'll draft a cover letter for this role, keeping every claim tied to your evidence ledger the
same way I do for your resume. You can generate it together with your resume in one `tailor`
pass, or add it separately afterward if you decide later that a role wants one."

**Confirm you're ready:**

- [ ] The candidate's `profile.json` and `evidence.jsonl` are populated.
- [ ] You have write access to `candidate/cover-letter-configs/`.
- [ ] You know the company's hiring-manager name if available, or default to "Dear Hiring
      Manager,".

---

## Section 1: Draft the config

Write a cover-letter config with the required shape: `company`, `candidate.name`,
`candidate.contact`, `salutation`, `bodyParagraphs` (an array of paragraph strings), and
`closing`. Keep paragraphs short and specific — 2-4 paragraphs is typical. Each paragraph should
do one job:

1. **Opening** — why this role, why this company, in one or two sentences.
2. **Evidence** — the strongest one or two pieces of matching experience, each tied to something
   in `evidence.jsonl` the same way a resume bullet is.
3. **Closing** — enthusiasm and a call to action (interview, next steps).

Avoid generic filler ("I am a hard-working team player") — every sentence should either state a
fact the evidence ledger backs, or make a specific, role-relevant case for fit. The
[de-AI style lint](../style-lint.md) also runs against cover-letter text from both `tailor
--cover-letter` and standalone `render-cover-letter` — expect the same advisory warnings
(buzzwords, sentence-uniformity, repetition) you'd see on a resume draft, and address them the
same way.

## Section 2: Render it

**Together with the resume, in one `tailor` pass** — pass `--cover-letter` alongside the usual
`tailor` arguments:

```bash
npm run workspace:tailor -- --workspace candidate \
  --config candidate/resume-configs/<role-slug>.json \
  --url "<job-posting-url>" --title "<Role Title>" \
  --cover-letter candidate/cover-letter-configs/<role-slug>.json
```

This validates and audits both the resume and the cover-letter config, renders both DOCX files,
and records the cover letter's path and status (`review-needed`) on the tracked role
(`role.coverLetter` — see [Workspace schemas](../workspace-schemas.md#rolestrackedjson)).

**Standalone, for a role already tailored** — if you decide to add a cover letter after the fact:

```bash
npm run workspace:render-cover-letter -- --workspace candidate \
  --config candidate/cover-letter-configs/<role-slug>.json
```

Either path runs the same validation (`src/core/cover-letter-config.js`) and evidence-backed
claim audit (`auditCoverLetterConfig` in `src/core/claim-audit.js`) as the resume path — a claim
the evidence ledger doesn't support blocks the render exactly like an unsupported resume bullet
would. See [Accuracy and claims](../accuracy-and-claims.md#evidence-backed-claim-audit-blocking).

## Section 3: Candidate review

A rendered cover letter lands with `role.coverLetter.status: "review-needed"`, same as a
freshly-rendered resume — the candidate reviews it before it's sent. Update the status once
they've approved it, the same way you would for the resume itself.

## Related pages

- [`tailor.md`](tailor.md) — the resume-tailoring playbook this integrates with.
- [Workspace schemas](../workspace-schemas.md#cover-letter-render-config-render-cover-letter) —
  the full cover-letter-config field reference.
- [Accuracy and claims](../accuracy-and-claims.md) — claim-safety rules, shared with the resume
  path.
- [`style-lint.md`](../style-lint.md) — the de-AI style lint that also runs over cover-letter
  text.
