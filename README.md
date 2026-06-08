# Resume builder

Evidence-backed resume workspace tooling for targeted job searches.

Try this:

```bash
npm install
npm run sample:quickstart
```

## Overview

Resume Builder helps a candidate and an AI agent collaborate on targeted job applications without mixing unsupported claims into resumes or trackers. The tool creates a private candidate workspace, ingests resumes and notes into an evidence ledger, tracks seed and accepted roles, renders a markdown application tracker, and produces similar-role review output.

This repo contains the reusable modular project. Keep personal resume portfolios, generated resumes, and private candidate workspaces outside the public repository unless they use fictional sample data.

The current modular workflow does not yet generate DOCX resumes. It prepares the structured workspace, evidence ledger, tracker, and similar-role review that the planned DOCX generator can consume.

---

## Why use this tool

Use this project when you want to:

- Turn one or more existing resumes into structured source evidence.
- Capture GitHub, project, education, and work-history details that support resume claims.
- Track seed roles, accepted roles, application links, compensation, and status.
- Generate a readable markdown tracker for the current search.
- Produce search briefs and score manually researched similar roles before deciding what to apply to.
- Keep raw candidate inputs and generated outputs out of Git by default.

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/cli/` | Workspace CLI commands for initialization, ingestion, role intake, tracker rendering, similar-role review, and validation. |
| `src/core/` | Workspace I/O, schemas, evidence, profile, IDs, and similar-role scoring. |
| `src/adapters/` | Source adapters for local notes/resumes, public GitHub metadata, and role records. |
| `src/renderers/` | Markdown renderers for trackers and similar-role review output. |
| `docs/modular-architecture.md` | Reusable architecture for friend or multi-candidate workflows. |
| `docs/candidate-workspace.md` | Candidate workspace layout, collaboration flow, and privacy defaults. |
| `docs/workspace-schemas.md` | JSON and JSONL schema contracts for workspace files. |
| `docs/generator-refactor-plan.md` | Planned DOCX generator architecture. |
| `examples/sample-candidate/` | Fictional privacy-safe sample workspace. |
| `scripts/check-privacy.js` | Blocks private candidate workspace files or modular outputs from being staged or tracked. |
| `scripts/check-workspace.js` | Validates workspace schema and tracker freshness. |

## Common workflows

### Install dependencies

Run this once after cloning or after dependency changes:

```bash
npm install
```

### Try the sample workspace

Run the fictional sample workspace before you create a real candidate workspace:

```bash
npm run sample:quickstart
```

The command renders the sample tracker, builds the sample similar-role review, and validates the sample workspace. The sample uses fictional data and `.invalid` links so it is safe to inspect and share.

### Create a private candidate workspace

Use this sequence for a new candidate:

```bash
npm run workspace:init -- --workspace candidate
npm run workspace:ingest -- --workspace candidate --resume path/to/resume.docx --notes path/to/notes.md --github githubUser
npm run workspace:add-role -- --workspace candidate --url https://example.com/job
npm run workspace:similar -- --workspace candidate
npm run workspace:tracker -- --workspace candidate
npm run workspace:validate -- --workspace candidate
```

Read these guides before using the workflow with real candidate data:

- `docs/modular-architecture.md`
- `docs/candidate-workspace.md`
- `docs/workspace-schemas.md`
- `examples/sample-candidate/README.md`

### Use the workspace CLI

| Workflow | Command |
| --- | --- |
| Initialize a candidate workspace | `npm run workspace:init -- --workspace <dir>` |
| Ingest resumes, notes, text, or public GitHub metadata | `npm run workspace:ingest -- --workspace <dir> --resume <file> --notes <file> --github <user>` |
| Add a seed or tracked role | `npm run workspace:add-role -- --workspace <dir> --url <url>` or add `--tracked` |
| Build similar-role review output | `npm run workspace:similar -- --workspace <dir> [--candidates <file>]` |
| Render the application tracker | `npm run workspace:tracker -- --workspace <dir>` |
| Validate workspace files and tracker freshness | `npm run workspace:validate -- --workspace <dir>` |
| Run the fictional sample workflow | `npm run sample:quickstart` |

`find-similar` is a bounded discovery helper, not a job-board scraper. It derives search briefs from seed roles and preferences, scores optional manually researched candidate roles from a local JSON file, and writes `<workspace>/outputs/similar-roles.md` for review. Promote only candidate-approved roles with `add-role --tracked`, update application state in `roles.tracked.json`, then run `workspace:tracker` and `workspace:validate`.

## Collaborate with the candidate

The agent should treat resume generation as a collaborative interview, not a one-shot file conversion. Ask clarifying questions before making claims that are missing, vague, or high impact. If the candidate is unavailable, continue with supported evidence and record follow-up questions in workspace notes, tracker notes, or a local `<workspace>/outputs/follow-up-questions.md` handoff file.

Good clarifying questions ask for specific evidence:

- "Which roles, teams, and dates should this work-history entry use?"
- "What measurable outcome can you share for this project?"
- "Was this technology used in production, a prototype, or a side project?"
- "Which education, certifications, or training should appear on the resume?"
- "Which claims should the resume avoid or phrase cautiously?"
- "Which seed role best represents the kind of job you want next?"

The candidate should review generated positioning, similar-role recommendations, unsupported claims, compensation and location assumptions, and any role marked ready to apply. Do not promote a similar role to tracked status or add a low-confidence claim without candidate review.

## Privacy boundaries

Keep real candidate inputs and generated modular outputs local by default. The root `.gitignore` excludes `candidate/inputs/`, candidate profile and role data files, candidate claim policies, `candidate/outputs/`, and root-level `outputs/`.

Run this before sharing a branch or giving the repo to a friend:

```bash
npm run check:privacy
```

The privacy check fails if private workspace paths are staged or already tracked. Commit reusable code, docs, scripts, templates, schemas, and fictional examples instead.

## Validation

Run the modular validation gate before pushing reusable changes:

```bash
npm run validate
```

This command renders and validates the sample candidate workspace, then runs the privacy check.
