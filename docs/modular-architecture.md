# Modular architecture

Try this:

```text
Review this guide before you create a candidate workspace for a friend.
Use it to separate reusable engine work from private candidate data.
```

This guide describes the modular workflow for reusable resume generation. The v1 workspace CLI covers workspace setup, source ingestion, role intake, similar-role review, tracker rendering, and validation.

---

## Overview

The modular workflow separates reusable code, candidate-specific inputs, and generated outputs. You provide source material, a GitHub account when useful, additional notes, and seed role links. The system uses those inputs to build evidence-backed resume strategy, a generated application tracker, similar-role recommendations, and follow-up questions.

Keep reusable templates and documentation in the repository. Keep raw candidate inputs and generated outputs ignored by default unless the candidate explicitly opts in.

## Architecture layers

| Layer | Purpose | Typical contents |
| --- | --- | --- |
| Reusable engine | Runs ingestion, role analysis, rendering, validation, and tracker generation. | CLI commands, parsers, schemas, renderers, validators, claim policies. |
| Candidate workspace | Stores one candidate's private inputs, normalized facts, role data, and generated outputs. | Resumes, notes, profile data, evidence ledger, seed roles, tracked roles, outputs. |
| Examples and templates | Shows the workflow without exposing real candidate data. | Sample candidate README files, starter templates, fake role examples. |

## Target data flow

1. Ingest resumes, public GitHub signals, notes, and seed role URLs.
2. Normalize candidate facts into a profile.
3. Create an evidence ledger that ties each claim to a source.
4. Analyze each role for requirements, seniority signals, domain keywords, and gaps.
5. Generate tracker rows and, in a later DOCX phase, tailored resumes from structured data.
6. Recommend similar roles from the seed-role pattern.
7. Validate files, duplicate links, placeholders, and unsupported claims.
8. Hand off outputs, follow-up questions, and risks.

## V1 CLI command surface

The v1 command plan is intentionally small and modular. It unblocks ingestion adapters by giving them stable workspace files to read from and write to.

| Command | Package script | Purpose | V1 status |
| --- | --- | --- | --- |
| `init --workspace <dir> [--force]` | `npm run workspace:init -- --workspace <dir>` | Create the candidate workspace directories, default JSON files, evidence ledger, tracker, and workspace-local ignore rules. | Implemented. |
| `ingest --workspace <dir> [--resume <file> ...] [--notes <file> ...] [--input <file> ...] [--github <user>]` | `npm run workspace:ingest -- --workspace <dir>` | Add local resume, notes, generic text, and public GitHub profile evidence to `evidence.jsonl` and update `profile.json`. | Implemented. |
| `add-role --workspace <dir> (--url <url> \| --title <title> --company <company>) [--tracked]` | `npm run workspace:add-role -- --workspace <dir>` | Add seed roles to `roles.seed.json`, or tracked roles to `roles.tracked.json` with `--tracked`. | Implemented. |
| `find-similar --workspace <dir> [--candidates <file>] [--max <count>]` | `npm run workspace:similar -- --workspace <dir>` | Build search briefs from seed roles and score optional manually researched candidate roles for candidate review. | Implemented. |
| `build-tracker --workspace <dir>` | `npm run workspace:tracker -- --workspace <dir>` | Render `outputs/tracker.md` from `roles.tracked.json`. The CLI also accepts `build` as an alias. | Implemented. |
| `validate --workspace <dir>` | `npm run workspace:validate -- --workspace <dir>` | Validate required workspace files, schema shape, evidence JSONL, role lists, and tracker freshness. | Implemented. |

`find-similar` is intentionally bounded. It does not scrape job boards; it creates search briefs and scores roles from an optional local JSON file. `mark-applied` is deferred beyond the v1 command surface. For v1, agents should record researched similar roles with `add-role --tracked` after candidate review, update application state in `roles.tracked.json`, then run `build-tracker` and `validate`. Future commands should be thin wrappers around those same structured files rather than separate stores.

## Expected inputs

- One or more current resumes in DOCX, markdown, or plain text.
- A GitHub username or profile URL when public repositories help show evidence.
- Additional notes, such as target companies, location preferences, compensation ranges, preferred titles, technologies, and claims to avoid.
- Seed role URLs that represent the roles the candidate wants.
- Optional portfolio, project, writing, speaking, or demo links.

## Expected outputs

The current v1 workflow creates:

- A generated markdown tracker with role status, fit notes, links, compensation, and next actions.
- Similar-role review output with search briefs, fit rationale, duplicate suppression, and source links.
- Follow-up questions captured in notes or handoff output for missing evidence, uncertain claims, or application decisions.
- Validation notes that show which workspace files, role records, tracker outputs, or claim inputs need review.

The planned DOCX phase adds tailored resumes for accepted seed roles and selected similar roles.

## Collaboration model

The agent and candidate should work together like a resume strategist and subject-matter expert. The agent extracts evidence, maps it to roles, and drafts positioning. The candidate confirms facts, adds missing context, chooses which roles matter, and approves claims before they appear in final application materials.

Agents should ask clarifying questions when:

- Work history has unclear titles, dates, team names, scope, or outcomes.
- Education, certifications, or training are missing or ambiguous.
- A resume claim lacks source evidence or uses a metric the candidate has not confirmed.
- A role requires domain experience that is only partially supported by the evidence ledger.
- Similar-role recommendations depend on location, compensation, seniority, work authorization, or remote-work preferences.

If the candidate is unavailable, proceed only with supported claims and record the unresolved questions in the handoff. Do not turn an assumption into a resume claim.

## Privacy model

Treat candidate data as private workspace data by default. Ignore raw resumes, personal notes, normalized profiles, evidence ledgers, fetched posting snapshots, generated resumes, generated trackers, and similar-role outputs unless the candidate opts in to tracking them.

Commit only reusable code, schemas, templates, examples, and documentation. If a candidate chooses to commit outputs for reproducibility, document that choice in the workspace and review the diff for personal data before staging.

## Agent workflow

### Intake

Collect resumes, GitHub details, additional notes, and seed role URLs. Record unknowns as questions instead of guessing.

### Evidence

Extract claims from source material and tie each claim to a source path, URL, or note. Mark confidence as high, medium, or low.

### Role analysis

Compare each role against the evidence ledger. Identify matching experience, gaps, seniority signals, keywords, and claims to avoid.

### Generation

Create role-specific tracker entries and, in the planned DOCX phase, resumes from structured data. Use only supported claims unless the candidate approves an addition.

### Validation

Check generated files, tracker consistency, duplicate URLs, placeholders, and unsupported claims. Escalate missing evidence before final handoff.

### Handoff

Provide output paths, recommended next actions, follow-up questions, and any claim-risk caveats. Keep raw private content out of the handoff summary.

## Related pages

- [Generator refactor plan](generator-refactor-plan.md)
- [Candidate workspace](candidate-workspace.md)
- [Agent runbook](agent-runbook.md)
- [Accuracy and claims](accuracy-and-claims.md)
- [Role intake template](role-intake-template.md)
