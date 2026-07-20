# 0004 — Cover letters, ATS keyword scoring, and networking/referral tracking

**Status:** Approved 2026-07-20 (in-chat approval, post-Lavish review)
**Date:** 2026-07-20
**Repo:** github.com/DaveVoyles/resume-builder (public)

## Problem Statement

The tool covers the resume itself end-to-end (draft → validate → evidence-audit → render →
track) but leaves three real gaps in the job-search workflow: (1) there's no way to generate a
cover letter with the same evidence-backed rigor as the resume — candidates either skip it or
hand-draft it outside the tool's guarantees; (2) there's no way to check how well a tailored
resume's language actually covers a posting's stated requirements before submitting, so obvious
keyword gaps (the kind an ATS or a skimming recruiter would flag) go unnoticed until a
rejection; (3) the tracker covers applications but not the people side of a search — referrals,
informational interviews, and networking contacts have no home, so a promising lead can quietly
go cold with nothing prompting a follow-up.

This plan closes all three gaps, in the order Dave prioritized during grilling: cover letters
first (reuses the most existing plumbing), then ATS scoring (also hooks into the tailor flow),
then networking (the most standalone — a new entity type with no existing pipeline to extend).

Two other candidate areas surfaced during grilling — LinkedIn profile/headline help and
salary/negotiation prep, plus a "find-roles automation cadence" idea — were explicitly **not**
selected and are out of scope for this plan.

## User Stories

1. As a candidate tailoring an application, I can generate an evidence-backed cover letter
   alongside my resume in one pass, so I don't have to hand-draft it separately and re-verify
   claims myself.
2. As a candidate about to submit an application, I can check how well my tailored resume's
   language covers a posting's key terms, so I can catch obvious gaps before an ATS (or a human
   skimming for keywords) does.
3. As a candidate networking during a search, I can track who I've reached out to, at which
   companies, and what I owe them next, so a promising referral doesn't quietly go cold.

## Decisions (settled by grilling, 2026-07-20)

**Cover letters**
1. Both a new standalone `render-cover-letter` command and an optional `--cover-letter` flag on
   `tailor` — mirrors the existing `render-resume`/`tailor` relationship exactly.
2. Structured, schema-validated JSON config (same pattern as `resume-config.js`), not freeform
   text — keeps one validate/audit/render contract across both artifact types.
3. The evidence-backed claim audit is **blocking** for cover letters, same rigor as resumes — no
   relaxed rules just because the artifact is prose.
4. Render format is modern/simple: header + salutation + body paragraphs + sign-off. Explicitly
   **no** date line and **no** recipient address block (traditional business-letter format was
   considered and rejected).
5. The tracker gets a parallel "Cover Letter" column, and `study-guide-bundle` includes the cover
   letter when one exists for that role.

**ATS keyword-match scoring**
6. Fact surfaced during grilling: `roles.tracked.json`/`roles.seed.json` never store the actual
   job posting body text today — this plan does not change that. Scoring takes an
   **agent-extracted keyword list** (structured input) rather than having the CLI parse raw
   posting text itself — keeps the CLI's long-standing LLM-free, deterministic-only design
   (ADR 0001); the agent does the semantic extraction, the CLI does the set-overlap math.
7. Both a standalone `score-keywords` command and an optional `--keywords` flag on `tailor`.
8. **Always advisory** — never blocks `tailor` or any other command, regardless of coverage
   percentage. No `--min-coverage` blocking threshold.
9. Case-insensitive substring match only — no stemming/fuzzy matching.
10. Output is console/JSON only — nothing persisted to the role or tracker, to avoid a stale-score
    problem as the resume config keeps changing between runs.

**Networking/referral tracking**
11. Contacts are a standalone, person-level entity (`contacts.json`) — not owned by a role. A
    contact optionally carries `linkedRoleIds[]`, a loose reference to `roles.tracked.json` ids,
    not a hard foreign key.
12. Structured status enum, mirroring `roles.tracked.json`'s `application.status` pattern, driving
    an auto-generated `nextAction`/`dueDate` the exact same way `set-status` already does for
    roles — reusing the established rule-table mechanism rather than inventing a new one.
13. A dedicated `build-contacts-tracker` command producing its own `contacts.md`(+html), sorted by
    due date — not folded into the existing role tracker.

No ADR-worthy decisions surfaced beyond what ADR 0001 already covers — every decision above
extends that established architecture (agent-operated, evidence-backed, LLM-free CLI) to two new
artifact types and one new entity type, rather than introducing a new hard-to-reverse trade-off.

New domain terms surfaced: **keyword coverage** (ATS scoring's core output metric) and
**contact** (the new person-level entity, distinct from *role*). `nextAction` already exists as a
term and is being reused verbatim for the new entity. This repo has no `CONTEXT.md` yet; these
terms are being added via the `domain-model` skill as part of this hand-off.

## Deliverables

### Feature 1: Cover letter generation

| # | Deliverable | Size | Acceptance Criteria | Dependencies | Status |
|---|---|---|---|---|---|
| D1 | Generalize the claim-audit engine | S | `src/core/claim-audit.js`'s claim-checking logic is refactored into a generic `auditClaims(claimSites, evidenceEntries)` function operating on the `{path, text, context?}` site shape `collectConfigClaimSites` already produces. `auditResumeConfig` becomes a thin wrapper: `collectConfigClaimSites(config)` + `auditClaims(...)`. `tests/core/claim-audit.test.js` passes unchanged (byte-identical errors/warnings) — a pure internal refactor, no public behavior change. `auditClaims` is added as a new export alongside the existing `auditResumeConfig`. | — | Todo |
| D2 | Cover letter schema, audit wiring, DOCX renderer, standalone command | M | New `src/core/cover-letter-config.js` defines/validates `{ schemaVersion, company, candidate: {name, contact}, salutation, bodyParagraphs: string[], closing }`, following `resume-config.js`'s validation style. New `collectCoverLetterClaimSites(config)` walks `bodyParagraphs` into claim sites; new `auditCoverLetterConfig(config, evidence)` composes it with D1's `auditClaims` (blocking, same as resumes). New `src/renderers/docx-cover-letter.js` renders the config via `docx-helpers.js`'s existing `name`/`contactLine`/`para`/`rule` primitives — no date line, no address block. New `src/cli/commands/render-cover-letter.js` validates + audits + renders in one pass (mirrors `render-resume.js`), writing to `outputs/cover-letters/<Company>/`. New tests cover the schema validator, the audit wrapper (including an unsupported-claim case that correctly blocks), and the renderer, following `tests/renderers/docx-resume.test.js`'s existing pattern. | D1 | Todo |
| D3 | `tailor --cover-letter` integration, role tracking, tracker column, study-guide inclusion | M | `tailor.js` gains an optional `--cover-letter <config-path>` flag running D2's pass after the existing resume steps and before role registration. `role.coverLetter = { configPath, outputPath, status: "review-needed" }` is written as a sibling to the existing `role.resume` field, reusing the exact `relativeToWorkspace` pattern `tailor.js` already uses for `role.resume`. `src/renderers/markdown-tracker.js` and `src/renderers/html-tracker.js` both gain a "Cover Letter" column reading `role.coverLetter.status`, parallel to the existing "Resume" column. `src/cli/commands/study-guide-bundle.js` includes the cover letter's output path in its bundle when `role.coverLetter` exists. Tests: `tailor.test.js` extended for the `--cover-letter` flag; both tracker renderer tests updated; `study-guide-bundle.test.js` gains an inclusion case. | D2 | Todo |
| D4 | Docs sync — cover letters | S | New `docs/playbooks/cover-letter.md` follows the structural convention of `tailor.md`/`render-resume`'s existing playbook docs. `docs/workspace-schemas.md` gains the cover-letter-config shape and the `role.coverLetter` field reference. `docs/accuracy-and-claims.md` notes the claim audit now covers both resume and cover-letter artifacts. `README.md`'s feature table and lifecycle table both gain a cover-letter mention. Per-folder READMEs updated wherever they reference the tailor/render-resume pipeline. | D3 | Todo |

### Feature 2: ATS keyword-match scoring

| # | Deliverable | Size | Acceptance Criteria | Dependencies | Status |
|---|---|---|---|---|---|
| D5 | Keyword coverage scoring engine | S | New `src/core/keyword-coverage.js` exports a pure `scoreKeywordCoverage(keywords: string[], resumeConfig)` walking the same claim-bearing text fields as `collectConfigClaimSites` (summary, bullets, skills), doing a case-insensitive substring search per keyword, returning `{ percent, present: string[], missing: string[] }`. No fuzzy/stemming logic. New tests cover full match, partial match, and zero-match cases. | — | Todo |
| D6 | `score-keywords` standalone command | S | New `src/cli/commands/score-keywords.js` takes `--config <resume-config-path> --keywords <path-to-json-array>`, runs D5's scorer, prints a human-readable coverage report (percent + present + missing) plus an `--json` flag for machine-readable output. New `package.json` script `workspace:score-keywords`, mirroring the existing `workspace:*` convention. Test covers both output modes. | D5 | Todo |
| D7 | `tailor --keywords` advisory integration | XS | `tailor.js` gains an optional `--keywords <path>` flag running D5's scorer and printing the same report as D6, strictly after the (blocking) claim audit step. Coverage never affects `tailor`'s exit code or throws, regardless of percent. `tailor.test.js` covers the flag present vs. absent. | D5, D6 | Todo |
| D8 | Docs sync — ATS scoring | XS | New `docs/playbooks/score-keywords.md` (or a new section in `tailor.md`) documents the agent-extracts-keywords contract explicitly — the CLI never fetches or parses raw posting text. `docs/workspace-schemas.md` documents the keyword-list JSON array input shape. `README.md`'s feature table gains a row for keyword-match scoring. | D7 | Todo |

### Feature 3: Networking/referral tracking

| # | Deliverable | Size | Acceptance Criteria | Dependencies | Status |
|---|---|---|---|---|---|
| D9 | `contacts.json` schema, workspace path, status enum | S | `src/core/workspace.js`'s `workspacePaths()` gains a `contacts: path.join(workspace, "contacts.json")` entry. New `src/core/contact.js` defines/validates `{ id, name, company?, relationship (enum: referral, former-colleague, recruiter, informational-interview, other), contactMethod?, linkedRoleIds: string[], status, notes: string[], nextAction? }` plus a `CONTACT_STATUSES` enum (`identified, reached-out, responded, meeting-scheduled, met, referred, no-response, dormant`). New tests cover schema validation (valid/invalid shapes) and enum enforcement. | — | Todo |
| D10 | `add-contact` command | S | New `src/cli/commands/add-contact.js` creates and appends a validated contact to `contacts.json` (mirrors `add-role.js`: id via the existing `stableId` helper, dedup-by-id on re-run with the same name+company), accepting `--name`, `--company`, `--relationship`, `--linked-role <role-id>` (repeatable), `--notes`. Test covers creation, dedup, and linking to an existing tracked role id. | D9 | Todo |
| D11 | `set-contact-status` command with auto-nextAction rule table | M | New `src/cli/commands/set-contact-status.js` validates the target status against `CONTACT_STATUSES`, writes `contact.status`, and auto-generates `contact.nextAction { type, dueDate }` from a new `CONTACT_NEXT_ACTION_RULES` table mirroring `set-status.js`'s `NEXT_ACTION_RULES` exactly in structure (each status maps to a `type` + `dueDateOffsetDays` + `note` — e.g. `reached-out` → follow-up in 7 days, `meeting-scheduled` → follow-up in 1 day "send thank-you", `referred` → follow-up in 3 days "check in on referral outcome"; `no-response`/`dormant` → close, no due date). Exact per-status offsets/notes are finalized during implementation against this precedent, not re-litigated here. New tests cover every status transition's `nextAction` output, following `set-status.test.js`'s existing one-test-per-transition structure as the template. | D9, D10 | Todo |
| D12 | `build-contacts-tracker` command and renderers | M | New `src/renderers/markdown-contacts-tracker.js` and `src/renderers/html-contacts-tracker.js` render `contacts.json` into `contacts.md`/`contacts.html`, sorted by `nextAction.dueDate` ascending (contacts with no `nextAction` sort last), mirroring `markdown-tracker.js`/`html-tracker.js`'s structure. New `src/cli/commands/build-contacts-tracker.js` wires this with a `--format md|html` option and a new `workspace:contacts-tracker` package.json script. Tests cover renderer output and due-date sort order. | D11 | Todo |
| D13 | Docs sync — networking/contacts | S | New `docs/playbooks/contacts.md` documents the `add-contact` → `set-contact-status` → `build-contacts-tracker` workflow. `docs/workspace-schemas.md` gains the `contacts.json` schema, the `CONTACT_STATUSES` enum, and the `CONTACT_NEXT_ACTION_RULES` table (mirroring the existing "Auto-generating nextAction" section's format). `README.md`'s feature table gains a contacts/networking row; its lifecycle section notes contact tracking runs alongside the numbered lifecycle rather than as a new numbered stage (a contact can exist before, during, or after any specific tracked role). Per-folder READMEs updated where relevant. | D12 | Todo |

All 13 deliverables are XS/S/M: build-ready, no further decomposition required.

## Testing Decisions

- **Framework:** `node:test`, matching the repo's existing zero-dependency test setup throughout.
- **D1 seam:** the existing `tests/core/claim-audit.test.js` must pass unchanged post-refactor —
  this is the regression check proving `auditResumeConfig`'s public behavior didn't shift.
- **D2 seam:** new test coverage for `cover-letter-config.js`'s validator, the
  `auditCoverLetterConfig` wrapper (including a blocking unsupported-claim case), and
  `docx-cover-letter.js`, following `tests/renderers/docx-resume.test.js`'s existing pattern.
- **D3 seam:** `tests/cli/tailor.test.js` extended for the `--cover-letter` flag; both tracker
  renderer tests updated for the new column; `study-guide-bundle.test.js` gains an inclusion case.
- **D5 seam:** new `keyword-coverage.js` tests — full/partial/zero-match cases.
- **D6/D7 seam:** new test coverage for `score-keywords.js`; `tailor.test.js` extended for
  `--keywords`.
- **D9 seam:** new `contact.js` schema tests (valid/invalid shapes, enum enforcement).
- **D10/D11 seam:** new test files following `set-status.test.js`'s structure exactly — that file
  already tests every status transition's `nextAction` individually; D11's tests mirror that
  one-test-per-transition approach for contacts.
- **D12 seam:** new renderer tests following the existing tracker renderer test pattern, covering
  output content and the due-date sort order specifically.
- **D4/D8/D13 (docs-only) seam:** verified by a repo-wide grep for stale references plus a
  read-through for accuracy, the same convention plan 0003's D3 used.

## ⚠️ Irreversible Steps

None. Every deliverable across all three features is additive: new files, new optional CLI flags,
a new schema, new tracker columns, a new standalone entity type. No deletions, data migrations,
secret rotations, or external sends anywhere in this plan.

## Out of Scope

- LinkedIn profile/headline optimization, salary/negotiation prep, and a "find-roles automation
  cadence" — all surfaced during grilling but not selected for this plan.
- Persisting ATS coverage scores to `role.json` or the tracker (Decision 10) — deliberately kept
  ephemeral to avoid a stale-score problem.
- Fuzzy/stemmed keyword matching (Decision 9) — exact substring only.
- Blocking `tailor` on low keyword coverage (Decision 8) — always advisory.
- Traditional business-letter format for cover letters — date line and recipient address block
  (Decision 4) were considered and explicitly rejected.
- A hard foreign-key requirement between contacts and roles — `linkedRoleIds` is a loose,
  unvalidated reference (Decision 11).
- Any CLI-side fetching or parsing of raw job posting text — keyword extraction stays agent-side
  throughout, consistent with ADR 0001's LLM-free CLI philosophy (Decision 6).

## Execution Tracking

Not yet exported — to be filled in by `plan-to-issues` once this plan is approved.
