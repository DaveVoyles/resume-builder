# Agent-operated CLI: deterministic tooling, LLM work done by the user's own agent

- status: accepted
- date: 2026-07-19
- decision-makers: Dave Voyles
- consulted: design plan [0001](../design/0001-feature-parity-agent-first.md) grilling session

## Context and Problem Statement

The feature-parity release (design plan 0001) ports LLM-dependent workflows from a private upstream implementation: job-description ingestion, resume tailoring, an intake interview, and study-guide generation. In the upstream implementation those scripts shell out to a specific headless agent CLI. This repo's public promise is the opposite: vendor-agnostic, no API key required, usable with GitHub Copilot CLI, Claude, ChatGPT, or any other terminal agent. How should LLM-dependent features work here without breaking that promise?

## Decision Drivers

- Keep the "no OpenAI/Anthropic/GitHub API key required" promise intact.
- Avoid maintaining N vendor integrations or a plugin system.
- Keep resume claims deterministic and verifiable regardless of which agent drafted them.
- We assume the user always has *some* LLM agent driving the tool; the raw-CLI-only path is supported but not optimized for.

## Considered Options

1. **Agent-operated CLI** — the CLI never calls an LLM; the user's agent does all semantic work by following packaged playbooks and hands schema-validated JSON to the CLI.
2. **Hybrid** — agent-operated by default plus an optional `--headless` flag shelling out to a pluggable agent CLI.
3. **Port headless verbatim** — require a specific headless agent CLI, as the upstream implementation does.

## Decision Outcome

Chosen option: **Agent-operated CLI**.

- The user's terminal agent is the primary operator of this tool. Docs lead with "paste this to your agent"; raw-CLI usage is documented as a secondary reference.
- The CLI stays fully deterministic: parsing, schema validation, rendering, tracking, auditing. It never makes network calls to LLM providers and requires no API key.
- Semantic work — reading job postings, drafting role configs, interviewing the candidate, writing study guides — is done by whatever agent the user already has, following vendor-neutral **playbooks** in `docs/playbooks/`.
- **Schema validation is the contract**: an agent hands the CLI structured JSON; the CLI validates it (including the evidence-backed claim audit) and rejects anything malformed or unsupported by evidence. Agent quality can vary; the deterministic gate is what keeps output trustworthy.

### Consequences

- Good: works identically with any agent vendor; no keys, no plugin matrix, no second code path.
- Good: claim safety is enforced by deterministic code, not by trusting the agent.
- Bad: no fully-unattended one-command pipeline (a human-plus-agent is always in the loop) — accepted, since the tool assumes an agent-driving user and resumes should be human-reviewed before sending anyway.
- Bad: playbook prose becomes load-bearing interface documentation and must be kept in sync with CLI behavior; design plan 0001 D9 exercises every playbook end-to-end as a regression check.
