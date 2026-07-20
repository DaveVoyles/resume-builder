# Grill: Intake interview skill

**Grill** is an intake interview that captures work history, target roles, location preferences, compensation, and constraints into the candidate workspace.

## What it does

The grill guides an agent through a structured conversation with the candidate, one question at a time. Answers are written to:

- `candidate/profile.json` — Work history and candidate facts
- `candidate/preferences.json` — Target roles, location, salary, deal breakers
- `candidate/evidence.jsonl` — Supporting evidence for claims

The agent makes the semantic decisions (asking follow-up questions, rephrasing, linking evidence); the CLI validates the results.

## Usage

Use this skill when you're ready to conduct an intake interview with a candidate. The playbook is the source of truth:

```bash
docs/playbooks/grill.md
```

Paste the playbook into your terminal agent (Claude, ChatGPT, Copilot CLI, etc.) and follow along.

## Playbook sections

The grill walks through:

1. **Work history** — Roles, dates, locations, and impact
2. **Target role** — Job titles, seniority, industries
3. **Location and work mode** — Preferred regions and remote/hybrid/on-site
4. **Salary and compensation** — Base, total, and ranges
5. **Constraints and deal breakers** — Non-negotiables

## After intake

After the grill completes:

1. Validate the workspace:
   ```bash
   npm run workspace:validate -- --workspace candidate
   ```

2. Review the captured facts with the candidate.

3. Proceed to the next step: ingest resumes, find similar roles, or tailor resumes.

## Schema reference

See [Candidate workspace schemas](../../docs/workspace-schemas.md) for the full shape of `profile.json`, `preferences.json`, and `evidence.jsonl`.

## Related playbooks

- `tailor.md` — Build a resume for a specific job posting
- `find-roles.md` — Search for and vet candidate roles (coming soon)
