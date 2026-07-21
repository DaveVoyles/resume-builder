# Playbooks

Playbooks are vendor-neutral markdown instruction docs for terminal LLM agents. Each playbook guides an agent through one semantic workflow — intake interviews, finding similar roles, tailoring resumes — by asking clarifying questions and collecting structured answers.

## Playbook convention

- **The agent owns semantic work.** Playbooks guide agents through decision-making: choosing candidates to interview, drafting role configs, verifying job postings are real. The agent makes the judgment calls.
- **The CLI stays deterministic.** The resume-builder CLI never calls an LLM; it parses, validates, renders, tracks, and audits. It requires no API key.
- **Schema validation is the contract.** An agent follows a playbook, collects and structures answers, then hands the CLI a schema-validated JSON file. The CLI validates that JSON and rejects anything malformed or unsupported by evidence.

## Using playbooks

**Pick a playbook** matching your next step (e.g., `grill.md` for intake, `tailor.md` to build a resume for a job posting, `study-guide.md` to prepare for an interview).

**Share it with your terminal agent.** Paste the playbook into Claude, ChatGPT, Copilot CLI, or any other LLM agent you already use. No API key or vendor lock-in needed.

**Let the agent guide you.** The agent asks questions one at a time, takes notes, and writes structured output to your workspace files.

**Validate before proceeding.** Once the agent hands you a workspace file, run `npm run workspace:validate` to catch errors before they compound.

## Current playbooks

- `onboarding.md`: Proactive, state-aware first-run sequence — workspace setup, dropping in real material, ingesting it, and starting grill intake. Run this at the start of any session; it short-circuits for returning candidates.
- `grill.md`: Intake interview capturing work history, target roles, location, compensation, and constraints.
- `find-roles.md`: Search and vet prospective roles against preferences, maintain leads, and promote accepted leads to tracked roles.
- `tailor.md`: Select relevant experience from your profile, draft a tailored resume config for a job posting, address AI-writing patterns, then validate, render, and track it with the `tailor` command.
- `cover-letter.md`: Draft an evidence-audited cover letter, either alongside a resume in one `tailor --cover-letter` pass or standalone via `render-cover-letter`.
- `gap-analysis.md`: Analyze missing keywords from a job posting — classify each gap as a presentation issue, weak evidence, adjacent skill, or true gap — and generate a report with recommended actions.
- `study-guide.md`: Gather a tracked role's context into a bundle and write an interview study guide.
- `contacts.md`: Track your professional network — add contacts, update status as relationships progress, build a due-date-sorted contacts tracker. Runs alongside the main lifecycle, not as a numbered stage in it.
- `debrief.md`: Capture Q&A performance feedback from an interview or practice session — question, answer, sentiment, and a proposed better answer — into `feedback.jsonl`.

## Why this design?

- **Works with any agent.** No vendor integration, no plugin matrix — use whatever terminal agent you already have.
- **Claim safety.** Evidence validation happens in deterministic code, not by trusting the agent. Resume claims are only as strong as the evidence backing them.
- **Transparency.** Playbook prose is the contract — it stays in sync with what the CLI expects because both are versioned together in the same repo.
