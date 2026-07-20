# 0001 — Feature parity with the private builder (agent-first)

**Status:** Approved 2026-07-19 (Lavish review + in-chat confirmation of the ⚠️ irreversible step)
**Date:** 2026-07-19
**Repo:** github.com/DaveVoyles/resume-builder (public)
**Companion ADR:** [0001 — Agent-operated CLI](../decisions/0001-agent-operated-cli.md)

## Problem Statement

The public resume-builder was forked from Dave's private builder and has since fallen behind it. The private repo proved out an end-to-end workflow the public repo only partially delivers: drop in your docs → build a profile → structured intake interview → find and vet roles → tailor an evidence-backed resume per job posting → track every application on a dashboard → update status by telling the agent → generate interview study guides.

A July 2026 audit found the public repo already covers ingestion (adapters + evidence ledger), role scoring (`find-similar`), and the HTML/markdown tracker — but has **no resume generation at all** (its README says so explicitly), no packaged intake interview, no leads/search pipeline, no one-command status updates, no study guides, and no end-to-end narrative showing how the pieces compose. The existing `docs/generator-refactor-plan.md` in the public repo describes the intended modular generation architecture but was never implemented; this plan implements its intent by porting the private repo's battle-tested engine (proven across 74 role configs) rather than building greenfield.

## Decisions (settled by grilling, 2026-07-19)

1. **Scope:** tailored DOCX pipeline, grill intake, leads pipeline, status-update flow, study guides, E2E docs revamp. PDF export deferred.
2. **Agent-operated CLI posture** *(ADR 0001, updated at review)*: the tool assumes the user has **some LLM agent at all times** — the agent is the primary operator, and the CLI is the agent's deterministic toolbelt. The CLI never calls an LLM; any terminal agent (Copilot CLI, Claude, ChatGPT, …) does the semantic work by following packaged **playbooks** (vendor-neutral markdown instruction docs) and hands schema-validated JSON to the CLI. Schema validation is the contract between agent and CLI. Humans *can* run the CLI raw, but docs and UX no longer optimize for that path. Preserves the repo's "vendor-agnostic, no API key required" promise.
3. **Port, don't rebuild:** the private template engine (renderer, docx helpers, config schema + validation) is ported and scrubbed, shipping with one fictional sample role config.
4. **Grill ships as playbook + thin adapters:** one vendor-neutral playbook is the source of truth; a thin `.claude/skills` adapter and an AGENTS.md section point at it.
5. **Leads stay lightweight** *(descoped at review — Dave rated find-roles the least useful feature)*: no new CLI commands or schema machinery. A `lead` (prospective role, pre-application) is a plain agent-maintained workspace file documented in the schemas doc, plus a short search/vetting playbook (remote/location/salary/red-light rules, live-link verification). Sequenced last among the feature slices.
6. **Study guides:** deterministic context-bundle CLI + playbook; no local server, no API endpoint.
7. **Status updates:** a CLI command with an explicit status enum replaces free-text status strings; an agent recipe maps "I was denied for X" to one command.
8. **Claim guards block:** the ported claim audit runs against the evidence ledger inside `validate` and fails on unsupported claims — making the "evidence-backed" brand enforceable and deterministic.
9. **E2E showcase:** README rewritten around the lifecycle, agent-always framing ("paste this to your agent" is the primary path); the `npm start` sample exercises the full loop including a rendered sample DOCX; flow diagram + screenshots included.
10. **This plan and its public-repo issues live in the public repo**, scrubbed of personal data; the private repo is referenced only as "the upstream private implementation."
11. **Private-repo docs refresh** *(added at review)*: the private upstream repo also gets its docs updated to reflect the current end-to-end workflow, with workflow visualizations. Docs-only; its issue is filed in the private repo.

## Deliverables

| # | Deliverable | Size | Acceptance Criteria | Dependencies | Status |
|---|---|---|---|---|---|
| D1 | Docs conventions + agent-always framing pass | XS | `docs/playbooks/` directory established with a README stating the playbook convention (vendor-neutral, agent-operated); existing docs (`AGENTS.md`, `getting-started.md`) updated to reference ADR 0001's agent-always posture; note: the plan doc, ADR 0001, and `CONTEXT.md` glossary are persisted by the planner's own PR, not this deliverable | — | Todo |
| D2 | DOCX render pipeline (engine port + `render-resume` command) | M | Ported engine renders a schema-validated role config to `outputs/resumes/<Company>/<file>.docx`; fictional sample config included and rendered by the sample workflow; schema documented in `docs/workspace-schemas.md`; independent redaction grep of ported code passes; `node:test` coverage for schema validation + render seam; `docs/generator-refactor-plan.md` updated to point here | D1 | Todo |
| D3 | Evidence-backed claim audit in `validate` | S | `validate` fails when a role config makes a claim (metric/skill) with no supporting `evidence.jsonl` entry; clear per-claim error output; fixture-based pass/fail tests; `docs/accuracy-and-claims.md` updated | D2 | Todo |
| D4 | Tailor workflow (JD → role config → resume → tracker row) | M | `docs/playbooks/tailor.md` walks an agent from job posting to drafted role config; a `tailor` CLI step validates the config, renders the DOCX, and registers the tracked role in one pass; new entries always land un-applied (human reviews before sending); end-to-end run on the sample candidate documented and tested | D2, D3 | Todo |
| D5 | Grill intake playbook + thin skill adapter | S | `docs/playbooks/grill.md` covers work history, target role, location, salary, constraints — one question at a time, answers written to profile/preferences/evidence; `.claude/skills/grill` adapter + AGENTS.md section reference it; sample intake transcript included in docs | D1 | Todo |
| D6 | Leads playbook (find-roles, lightweight) | S | `docs/playbooks/find-roles.md`: agent searches per profile, vets against rules in `preferences.json` (remote/location/salary/red-light, verify links live), maintains `leads.json` as a plain workspace file, and moves an accepted lead into tracked roles via existing `add-role`; `leads.json` shape documented in `docs/workspace-schemas.md`; no new CLI code | D1, D5 | Todo |
| D7 | `set-status` command + agent status recipe | S | `set-status` CLI matches a tracked role by company/role, sets an enum status (interested/applied/interview/offer/rejected/withdrawn) with date stamp, and rebuilds the tracker; AGENTS.md carries the "I was denied for X" one-liner recipe; fixture tests | D1 | Todo |
| D8 | Study-guide context bundle + playbook | S | A CLI command gathers profile, evidence, the role's config, and JD reference into one context bundle under `outputs/`; `docs/playbooks/study-guide.md` directs the agent to write the guide to `outputs/study-guides/<company>/`; sample run documented | D2 | Todo |
| D9 | E2E showcase (README lifecycle + extended sample + visuals) | M | README rewritten around the full lifecycle with agent-always framing (the "paste this to your agent" path is the front door; raw-CLI usage moves to a secondary reference page); `npm start` sample renders the sample DOCX + tracker end-to-end; flow diagram (archify-generated SVG) + tracker/resume screenshots embedded; CI green; **prose is human-reviewed — no auto-merge** | D2–D8 | Todo |
| D10 | Private-repo E2E docs refresh (upstream) | S | Private upstream repo's README + architecture doc updated to reflect the current end-to-end workflow (ingest → tailor → track → status → study guides) with an archify-generated workflow diagram embedded; docs-only change; issue filed in the private repo | — (parallel-safe) | Todo |

All deliverables are XS–M: build-ready, no decomposition required.

## Testing Decisions

- **Framework:** `node:test` (matches both repos' zero-dependency posture); tests run in CI via the existing validate workflow.
- **Fixture workspaces:** tests operate on the fictional sample candidate or throwaway temp-dir workspaces — never real candidate data.
- **Render seam (D2, D4):** golden checks on generated DOCX — file exists at the expected per-company path and its extracted text contains expected strings from the config.
- **Claim-audit seam (D3):** fixture pairs of (role config, evidence ledger) covering supported-claim pass, unsupported-claim fail, and thin-ledger warning copy.
- **Workspace-mutation seam (D7):** `set-status` tested against temp fixture workspaces, asserting JSON state before/after and tracker rebuild. (D6 ships no CLI code — its playbook is exercised in D9.)
- **Redaction seam (D2, all ported code):** the privacy checker gains a deny-list grep for private-repo-specific terms (names, companies applied to, machine names); run per-PR in CI. Reviewing sessions independently re-run it rather than trusting a subagent's self-report.
- **Playbook seams (D4, D5, D6, D8):** playbooks are prose — verified by executing each one against the sample candidate during D9 and capturing the transcript/output in docs.

## ⚠️ Irreversible Steps

- **Publishing ported private-repo-derived code and docs to the public repo.** Every merge on this plan is a public disclosure; `git revert` removes code from HEAD but does not un-publish history. Mitigation: the redaction seam above (deny-list grep + extended privacy checker in CI, independently re-run by the reviewing session) gates every PR; the sample candidate remains fictional.

No deletions, data migrations, secret rotations, or external sends beyond the public pushes above.

## Out of Scope

- PDF export (deferred — adds a LibreOffice system dependency).
- Local server, API endpoints, or dashboard write-back buttons.
- Multiple visual resume templates (possible follow-up release).
- Headless-LLM integration of any kind (`claude -p` etc.) — contradicts ADR 0001.
- Code changes to the private upstream repo (D10 is docs-only).
- New leads CLI commands or schema validation (descoped at review; leads stay an agent-maintained file).

## Execution Tracking

Exported 2026-07-19 via plan-to-issues (second Lavish preview waived — 1:1 with the approved deliverable table).

- **Issues (the frontier):** https://github.com/DaveVoyles/resume-builder/issues?q=is%3Aissue+state%3Aopen+label%3Aplan%3A0001 — D1–D9 are [#5](https://github.com/DaveVoyles/resume-builder/issues/5), [#6](https://github.com/DaveVoyles/resume-builder/issues/6), [#9](https://github.com/DaveVoyles/resume-builder/issues/9), [#12](https://github.com/DaveVoyles/resume-builder/issues/12), [#7](https://github.com/DaveVoyles/resume-builder/issues/7), [#10](https://github.com/DaveVoyles/resume-builder/issues/10), [#8](https://github.com/DaveVoyles/resume-builder/issues/8), [#11](https://github.com/DaveVoyles/resume-builder/issues/11), [#13](https://github.com/DaveVoyles/resume-builder/issues/13) (in D-order); D10 is filed in the private upstream repo (its issue #27) under label `plan:0001-public`.
- **Board:** Agent Work (Projects v2) — https://github.com/users/DaveVoyles/projects/2 — all ten slices seeded to Todo.
- Native GitHub blocked-by relationships mirror the Dependencies column; the frontier rule is: open + `plan:0001` + no open blockers + unassigned.

**Status (2026-07-20):** D1–D8 and D10 merged and closed. D9 ([#13](https://github.com/DaveVoyles/resume-builder/issues/13), [PR #24](https://github.com/DaveVoyles/resume-builder/pull/24)) is technically verified (tests, CI, redaction, visuals all clean — see the orchestrator's PR comment) and deliberately held open for Dave's manual prose review per Decision 9's human-review exception — not auto-merged. Frontier is otherwise dry.
