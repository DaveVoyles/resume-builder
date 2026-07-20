# Handoff

**Two plans designed and exported this session — no code implemented yet for either.** Both
grilled via `/grilling`, persisted via `design-plans` (waiver used both times: every deliverable
XS/S, traced to this session's grilling, no open architectural questions).

## Plan 0002 — Q&A debrief + follow-up reminders
- Plan doc: `docs/design/0002-qa-debrief-and-followup-reminders.md`.
- `CONTEXT.md` gained the `debrief` glossary term.
- D1 [#29](https://github.com/DaveVoyles/resume-builder/issues/29), D2
  [#30](https://github.com/DaveVoyles/resume-builder/issues/30) — both `plan:0002`,
  dependency-free, seeded to the Agent Work board's Todo column.

## Plan 0003 — Interactive, state-aware onboarding
- Plan doc: `docs/design/0003-interactive-onboarding.md`. Corrects Dave's original "/docs folder"
  framing to the real `candidate/inputs/` convention (verified against the actual ingest code).
- D1 [#31](https://github.com/DaveVoyles/resume-builder/issues/31) — links.md fix, unblocked.
- D2 [#32](https://github.com/DaveVoyles/resume-builder/issues/32) — onboarding playbook, blocked
  by D1.
- D3 [#33](https://github.com/DaveVoyles/resume-builder/issues/33) — doc sync, blocked by D1, D2.
- All three `plan:0003`, native GitHub blocking relationships wired, seeded to the board.

## Both plans share one PR
[PR #28](https://github.com/DaveVoyles/resume-builder/pull/28) carries both plan docs, the
`CONTEXT.md` entry, and this file — **open, needs manual merge.** This repo is missing
`scripts/review-lens-receipt.sh`, so the usual autonomous `land-pr.sh` auto-approve/merge path
isn't available here; the self-review gate was applied by hand (both diffs docs-only, trivially
clean) rather than through the real script.

## Next step

1. 🙋 Dave (or someone with merge rights) merges PR #28 by hand.
2. A fresh orchestrator session claims issues off the board and implements per each plan — see
   the paste-ready hand-off statements delivered in chat (one per plan).
3. Longer-term, low-priority: this repo has no `scripts/review-lens-*.sh` toolchain, so
   self-review and auto-merge are done by hand here rather than through the real automation —
   worth wiring up if this repo starts shipping PRs at a higher cadence.
