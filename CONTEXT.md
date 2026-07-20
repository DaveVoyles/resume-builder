# Project Glossary

Domain terms, models, and vocabulary this project uses consistently — in
code, comments, commit messages, and conversation. See AGENTS.md
§Engineering Principles ("Ubiquitous language").

| Term | Definition | Notes |
|---|---|---|
| debrief | A general Q&A feedback loop: capture a question, the candidate's answer, a sentiment rating, and the AI's proposed improved answer for next time. Applies to any agent-driven Q&A context (grill intake, real interviews, study-guide prep, tailor conversations), not one lifecycle stage. | Entries live in `feedback.jsonl` in the candidate workspace; captured via `docs/playbooks/debrief.md`. Introduced by design plan 0002 (D1). |
| lead | A prospective role discovered during search, pre-application, kept as a plain agent-maintained record with a fit rating and notes until promoted into tracked roles. | Lives in `leads.json` in the candidate workspace; promoted via the existing `add-role` command. Introduced by design plan 0001 (D6). |
| playbook | A vendor-neutral markdown instruction doc that any terminal agent follows to do the semantic half of a workflow, handing schema-validated JSON to the deterministic CLI. | Lives in `docs/playbooks/`. The agent/CLI contract is [ADR 0001](docs/decisions/0001-agent-operated-cli.md). |
| tailor | The one-pass workflow that turns a drafted, schema-conformant resume config into a validated, evidence-audited, rendered DOCX plus a tracked role — landed with a not-yet-applied `application.status` so a human reviews the resume before it's sent. | `src/cli/commands/tailor.js`; playbook at `docs/playbooks/tailor.md`. Composes D2's `validateResumeConfig`/`renderResumeConfig`, D3's `auditResumeConfig`, and D6/D7's `add-role`/`set-status` rather than reimplementing any of them. Introduced by design plan 0001 (D4). |
