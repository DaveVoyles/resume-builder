# 0002 — Q&A debrief feedback loop and follow-up reminders

**Status:** Approved 2026-07-20 (in-chat confirmation; design-plans waiver — all deliverables XS/S, traces to this session's grilling with no open architectural questions)
**Date:** 2026-07-20
**Repo:** github.com/DaveVoyles/resume-builder (public)

## Problem Statement

Candidates using this tool have no structured way to (a) capture how a Q&A session actually
went — a real employer interview, the grill intake, an interview-prep study-guide walkthrough —
and get help drafting a better answer for next time, or (b) get nudged about routine post-status
follow-ups (a thank-you after an interview, a check-in after applying, responding to an offer).
Both currently rely purely on the candidate's own memory. Two independent, small features close
these gaps by extending existing conventions rather than introducing new architecture.

## Decisions (settled by grilling, 2026-07-20)

1. **Feature 1 scope:** a general Q&A feedback mechanism, not tied to one lifecycle stage — it
   applies equally to grill intake, real employer interviews, study-guide prep, and tailor
   conversations.
2. **Feature 1 shape:** a new standalone playbook (`docs/playbooks/debrief.md`), invoked on
   demand. Existing playbooks (`grill.md`, `study-guide.md`, `tailor.md`) are not modified.
3. **Feature 1 storage:** a new private workspace ledger, `feedback.jsonl` (JSON Lines, same
   pattern as `evidence.jsonl`): schema version, context type, an optional link to a tracked
   role, the question, the answer, a sentiment rating plus free-text note, the AI's proposed
   improved answer, and a timestamp.
4. **Feature 1 timing:** the improved-answer proposal happens immediately, in the same debrief
   session as the capture — there is no automatic resurfacing of past feedback baked into other
   playbooks in v1.
5. **Feature 1 out of scope:** debrief entries never write back into `evidence.jsonl` or
   `profile.json` — surfacing new resume-worthy material from a debrief stays a manual follow-up
   via the existing ingest/grill flow.
6. **Feature 2 scope:** follow-up reminders are driven entirely by the existing `set-status`
   command's status transitions — no new CLI command and no new schema file. They reuse the
   tracked-role `nextAction` object that the tracker renderer already reads and displays, so a
   reminder surfaces for free the next time the tracker is rebuilt or viewed.
7. **Feature 2 rule table:** a fixed, built-in default (not candidate-configurable in v1) —
   `applied` → due in 7 days ("check in if no response"); `interview` → due in 1 day ("send
   thank-you"); `offer` → due in 2 days ("respond to offer"); `rejected`/`withdrawn` → next
   action cleared to `close`; `interested` → left untouched.
8. **Feature 2 overwrite behavior:** a status transition always overwrites any existing
   `nextAction` — the same "transition wins" pattern `set-status` already uses elsewhere. This is
   distinct from `appliedAt`, which stays historically preserved and is untouched by this change.
9. **Feature 2 vocabulary:** reuses the existing `nextAction.type: "follow-up"` enum value for
   every reminder kind; no new enum values are added. The thank-you/check-in/respond-to-offer
   distinction lives in a note appended to the role's `notes` array, not in the type field.

No ADR-worthy decisions surfaced — both features extend existing patterns (the playbook+ledger
convention from grill/evidence; the `nextAction` convention already in the tracked-role schema)
rather than introducing a new hard-to-reverse trade-off.

## Deliverables

| # | Deliverable | Size | Acceptance Criteria | Dependencies | Status |
|---|---|---|---|---|---|
| D1 | Q&A debrief playbook + `feedback.jsonl` schema and validation | S | `docs/playbooks/debrief.md` walks the agent through capturing context/question/answer/sentiment and proposing an improved answer in the same session, then writing the entry to `feedback.jsonl`, matching the one-question-at-a-time style of `grill.md`/`tailor.md`; the schema (schemaVersion, context enum, optional relatedRoleId, question, answer, sentiment enum + sentimentNote, proposedAnswer, createdAt) is documented in `docs/workspace-schemas.md`; `scripts/check-workspace.js` validates `feedback.jsonl` the same lightweight way it validates `evidence.jsonl` today (optional file; each non-empty line must be valid JSON with the required fields; a malformed line is reported with its line number); `docs/candidate-workspace.md` lists `feedback.jsonl` under private-by-default files; README's "What this creates" bullet list gains one entry; node:test coverage added for the new validator path | — | Todo |
| D2 | `set-status` auto-proposes follow-up reminders on status transitions | XS | `set-status` sets `role.nextAction` per the fixed rule table in Decision 7 immediately after updating `application.status`, always overwriting any prior `nextAction` (Decision 8), reusing `nextAction.type: "follow-up"` throughout (Decision 9) with the specific reminder text appended to `role.notes`; the existing `appliedAt` preservation logic is untouched; `docs/workspace-schemas.md`'s `roles.tracked.json` section documents the auto-`nextAction` behavior and its rule table; existing `set-status.test.js` is extended with fixture cases covering each status's auto-`nextAction` value, the always-overwrite behavior against a pre-existing custom `nextAction`, and confirmation that `appliedAt` handling is unaffected | — | Todo |

Both deliverables are XS/S: build-ready, no decomposition required, and independent of each
other (either order, or parallel).

## Testing Decisions

- **Framework:** `node:test`, matching the repo's existing zero-dependency test setup.
- **D1 seam:** `scripts/check-workspace.js`'s new `feedback.jsonl` validation path — fixture
  cases for a valid entry (passes), a missing required field (fails with a clear message), and a
  malformed JSON line (fails, reporting the line number) — mirroring how `evidence.jsonl`
  validation is already covered. The playbook itself is prose; verified by walking it once
  against the fictional sample candidate and capturing the transcript, the same way `grill.md`
  and `study-guide.md` were verified in plan 0001.
- **D2 seam:** `set-status.js`'s new auto-`nextAction` logic in the existing
  `src/cli/commands/set-status.test.js` — fixture tracked-role objects run through each status
  transition, asserting the resulting `nextAction` and appended `notes` entry; one case with a
  pre-existing custom `nextAction` proving the overwrite; one case confirming `appliedAt` is
  unaffected by the new logic.

## ⚠️ Irreversible Steps

None. Both deliverables are additive schema and logic changes — a new optional workspace file
and new fields/behavior on an already-optional `nextAction` object. No deletions, data
migrations, secret rotations, or external sends.

## Out of Scope

- Writing debrief insights back into `evidence.jsonl`/`profile.json` (Decision 5).
- Candidate-configurable reminder cadence via `preferences.json` — the rule table is fixed in v1
  (Decision 7).
- New `nextAction.type` enum values (e.g. distinct `thank-you`/`check-in` values) — reuses the
  existing `follow-up` value (Decision 9).
- Automatic resurfacing of past debrief feedback inside other playbooks (`grill.md`,
  `study-guide.md`) — capture and proposal are both manual/on-demand in v1 (Decision 4).
- A new `workspace:reminders` scan command — the existing tracker rebuild already surfaces
  `nextAction` (Decision 6).

## Execution Tracking

Exported 2026-07-20 via plan-to-issues (second Lavish preview waived — 1:1 with the approved
deliverable table, no new slicing decisions).

- **Issues (the frontier):** https://github.com/DaveVoyles/resume-builder/issues?q=is%3Aissue+state%3Aopen+label%3Aplan%3A0002 — D1 is [#29](https://github.com/DaveVoyles/resume-builder/issues/29), D2 is [#30](https://github.com/DaveVoyles/resume-builder/issues/30). Both are dependency-free and open immediately.
- **Board:** Agent Work (Projects v2) — https://github.com/users/DaveVoyles/projects/2 — both slices seeded to Todo.
- The frontier rule is: open + `plan:0002` + no open blockers + unassigned.
- This plan doc itself (plus the `CONTEXT.md` glossary entry) is [PR #28](https://github.com/DaveVoyles/resume-builder/pull/28) — merged 2026-07-20.

**Status (2026-07-20):** Complete. D1 ([#29](https://github.com/DaveVoyles/resume-builder/issues/29), [PR #35](https://github.com/DaveVoyles/resume-builder/pull/35)) and D2 ([#30](https://github.com/DaveVoyles/resume-builder/issues/30), [PR #36](https://github.com/DaveVoyles/resume-builder/pull/36)) both merged and closed, board cards auto-flipped to Done. Both PRs required Dave's manual merge — this repo lacks `scripts/review-lens-receipt.sh`, so the autonomous `land-pr.sh` approve/merge path isn't wired up here; `gh pr merge` itself was also denied by the session's permission system on every attempt (3/3: #28, #35, #36). Frontier is dry.
