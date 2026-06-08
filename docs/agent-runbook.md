# Agent runbook

Use this runbook when you prepare a candidate workspace, role-specific tracker entry, similar-role review, or future resume draft. Keep changes evidence-backed and preserve candidate privacy.

---

## Required first reads

Read these sources before you draft or edit role content:

- The current task brief or orchestration plan.
- `README.md` for commands and repository layout.
- `docs/candidate-workspace.md` for workspace structure and privacy defaults.
- `docs/workspace-schemas.md` for role, evidence, profile, and preference schemas.
- `docs/accuracy-and-claims.md` for claim-safety rules.
- `docs/role-intake-template.md` when you need to capture a new role.
- The target job description and source links.
- The candidate workspace files named by the task.

If a required source is missing, record the gap in the handoff and avoid inventing details.

## Candidate intake workflow

1. Collect source resumes, notes, public links, GitHub context, preferences, and seed roles.
2. Ingest source material into the candidate workspace.
3. Review evidence entries for missing snippets, low-confidence facts, and candidate questions.
4. Ask clarifying questions for missing work history, education, project scope, metrics, or claim boundaries.
5. Record answers in source notes, `profile.json`, `preferences.json`, `evidence.jsonl`, or role records.

## Job intake workflow

1. Capture the company, role title, location, level, employment type, and source link.
2. Extract required skills, preferred skills, domain signals, and seniority signals from the job description.
3. Map each requirement to verified evidence, source material, public proof, or an explicit gap.
4. Identify which tracker fields, resume strategy notes, and follow-up questions need updates.
5. Draft positioning that ties verified experience to the role without overstating scope, ownership, metrics, or platform access.
6. Run workspace validation before handoff.

## Duplicate detection

Check for duplicates before you create a new role record:

- Search `roles.seed.json` and `roles.tracked.json` for the same job URL or apply URL.
- Compare similar titles across teams, levels, and locations before treating a role as new.
- Reuse existing role notes when the description matches and update only changed facts.
- If you find a near duplicate, record what differs, such as level, team, location, or posting date.

## Accuracy guardrails

Use verified facts only. Do not create metrics, customer names, internal platform details, security claims, or product outcomes that the source material does not support.

Follow these rules:

- Attribute claims to specific work, deliverables, or public artifacts when possible.
- Use cautious wording for inferred fit, such as "aligns with" or "relevant to," instead of claiming direct ownership.
- Keep unconfirmed platform claims generic.
- Do not promote exploratory, prototype, or learning work as production ownership unless the source confirms it.
- Replace placeholders before handoff or mark the document as blocked.

## Validation checklist

Before you finish, confirm that:

- Required workspace files exist and match the documented schema.
- Tracker output is generated from `roles.tracked.json`.
- Similar-role output is treated as a review queue, not an application tracker.
- Role claims match source evidence.
- Metrics, titles, company names, dates, education, and technologies match source material.
- No placeholder text remains unless you call it out as a blocker.
- The diff touches only files in the assigned scope.

## Handoff checklist

In your final handoff, include:

- What you completed.
- Files you created or changed.
- Validation you ran.
- Any blockers, missing source facts, or follow-up questions.
- Whether the assigned work is fully done.
