# 📄 Resume builder

[![Validate](https://github.com/DaveVoyles/resume-builder/actions/workflows/validate.yml/badge.svg)](https://github.com/DaveVoyles/resume-builder/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node.js 16+](https://img.shields.io/badge/node-%3E%3D16-339933?logo=node.js&logoColor=white)
![No API key required](https://img.shields.io/badge/API%20key-not%20required-brightgreen)

Evidence-backed resume workspace tooling for AI-assisted job searches — drop in your docs, let
an agent interview you, find and vet roles, tailor an evidence-backed DOCX resume per posting,
and track every application without a spreadsheet.

This project assumes you have a **terminal AI agent at all times** — GitHub Copilot CLI, Claude,
ChatGPT, or anything else that can read and edit files in your repo. The agent is the primary
operator: it interviews you, drafts resume content, and does the semantic work. The CLI is the
agent's deterministic toolbelt — it never calls an LLM, requires no API key, and validates,
renders, tracks, and audits every claim against the evidence you actually gave it. See
[ADR 0001: Agent-operated CLI](docs/decisions/0001-agent-operated-cli.md) for the full rationale.

You can also run the CLI yourself without an agent — see
[CLI workflow](docs/cli-workflow.md) — but the docs and UX are written for the agent-first path.

## 🚀 Start here

Paste this to your terminal agent:

```text
Download https://github.com/DaveVoyles/resume-builder and help me get started. Run the sample
workflow first (npm start), then help me create a private workspace for my resume, notes, and
job links. Ask clarifying questions before making resume claims.
```

Prefer to drive it yourself first?

```bash
npm install
npm start
```

`npm start` runs the fictional sample candidate through the **entire lifecycle** — tracker,
similar-role review, a rendered DOCX resume, a full `tailor` pass, a status update, and an
interview study-guide bundle — so you can see every stage before touching real data. Nothing it
touches is real: the sample candidate ("Alex Rivera"), companies, and postings are fictional.

## 🧭 The lifecycle

<p align="center">
  <img src="docs/images/lifecycle-flow.svg" alt="Resume Builder agent-operated lifecycle: drop in docs, grill intake, find roles, tailor, rendered DOCX, track, status updates, study guide" width="820">
</p>

| Stage | What happens | Playbook / command |
| --- | --- | --- |
| 1. Drop in docs | You hand your agent resumes, notes, and links. | `npm run workspace:ingest` |
| 2. Grill intake | The agent interviews you one question at a time — work history, target roles, location, compensation, constraints — and writes `profile.json`, `preferences.json`, `evidence.jsonl`. | [`docs/playbooks/grill.md`](docs/playbooks/grill.md) |
| 3. Find roles | The agent searches, vets postings against your preferences, verifies links are live, and maintains `leads.json`; you accept or skip each lead. | [`docs/playbooks/find-roles.md`](docs/playbooks/find-roles.md) |
| 4. Tailor | The agent drafts a resume config for one job posting; `tailor` validates it, audits every claim against your evidence ledger, renders the DOCX, and tracks the role — all in one pass. | [`docs/playbooks/tailor.md`](docs/playbooks/tailor.md) · `npm run workspace:tailor` |
| 5. Rendered DOCX | An evidence-backed resume lands at `outputs/resumes/<Company>/`, landed **un-applied** so you review it first. | — |
| 6. Track | The role is registered in `roles.tracked.json`; `build-tracker` regenerates the markdown and HTML tracker. | `npm run workspace:tracker` |
| 7. Status updates | Tell your agent "I applied" / "I have an interview" / "I got rejected" — it runs `set-status` to record the enum status and rebuild the tracker. | `npm run workspace:set-status` |
| 8. Study guide | Before an interview, `study-guide-bundle` gathers your profile, evidence, resume config, and the job posting into one context bundle; the agent writes the actual study guide from it. | [`docs/playbooks/study-guide.md`](docs/playbooks/study-guide.md) · `npm run workspace:bundle` |

Steps 4–8 repeat for every role you track. The CLI never calls an LLM at any stage — schema
validation is the contract between what your agent drafts and what the CLI is willing to write
to disk or render.

Every playbook above was run end to end against the fictional sample candidate as part of
shipping this page, with real command output captured in
[`docs/e2e-showcase.md`](docs/e2e-showcase.md) — that page is also the regression pass over each
playbook, and it names one bug it found and fixed along the way.

## 🤔 Why use this

Job searches get messy fast: dozens of tabs, a resume that drifts further from the truth with
every "polish" pass, and no record of *why* you claimed a skill or metric when an interviewer
asks you to defend it. This project keeps the search structured and honest:

- **Claims stay backed by evidence.** `tailor` audits every metric claim in a resume config
  against your evidence ledger before it renders anything — an unsupported claim blocks the
  render with a per-claim error, not a silent pass.
- **Nothing leaks by accident.** Real resumes, notes, and application data are private by
  default and gitignored; only reusable code, docs, and a fictional sample are ever committed.
- **You're not locked into one AI vendor.** It's a plain Node.js CLI that any terminal agent
  (GitHub Copilot CLI, Claude, ChatGPT, or none at all) can drive. No OpenAI/Anthropic/GitHub API
  key required.
- **Applications stay organized without a spreadsheet.** One command regenerates a markdown
  tracker and an interactive, searchable HTML tracker straight from structured JSON.
- **A tailored resume never applies for you.** `tailor` always lands a new role at `interested`
  — not `applied` — so a human reviews the DOCX before anything is sent.

## 👥 Who it's for

Anyone running a multi-application job search who wants their resume claims and tracker to hold
up under scrutiny — especially candidates applying to several roles at once, working with an AI
assistant, or anyone tired of maintaining tracker spreadsheets and resume versions by hand.

## 👀 See it in action

Running `npm start` builds the tracker, renders a resume, and tracks a role from the fictional
sample workspace. The interactive HTML tracker (`npm run workspace:tracker -- --workspace
<dir> --format html`) — searchable, filterable, with summary stat cards — looks like this:

<p align="center">
  <img src="docs/images/tracker-html-sample.png" alt="Sample HTML application tracker for the fictional candidate Alex Rivera, showing one tracked role at Northwind Tools with fit, status, and resume link columns" width="820">
</p>

And the resume `tailor`/`render-resume` produces — a real generated DOCX, evidence-backed and
rendered from the sample workspace's resume config — looks like this:

<p align="center">
  <img src="docs/images/resume-docx-sample.png" alt="Sample rendered DOCX resume for the fictional candidate Alex Rivera, showing summary, experience, skills, and education sections" width="620">
</p>

The markdown tracker (`npm run workspace:tracker`) is the same data as plain text:

```markdown
# Application Tracker

| Company | Role | Location | Compensation | Fit | Applied | Job URL | Apply URL | Resume | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Northwind Tools | Senior product manager, AI developer workflows | Remote, United States | $170,000–$220,000 | strong: ... | interested | [Job](...) | [Apply](...) | outputs/resumes/... | ... |
```

## 🎁 What this creates

- A private candidate workspace.
- An evidence ledger that ties resume claims back to source material.
- Evidence-backed, schema-validated **DOCX resumes** tailored per job posting.
- A markdown application tracker **and** an interactive HTML tracker.
- A `leads.json` of vetted, link-verified prospective roles.
- Interview study-guide context bundles for tracked roles.
- Follow-up questions and strategy notes when you use an agent.

## 🔒 Privacy promise

Real candidate inputs and generated outputs are ignored by default. The included sample
candidate is fictional and safe to inspect.

Before sharing or pushing changes, run:

```bash
npm run check:privacy
```

## 📚 Learn more

| Need | Read |
| --- | --- |
| First-time setup | [Getting started](docs/getting-started.md) |
| Agent-assisted workflow | [Agent workflow](docs/agent-workflow.md) |
| Every playbook, run end to end (this page's regression pass) | [End-to-end showcase](docs/e2e-showcase.md) |
| Raw CLI reference (no agent) | [CLI workflow](docs/cli-workflow.md) |
| Workspace files and privacy | [Candidate workspace](docs/candidate-workspace.md) |
| Schema details | [Workspace schemas](docs/workspace-schemas.md) |
| Claim safety | [Accuracy and claims](docs/accuracy-and-claims.md) |
| Packaged agent instructions | [Playbooks](docs/playbooks/) |

## ✅ Requirements

- Node.js 16+ and npm. Node 18+ is recommended.
- Git for cloning the repo and running privacy checks.
- An AI assistant is optional, but recommended for non-technical users.

No OpenAI, Anthropic, or GitHub Copilot API key is required by the local CLI.
