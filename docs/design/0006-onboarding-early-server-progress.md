# Plan 0006: Onboarding — early server start + live progress

- Status: approved
- Date: 2026-07-21
- Source: grilling session following the #111–#121 dogfooding round

## Problem Statement

A new candidate has no visible sign the tool is "working" until the entire
grill interview is done and `build-tracker` produces a dashboard. `serve`
exists but is manual, and 404s until a tracker file exists. Grill's seven
sections carry no "how much is left" signal anywhere — not in chat, not on
any page. This plan makes onboarding feel alive from the first command: a
browser tab opens automatically at setup, fills in as the candidate
progresses, and refreshes itself — while chat narrates section-by-section
progress in parallel.

Scope is deliberately narrow: onboarding completeness only (setup → ingest
→ grill → first role). Ongoing role-application progress (applied /
interview / offer funnel) is already owned by the stat cards PR #126
shipped, and is explicitly not touched here. A broader "is the platform
user-friendly" audit was raised in the same conversation and deliberately
deferred to a future round.

## Architecture note

[ADR 0003](../decisions/0003-optional-local-server-supersedes-0002.md)
narrowly supersedes [ADR 0002](../decisions/0002-static-generated-html-only-ui-surface.md):
`tracker.html` remains the generated artifact of record; the only new
capability is that the existing `serve` command may auto-launch and expose
a minimal, read-only change-detection signal for self-refresh. No SPA, no
backend application state, no API keys — ADR 0001 and ADR 0002's core
stance both hold.

## User Stories

1. As a new candidate, when I run `npm run setup`, a browser tab opens
   automatically showing my (empty) onboarding checklist, so I know the
   tool is working before I've done anything else.
2. As a candidate going through the grill interview, I see "Section 3 of 5:
   Location" in chat and watch my open tab's checklist tick that box on its
   own, so I always know how much is left.
3. As a candidate who has completed onboarding, my tab flips to the normal
   dashboard with a small "Onboarding complete" pill, so the checklist
   doesn't linger once it's done its job.

## Deliverables

| Deliverable | Size | Acceptance Criteria | Dependencies | Status |
|---|---|---|---|---|
| D1 — Onboarding-state tracking | S | A new onboarding-state file is created at setup with every step pending. Material ingestion marks its step complete. Each of grill's seven per-section write instructions is extended to also mark that section complete and trigger a tracker rebuild, so the checklist reflects progress promptly rather than only at the very end. The first role being added marks the final step complete, piggybacking on the existing rebuild that already happens at that point. The new file's shape is schema-validated. The onboarding playbook references the file as the mechanical backing for its existing manual state checks, without replacing them. | None | Not started |
| D2 — Chat narration | XS | Each of grill's seven sections gains an explicit "Section N of 7: <name>" marker at its start. The sample transcript shows at least one example of it in context. | None | Done |
| D3 — Early server + empty tracker.html | S | Setup writes an initial tracker page (all onboarding steps pending, via D5's shared render path) instead of leaving it absent, and automatically launches the local server, opening a browser tab. If a server is already running on the configured port, it is detected and reused rather than erroring. A flag exists to skip the auto-open for CI/automation contexts. | — | Not started |
| D4 — Live reload via polling | S | The local server exposes a small, read-only signal reflecting whether generated output has changed since last checked. The tracker page's existing embedded client script polls it periodically and reloads the page when it has, without requiring a manual refresh. Mechanism is polling (not push/SSE), per ADR 0003. | D3 | Not started |
| D5 — Onboarding checklist view | M | A shared, reusable render function produces the onboarding checklist (each step's status plus an overall completion count) from the onboarding-state file, and is used both by the tracker build step and by initial setup. While onboarding is incomplete, the tracker page shows this checklist in place of the roles table and stat cards. Once every step is complete, the page shows today's normal dashboard, with the checklist collapsed into a small persistent progress indicator in the page header. New visual elements follow the tracker's existing color palette and badge/pill conventions rather than introducing a new style language. | D1, D3 | Not started |

## Testing Decisions

- **D1**: fixture-based unit tests for the new schema validator, mirroring
  existing schema-test conventions; a build-step test confirming a rebuild
  triggered by grill's hook reflects the updated state.
- **D2**: doc-only; no automated test. Verified by reading the updated
  sample transcript.
- **D3**: a test confirming setup triggers a server-launch attempt (mocked,
  since tests cannot spawn a real browser) and that the attempt is
  idempotent against an already-running instance.
- **D4**: a `node:vm`-based test on the embedded client script, following
  the same execution-harness pattern already established for the tracker's
  client-side behavior — simulate two poll responses with different
  change-signals and assert that a reload was triggered.
- **D5**: fixture-based renderer tests covering both the checklist-shown
  and dashboard-shown states, plus the collapse-to-pill behavior, following
  the existing renderer test conventions (isolate a single rendered cell or
  region rather than asserting on ambiguous whole-page text).

## ⚠️ Irreversible Steps

None. A new local-only state file, a superseding (not destructive) ADR, and
additive changes to the generated-artifact model. No data deletion, no
migration, no external sends. Auto-launching a browser is a reversible,
flaggable default, not a destructive action.

## Out of Scope

- Ongoing role-application progress (applied / interview / offer funnel) —
  already owned by PR #126's stat cards; no overlap, no merge.
- SSE or other push-based live updates — polling was chosen instead (ADR
  0003).
- Richer live-editing or in-app interactivity — ADR 0002's "no SPA, no
  backend state" stance remains intact beyond this narrow amendment.
- Resuming an interrupted grill session by reading onboarding-state back —
  a natural future extension, not decided here.
- A broader "is the platform user-friendly" audit beyond these two ideas —
  explicitly deferred to a future round.

## Execution Tracking

- Issues: https://github.com/DaveVoyles/resume-builder/issues?q=is%3Aissue+state%3Aopen+label%3Aplan%3A0006
- Board: https://github.com/users/DaveVoyles/projects/2 ("Agent Work", Todo column)
