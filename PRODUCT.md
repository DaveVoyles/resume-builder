# Product

<!-- impeccable:product-schema 1 -->

Interview skipped (owner approved). Every inferred fact below is labelled `Assumption:`. Sources: README.md, AGENTS.md, `src/renderers/`, `docs/`.

## Platform

web

## Stack

Node.js CLI (CommonJS, Node 16+) with no framework. UI is server-generated static HTML emitted by string templates in `src/renderers/html-*.js` and a local server (`serve`, `serve-home`). Resumes render to DOCX. No client framework, no build step, no AI key.

## Users

- A working professional running a targeted job search, usually non-technical, who decides what is true about their own history. They never run commands; an AI assistant operates the tool for them.
- A second reader is the AI agent that operates the CLI and reads the Markdown twins of each report.
- Assumption: developers extending the CLI are a minor third audience for the UI.

## Product Purpose

An evidence-backed resume workflow. Given old resumes, notes and job postings, it produces a one-page tailored resume per job, a plain-language tailor report proving what changed, and a tracker of every role. Success: every claim on a resume traces to the person's own words, and nothing is sent without them.

## Positioning

Every statement is tied to an evidence-ledger id, unsupported claims block the render, declined keywords stay off every resume, and there is no submit path (`apply` is dry-run only). A generic resume-writing tool could not truthfully claim this.

## Operating Context

- Private workspace (`candidate/`, gitignored); person drops files in `my-documents`; agent copies and ingests.
- Outputs: DOCX resume, HTML report and tracker (for the person), Markdown (for the agent), served locally on a home page that lists resumes closest fit first.
- Assumption: pages are opened in a desktop browser on the person's own machine and sometimes read on a phone or in dark mode (the tailor report ships a dark theme).

## Capabilities and Constraints

- Evidence ledger, keyword coverage before/after, possible-matches (asks yes/no), declined list, left-out list, stale-application badges, pipeline funnel, searchable tracker, contacts tracker, study-guide bundle, Q&A debrief.
- Hard constraints: no submit path, no model calls, privacy check on every push, one-page resume, employers/titles/dates checked against the profile.
- Vocabulary: "evidence", "tailor report", "possible matches", "declined", "left out", "closest fit first".

## Brand Commitments

- Voice: plain, colleague-to-colleague, no talking down; honest about what the tool refused to say (see `docs/first-run/what-to-say.md`).
- Assumption: no logo or named brand identity beyond the repo name "Resume builder".

## Evidence on Hand

- Real showcase run (repo owner's own resume, three postings) in `docs/showcase/` and screenshots in `docs/images/`.
- Public demo uses a fictional candidate ("Troy McClure"); it is labelled as not a real job search.
- No customer testimonials, metrics or pricing exist; do not invent any.

## Product Principles

1. Evidence first: show where every claim comes from, and show what was refused.
2. The person decides what is true; the tool asks, never assumes.
3. Calm and honest over persuasive; no hype, no urgency.
4. Plain language for the person, structure for the agent.
5. Private by default; nothing leaves the machine unprompted.

## Accessibility & Inclusion

- Assumption: no formal standard stated; treat WCAG AA contrast and legible text as the floor. Known past bug: native controls rendered invisible when OS dark mode met light-only styles (see comment in `html-tracker.js`).
