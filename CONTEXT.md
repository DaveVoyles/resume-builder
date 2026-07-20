# Project Glossary

Domain terms, models, and vocabulary this project uses consistently — in
code, comments, commit messages, and conversation. See AGENTS.md
§Engineering Principles ("Ubiquitous language").

| Term | Definition | Notes |
|---|---|---|
| lead | A prospective role discovered during search, pre-application, kept as a plain agent-maintained record with a fit rating and notes until promoted into tracked roles. | Lives in `leads.json` in the candidate workspace; promoted via the existing `add-role` command. Introduced by design plan 0001 (D6). |
| playbook | A vendor-neutral markdown instruction doc that any terminal agent follows to do the semantic half of a workflow, handing schema-validated JSON to the deterministic CLI. | Lives in `docs/playbooks/`. The agent/CLI contract is [ADR 0001](docs/decisions/0001-agent-operated-cli.md). |
| tailor | The one-pass workflow that turns a drafted, schema-conformant resume config into a validated, evidence-audited, rendered DOCX plus a tracked role — landed with a not-yet-applied `application.status` so a human reviews the resume before it's sent. | `src/cli/commands/tailor.js`; playbook at `docs/playbooks/tailor.md`. Composes D2's `validateResumeConfig`/`renderResumeConfig`, D3's `auditResumeConfig`, and D6/D7's `add-role`/`set-status` rather than reimplementing any of them. Introduced by design plan 0001 (D4). |
