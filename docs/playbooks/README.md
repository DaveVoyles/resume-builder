# Playbooks

Playbooks are vendor-neutral markdown instruction docs for terminal LLM agents. Each playbook guides an agent through one semantic workflow — intake interviews, finding similar roles, tailoring resumes — by asking clarifying questions and collecting structured answers.

## Playbook convention

- **The agent owns semantic work.** Playbooks guide agents through decision-making: choosing candidates to interview, drafting role configs, verifying job postings are real. The agent makes the judgment calls.
- **The CLI stays deterministic.** The resume-builder CLI never calls an LLM; it parses, validates, renders, tracks, and audits. It requires no API key.
- **Schema validation is the contract.** An agent follows a playbook, collects and structures answers, then hands the CLI a schema-validated JSON file. The CLI validates that JSON and rejects anything malformed or unsupported by evidence.

## Using playbooks

**Pick a playbook** matching your next step (e.g., `grill.md` for intake, `tailor.md` to build a resume for a job posting).

**Share it with your terminal agent.** Paste the playbook into Claude, ChatGPT, Copilot CLI, or any other LLM agent you already use. No API key or vendor lock-in needed.

**Let the agent guide you.** The agent asks questions one at a time, takes notes, and writes structured output to your workspace files.

**Validate before proceeding.** Once the agent hands you a workspace file, run `npm run workspace:validate` to catch errors before they compound.

## Current playbooks

- `grill.md`: Intake interview capturing work history, target roles, location, compensation, and constraints.
- `find-roles.md`: Search and vet prospective roles against preferences, maintain leads, and promote accepted leads to tracked roles.

## Why this design?

- **Works with any agent.** No vendor integration, no plugin matrix — use whatever terminal agent you already have.
- **Claim safety.** Evidence validation happens in deterministic code, not by trusting the agent. Resume claims are only as strong as the evidence backing them.
- **Transparency.** Playbook prose is the contract — it stays in sync with what the CLI expects because both are versioned together in the same repo.
