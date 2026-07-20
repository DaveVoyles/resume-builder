# 0003 — Interactive, state-aware onboarding

**Status:** Approved 2026-07-20 (in-chat confirmation; design-plans waiver — all deliverables
XS/S, traces to this session's grilling with no open architectural questions)
**Date:** 2026-07-20
**Repo:** github.com/DaveVoyles/resume-builder (public)

## Problem Statement

A new user's first-run experience today depends entirely on them reading `README.md`/`AGENTS.md`
and self-directing. `AGENTS.md` has a fixed linear checklist with no state-awareness — the same
steps are assumed every session regardless of workspace state — `docs/getting-started.md` never
mentions grill intake at all, and there is no proactive "you have a workspace but haven't dropped
any docs in yet" or "your docs are in but you haven't done intake yet" behavior anywhere. Dave
wants the agent to proactively and interactively guide a first-time user through workspace setup,
then dropping in real documents, then grill intake — explaining along the way that more
information means better resumes and role matches.

## Decisions (settled by grilling, 2026-07-20)

1. **Shape:** a new standalone playbook, `docs/playbooks/onboarding.md`, matching the existing
   `grill.md`/`tailor.md`/`find-roles.md` convention. Root `AGENTS.md`'s current fixed "Default
   workflow" checklist is replaced with a short pointer to the new playbook for the
   first-run/intake-sequencing part specifically. Lifecycle-wide reminders that aren't
   onboarding-specific (ask clarifying questions before making resume claims; always run
   `validate`/`check:privacy` before finalizing) stay in `AGENTS.md` — they apply throughout the
   lifecycle, not just at first launch.
2. **Scope depth:** the playbook's proactive state-detection covers workspace-init →
   drop-docs → ingest → grill intake only. It does not extend the same treatment further into
   find-roles/tailor/tracker stages in v1 — those are already adequately documented lifecycle
   stages that don't need this first-run treatment.
3. **Fix the `inputs/links.md` gap as part of this work:** `docs/candidate-workspace.md` already
   documents a `candidate/inputs/links.md` file (for portfolio/GitHub/writing/talk links), but the
   CLI never actually scaffolds or reads it — a pre-existing doc/implementation gap. Fixed now,
   small: workspace init scaffolds `inputs/links.md` with a simple one-link-per-line template
   (same low-effort pattern as `inputs/notes/intake.md`), and `ingest` gains a small, real path for
   it reusing the existing text-ingestion adapter (no bespoke link-parsing needed). This lets the
   onboarding playbook honestly tell users there are four real ways to hand the agent material:
   resumes, notes, links, and a GitHub username.
4. **Interaction style:** one step at a time, waiting for the user's confirmation before
   advancing — mirrors `grill.md`'s own established "ask one question at a time, wait for the
   answer" convention. Flow: greet (state-dependent) → explain step 1 (drop resumes/notes/links
   into the workspace, or share a GitHub username) → wait for confirmation or a "help me" ask →
   offer to run ingest → wait → proactively suggest starting grill intake, explicitly framed with
   "the more information I have, the better the resumes I can generate and roles I can find" →
   hand off to the grill playbook.
5. **Trigger condition:** a workspace-state check (does the candidate workspace exist? are the
   input folders still just their scaffolded template state, i.e. nothing real added? is the
   evidence ledger still empty, i.e. nothing ingested yet? does the profile still equal the
   default scaffold, i.e. no experience entries yet?) runs at the start of any session in this
   repo. The proactive greeting only fires when that state indicates onboarding is incomplete — a
   returning candidate with a populated profile isn't interrupted with onboarding messaging when
   they ask for something specific.
6. **Doc sync:** `README.md`'s lifecycle table stage 1 ("Drop in docs") and its "Start here"
   paste-to-agent prompt are corrected to reference the real candidate inputs folder (not a
   generic `/docs` folder) and point at the new onboarding playbook. `docs/getting-started.md`
   (currently doesn't mention grill intake at all) is updated to reference both the real inputs
   folder and the grill step. `docs/candidate-workspace.md` and `docs/workspace-schemas.md` are
   updated so `links.md` is documented as an actually-implemented file, not an aspirational one.

No ADR-worthy decisions surfaced — this extends the existing playbook convention (grill/tailor/
find-roles all follow this same "playbook + thin doc pointers" shape) to a new area rather than
introducing new architecture. No new domain-glossary term either — "onboarding" isn't
project-specific vocabulary the way "lead"/"tailor"/"debrief" are.

## Deliverables

| # | Deliverable | Size | Acceptance Criteria | Dependencies | Status |
|---|---|---|---|---|---|
| D1 | `links.md` scaffolding + ingest support | XS | Workspace init scaffolds `candidate/inputs/links.md` (idempotent, not overwritten if present) with a short one-link-per-line template; `ingest` gains a `--links <file>` option that reuses the existing text-ingestion adapter path (same as `--notes`/`--resume`), tagging entries with a `links` evidence type; `docs/candidate-workspace.md` and `docs/workspace-schemas.md` are updated so `links.md` and the `--links` flag are documented as implemented, not aspirational; new node:test coverage (a new fixture-based test file, since `ingest` has no existing test coverage) verifies a `--links` file is ingested into the evidence ledger with the correct type | — | Todo |
| D2 | Onboarding playbook (`docs/playbooks/onboarding.md`) | S | New playbook follows the structural convention of `grill.md`/`tailor.md`; documents the four-state workspace check from Decision 5 and what the agent says/does in each state; implements the one-step-at-a-time flow from Decision 4 (greet → drop-docs step → wait → offer ingest → wait → proactively suggest grill with the "more info" pitch → hand off to `grill.md`); includes an explicit short-circuit so a returning candidate with a populated profile is never shown onboarding messaging; root `AGENTS.md`'s "Default workflow" section is replaced with a short pointer to this playbook for first-run sequencing, while its lifecycle-wide reminders (clarifying questions before claims, validate/check:privacy before finalizing) remain untouched; verified by walking the playbook once against a brand-new throwaway workspace (not the fictional sample candidate, which already has a populated profile) to actually exercise the empty-state greeting, with the transcript captured in docs | D1 | Todo |
| D3 | Doc sync (README + getting-started) | XS | `README.md`'s lifecycle table stage 1 and "Start here" paste-to-agent prompt reference the real candidate inputs folder (not a generic `/docs` folder) and point at the new onboarding playbook; `docs/getting-started.md` gains an explicit grill-intake step (currently absent entirely) referencing the real inputs folder and the onboarding playbook; a repo-wide grep confirms no remaining doc tells users to drop candidate material into the project's own `docs/` folder | D1, D2 | Todo |

All deliverables are XS/S: build-ready, no decomposition required.

## Testing Decisions

- **Framework:** `node:test`, matching the repo's existing zero-dependency test setup.
- **D1 seam:** a new fixture-based test file covering the `ingest` command's `--links` path —
  there is no existing test coverage for `ingest` today, so this is new coverage, not an
  extension. Fixture: a temp workspace with a `links.md` file, asserting the resulting evidence
  ledger entry has the expected type and content.
- **D2 seam:** the playbook is prose (like `grill.md`); verified by walking it once against a
  fresh throwaway workspace — never the fictional sample candidate, since its profile is already
  populated and would never trigger the empty-state greeting — and capturing the transcript in
  docs, the same convention plan 0001's D5/D8 and plan 0002's D1 used.
- **D3 seam:** prose-only; verified by the repo-wide grep named in its acceptance criteria plus a
  read-through for accuracy against D1/D2's actual behavior.

## ⚠️ Irreversible Steps

None. All three deliverables are additive: a new scaffolded file, a new CLI flag, a new playbook,
and doc corrections. No deletions, data migrations, secret rotations, or external sends.

## Out of Scope

- Extending proactive state-detection beyond workspace-init → drop-docs → ingest → grill (find-
  roles, tailor, and tracker stages keep their current, adequate documentation) — Decision 2.
- Any runtime hook inside the CLI itself for "detecting first launch" — the CLI never calls an
  LLM and has no session-start hook of its own (ADR 0001); all proactive behavior is instructions
  the terminal agent follows from files it reads at session start.
- Candidate-configurable onboarding behavior (e.g. an opt-out flag) — not requested, and the
  short-circuit for returning candidates with a populated profile already avoids the main
  annoyance case.

## Execution Tracking

Exported 2026-07-20 via plan-to-issues (second Lavish preview waived — 1:1 with the approved
deliverable table, no new slicing decisions).

- **Issues (the frontier):** https://github.com/DaveVoyles/resume-builder/issues?q=is%3Aissue+state%3Aopen+label%3Aplan%3A0003 — D1 is [#31](https://github.com/DaveVoyles/resume-builder/issues/31) (unblocked), D2 is [#32](https://github.com/DaveVoyles/resume-builder/issues/32) (blocked by D1), D3 is [#33](https://github.com/DaveVoyles/resume-builder/issues/33) (blocked by D1, D2). Native GitHub issue-dependency relationships mirror the Dependencies column.
- **Board:** Agent Work (Projects v2) — https://github.com/users/DaveVoyles/projects/2 — all three slices seeded to Todo.
- The frontier rule is: open + `plan:0003` + no open blockers + unassigned — so only D1 is actually claimable until it closes.
- This plan doc, plus plan 0002's plan doc, the `CONTEXT.md` glossary entry, and `HANDOFF.md` are all on [PR #28](https://github.com/DaveVoyles/resume-builder/pull/28) — open, awaiting manual merge (this repo lacks `scripts/review-lens-receipt.sh`, so the usual autonomous `land-pr.sh` auto-merge path isn't available here).
