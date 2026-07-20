# 0005 — Selective lucidRESUME Adoption: Pipeline Staleness, Gap Taxonomy, Tailoring Quality, Dashboard Refresh

Status: Approved 2026-07-20 (Lavish review, verdict "Approved — persist and hand off")
Date: 2026-07-20
Companion ADR: 0002 — Static generated HTML remains the only UI surface
Credit: Feature concepts in this plan are adapted from Scott Galloway's
[lucidRESUME](https://github.com/scottgal/lucidRESUME) (released under the
Unlicense). Attribution is voluntary and deliberate — see D9.

## Problem Statement

lucidRESUME demonstrates several resume-tooling ideas we lack: a pipeline
that models being ghosted and flags stale applications, a four-type gap
taxonomy that turns a flat "missing keywords" list into actionable advice,
explicit tailoring-quality passes (relevance compression, de-AI style
review), and a dashboard-feel tracker UI. Its implementation (C#/Avalonia
desktop app, ~600MB of local ONNX models) is architecturally incompatible
with our agent-operated, LLM-free Node CLI — but the concepts separate
cleanly from that stack. This plan adopts the concepts while preserving
ADR 0001: the CLI stays deterministic and API-key-free; all semantic work
lands in playbooks; the only UI surface remains generated static files
(companion ADR 0002).

Decisions were settled in a same-session grilling interview (2026-07-20);
this plan synthesizes that decision list.

## Deliverables

| # | Deliverable | Size | Acceptance Criteria | Dependencies | Status |
|---|-------------|------|---------------------|--------------|--------|
| D1 | `ghosted` application status | S | `set-status --status ghosted` accepted; auto-nextAction rule proposed for it (follow-up-or-move-on nudge); status buckets/filters/colors in both tracker renderers show it distinctly; existing statuses unaffected. Ghosted is only ever set manually — no code path auto-transitions to it. | — | Todo |
| D2 | Stale-flag computation in build-tracker | M | Building the tracker computes, per tracked role, a stale flag from its status bucket + last-touch date against per-stage day thresholds; sensible defaults ship in code and are overridable via a workspace preferences setting; each stale role carries days-since-touch and a suggested nextAction (e.g. follow up / consider marking ghosted); flags appear in the markdown tracker output; computation is pure and covered at threshold edges. No state files are mutated — flags are computed at render time only. | D1 | Todo |
| D3 | HTML dashboard: funnel view + stale badges | M | HTML tracker gains a pipeline funnel section (counts per active stage plus terminal outcomes incl. ghosted) and per-row stale badges showing days-since-touch with the suggested nextAction inline; stale rows sortable/filterable; regenerated entirely by build-tracker with no server or external assets. | D2 | Todo |
| D4 | HTML dashboard visual refresh | S | Card-based layout and typography pass over the whole HTML tracker (existing stat cards, table, new funnel) toward a coherent dashboard feel; still a single self-contained generated file; refreshed screenshot in the docs images folder. | D3 | Todo |
| D5 | `gap-report` command | M | New CLI command accepts agent-drafted gap-classification JSON, validates it against a schema (each gap: keyword, one of PresentationGap / WeakEvidence / AdjacentSkill / TrueGap, evidence rationale, recommended action), and renders a markdown gap report into the role's output folder. Advisory only — never blocks a render; `score-keywords` behavior and docs untouched. Invalid classifications fail with actionable errors. | — | Todo |
| D6 | Gap-report playbook + tailor integration | S | New playbook walks the agent through classifying `score-keywords` missing terms into the four gap types with a recommended action each; tailor playbook gains an optional gap-report step; README command table and workspace-schemas doc updated. | D5 | Todo |
| D7 | De-AI style lint | M | Deterministic lint over resume-config and cover-letter-config text: buzzword/cliché wordlist plus sentence-uniformity and repetition heuristics; emits advisory warnings (never blocks) from both `tailor` and `validate`; wordlist maintainable as data, not code; heuristics unit-tested against AI-flavored and human-flavored fixtures. | — | Todo |
| D8 | Tailoring-quality playbook steps | S | Tailor playbook gains (a) a semantic-compression step — from N profile roles, explicitly select the M relevant to the JD, each with a one-line justification, before drafting — and (b) a de-AI rewrite step addressing lint warnings from D7. Playbook README index updated. | D7 | Todo |
| D9 | Attribution & acknowledgements | XS | README gains an Acknowledgements section crediting Scott Galloway's lucidRESUME with a link, thanking the author for open-sourcing it, and encouraging readers to check out that project; each new playbook/doc from this plan carries a one-line credit; plan doc credit (this header) persists. | — | Todo |

All deliverables are XS/S/M — build-ready; no decomposition required.

## Testing Decisions

Per repo convention, all tests use built-in `node --test` with disposable
temp workspaces (the existing test pattern). Agreed seams:

- **D1:** `src/cli/commands/set-status.js` (`VALID_STATUSES`, `NEXT_ACTION_RULES`) + `src/core/role-view.js` (`statusBucket`) — extend `set-status.test.js`; renderer output asserted as strings.
- **D2:** new pure module `src/core/staleness.js` + tests at threshold boundaries (on-threshold, past, missing dates, terminal statuses exempt); wiring asserted via `build-tracker` output.
- **D3/D4:** `src/renderers/html-tracker.js` string assertions (funnel counts, badge markup present); visual refresh verified by screenshot review, not snapshot tests.
- **D5:** new `src/core/gap-report.js` (schema validation, pure) + `src/cli/commands/gap-report.js` + renderer `src/renderers/markdown-gap-report.js`; golden-style markdown assertions; invalid-input error cases.
- **D7:** new pure module `src/core/style-lint.js` with wordlist data file; fixture-pair tests (AI-flavored text triggers warnings, plain text doesn't); advisory wiring asserted in `tailor`/`validate` command output.
- **D6/D8/D9:** docs/playbooks — reviewed, not unit-tested; `npm test` regression suite must stay green for every slice.

## ⚠️ Irreversible Steps

None. Every deliverable is additive code/docs revertible via `git revert`;
no data migrations, deletions, secret changes, or external sends.

## Out of Scope

- Evidence/provenance deepening (skill ledger, strength scores, explain/drift/consistency verbs) — considered and dropped at grilling.
- All local ML (embeddings, NER, layout detection, AI-detector models), sqlite-vec, Docling — explicitly excluded by the user.
- Job-board adapters, IMAP mailbox scanning, JSON Resume export, anonymize command.
- Any served web UI, SPA, or desktop app (ADR 0002); embedding gap reports inside the tracker.
- Auto-transitioning roles to ghosted (staleness only ever suggests).

## Execution Tracking

- Issues: <https://github.com/DaveVoyles/resume-builder/issues?q=is%3Aissue+state%3Aopen+label%3Aplan%3A0005>
- Board: [Agent Work](https://github.com/users/DaveVoyles/projects/2) (Projects v2, filtered by `plan:0005`)

Issue map: D1 [#69](https://github.com/DaveVoyles/resume-builder/issues/69) ·
D2 [#73](https://github.com/DaveVoyles/resume-builder/issues/73) ·
D3 [#76](https://github.com/DaveVoyles/resume-builder/issues/76) ·
D4 [#77](https://github.com/DaveVoyles/resume-builder/issues/77) ·
D5 [#70](https://github.com/DaveVoyles/resume-builder/issues/70) ·
D6 [#74](https://github.com/DaveVoyles/resume-builder/issues/74) ·
D7 [#71](https://github.com/DaveVoyles/resume-builder/issues/71) ·
D8 [#75](https://github.com/DaveVoyles/resume-builder/issues/75) ·
D9 [#72](https://github.com/DaveVoyles/resume-builder/issues/72).
Blocking edges wired natively (GitHub issue dependencies): #73←#69, #76←#73,
#77←#76, #74←#70, #75←#71. The frontier = open + `plan:0005` + no open
blockers + unassigned.
