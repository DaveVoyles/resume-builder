# 📚 Docs

Reference documentation for resume-builder: how the CLI and playbooks work, why they're built
this way, and the exact schemas they read and write. If you're looking for a specific feature
(tailor, study guide, debrief, status updates, ...), the root [README](../README.md)'s
"Every feature has a doc" table is the fastest way in — it links each feature straight to its
playbook and reference doc. This page is the flat index for browsing the folder directly.

## Guides

| Doc | What's in it |
| --- | --- |
| [`getting-started.md`](getting-started.md) | First-time setup: run the sample, create a private workspace, do the intake interview. |
| [`agent-workflow.md`](agent-workflow.md) | How to use this project with a terminal AI agent — what the agent does vs. what the CLI does. |
| [`cli-workflow.md`](cli-workflow.md) | The CLI-only path: every command, in table form, for driving the workspace yourself without an agent. |
| [`candidate-workspace.md`](candidate-workspace.md) | The `candidate/` workspace layout, privacy defaults, intake checklist, and evidence rules. |
| [`workspace-schemas.md`](workspace-schemas.md) | Field-by-field schema reference for every workspace file (`profile.json`, `evidence.jsonl`, resume configs, the study-guide bundle, etc.). |
| [`accuracy-and-claims.md`](accuracy-and-claims.md) | Claim-safety rules and the evidence-backed claim audit that `validate` enforces mechanically. |
| [`style-lint.md`](style-lint.md) | The de-AI style lint: what it checks (buzzwords, sentence-uniformity, repetition), where the wordlist lives, and how `tailor`/`validate` surface its advisory warnings. |
| [`agent-runbook.md`](agent-runbook.md) | Checklist an agent works through when drafting role content: required reads, duplicate detection, validation, handoff. |
| [`e2e-showcase.md`](e2e-showcase.md) | Every playbook run end to end against the fictional sample candidate, with real captured command output — the regression pass over this page's own claims. |
| [`modular-architecture.md`](modular-architecture.md) | The underlying architecture: reusable engine vs. candidate workspace vs. examples, the full CLI command surface table, data flow. |
| [`role-intake-template.md`](role-intake-template.md) | Copy-paste template for capturing a new job target's basics. |
| [`generator-refactor-plan.md`](generator-refactor-plan.md) | Historical design doc for the DOCX-generation architecture; mostly superseded by [design/0001](design/0001-feature-parity-agent-first.md), kept as the reference for its original `resumePlan` module table. |

## Subfolders

| Folder | What it holds |
| --- | --- |
| [`playbooks/`](playbooks/) | Vendor-neutral agent instructions — one per workflow (onboarding, grill intake, find roles, tailor, study guide, debrief). Has its own [README](playbooks/README.md). |
| [`decisions/`](decisions/) | Architecture Decision Records (ADRs, [MADR](https://adr.github.io/madr/) format) — durable "why we built it this way" records. |
| [`design/`](design/) | Numbered design plans (`NNNN-title.md`) — the deliverable-by-deliverable build plan for a feature, from problem statement through acceptance criteria. |
| [`images/`](images/) | Diagrams and screenshots embedded in the docs and root README (lifecycle flow diagram, tracker/DOCX samples). |

## Related pages

- [Root README](../README.md)
- [AGENTS.md](../AGENTS.md) — the agent-facing instructions for operating this repo.
