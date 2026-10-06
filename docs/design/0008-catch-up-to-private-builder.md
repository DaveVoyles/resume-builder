# 0008 — Catch the public builder up to the private one

**Status:** Approved in chat 2026-10-06 (same session asked to plan and build)
**Date:** 2026-10-06
**Repo:** github.com/DaveVoyles/resume-builder (public)
**Companion ADR:** [0005 — Port behavior, not private files](../decisions/0005-port-behavior-not-private-files.md)

## Executive Summary

The public resume tool already writes a Word resume, tracks applications, and packs notes for an interview. The private tool has moved ahead in a few ways a job seeker can feel: it keeps the resume short, it will not quietly replace a resume you already sent, and it can fill a form after you say yes. This plan adds those pieces here, plus a front page a person can follow with Claude, Grok, or Gemini. Real job-search files stay on your computer. Nothing from the private search is copied in.

## Goals

- A person who has a terminal AI can start from the root README.
- A resume config stays short enough for about two pages.
- A resume already sent is not overwritten unless you pass a flag.
- Form fill works on a practice form, and it does not press Submit unless you say so.
- The public repo still contains only fictional sample data.

## Success criteria

- `npm test` and `npm run check:privacy` pass.
- The sample resume config has a headline and a summary of 120 words or fewer.
- A second render of a sent resume does not change the file unless `--include-applied` is set.
- Apply dry-run exits with an error when there is no approval record.
- The root README's opening says an AI agent is required and names Claude, Grok, and Gemini.

## In Scope

- Human instructions on the root README.
- Short-summary, headline, bullet-cap, and length checks.
- Freeze a resume after it has been sent.
- Approval record, dry-run, and a local practice-form fill.
- Study-guide shape any of those agents can follow.
- Optional PDF when LibreOffice is installed.
- A command that saves a lead in the workspace. No web scraping.

## Out of Scope

- Copying the private generator, real resumes, real trackers, or real form answers.
- Scraping job boards or shipping a personal company list.
- Calling an AI from the CLI, or requiring an API key.
- A diagram tool that is not already a dependency of this repo.
- A career-timeline image from the private search.
- New GitHub Actions, deploy changes, or a home-server dashboard.
- Employer-specific career rules (a named past employer must appear).

## Locked Decisions

1. **Reimplement. Do not copy private source.** The private renderer hardcodes contact links. New behavior lands in this repo's workspace CLI. (source: ADR 0005, file check 2026-10-06)
2. **The CLI still never calls an AI.** Claude, Grok, or Gemini writes the words. The CLI checks and saves. (source: ADR 0001)
3. **No new CI.** Do not add or edit workflow files. Proof is local `npm test` and `npm run check:privacy`. The existing validate workflow already runs those and must stay green. (source: user 2026-10-06)
4. **Form fill does not need a browser in tests.** A pure function maps profile fields. Default is fill-only. Submit happens only with `--confirm-submit`. (source: private apply default, plus the existing validate workflow has no browser install)
5. **Length rules are generic.** Summary at most 120 words, a required headline, bullet caps, and one proxy score. No rule that a named past employer must appear. (source: private length plan used a personal employer rule)
6. **Leads are a file write.** The private board scraper is tied to a personal company list and stays out. (source: private search script header)
7. **Study guides stay markdown.** The agent writes them. Pictures are optional files. No external diagram binary. (source: ADR 0001)

## Decision Trail

```text
private contact links in renderer --> do not copy files (D1)
ADR 0001 -------------------------> agent writes, CLI checks (D2)
user: no new CI ------------------> local tests only (D3)
no browser on current CI ---------> pure fill function (D4)
personal employer rule -----------> generic length checks (D5)
personal company list ------------> lead file only (D6)
```

## Deliverables

| # | Deliverable | Size | Acceptance Criteria | Dependencies | Status |
|---|---|---|---|---|---|
| D1 | Short resume checks | S | `validateResumeConfig` requires `candidate.headline` (non-empty, at most 80 characters), rejects `summary.text` over 120 words, rejects a first job with more than 6 bullets and any later job with more than 4. **ResumeProxyScore** = summary words + bullet words + 40 per job + 20 per education row. Fail when ResumeProxyScore is over 1000. In-repo configs and `npm start` pass. Tests cover one fail and the sample pass. | — | Todo |
| D2 | Do not overwrite a sent resume | S | `render-resume` refuses to replace an existing docx when a tracked role for that company has `application.status` other than `interested`, unless `--include-applied`. Missing status still allows the write. Test uses a temp workspace. | — | Todo |
| D3 | Human README and study-guide shape | S | Root README opens in plain language: you need Claude, Grok, Gemini (Antigravity counts), or a similar terminal agent. Eight lifecycle steps. Private files stay in `candidate/`. Study-guide playbook tells the agent to write, in order: briefing, jargon table, optional picture pair as a markdown pipe table, 60-second opener, honesty gaps, a 90-minute lab, questions for the recruiter. Every claim cites an evidence id. Fictional sample only. | — | Todo |
| D4 | Leads, PDF, and fill-only apply | S | `add-lead` appends company, title, and url to workspace `leads.json`. `export-pdf` exits with a clear install message when LibreOffice is missing; tests do not launch Word. `approve-apply` writes a gitignored approval file. `apply --dry-run` fails with no approval and passes with one. A pure fill function maps name and email and does not mark submitted unless `confirmSubmit` is true. Example profile uses `example.invalid`. `npm run check:privacy` passes. | — | Todo |

All four are S. This repo has no `scripts/gate-regime.sh`, so the build-ready gate is XS or S.

## Testing Decisions

- `node:test`, same as the rest of the repo.
- Fixtures use the fictional sample candidate or a temp directory.
- D4 fill tests call the pure function. They do not download a browser.
- Before each commit, `npm test` and `npm run check:privacy`.
- Do not spell private deny-list tokens in docs. The checker matches those strings even in a warning.

## ⚠️ Irreversible Steps

- **Publishing this work on the public repo.** A revert removes it from the latest commit. It does not erase the public history. Mitigation: fictional sample data only, no copies from the private checkout, and `npm run check:privacy` before every commit.

No deletions of user data, no secret rotation, no emails sent.

## Execution Tracking

- Issues: filed in this session under label `plan:0008`.
- Land: one pull request to `main` after local tests pass. No new workflow files.
