# Handoff

## Design plan 0005 — selective lucidRESUME adoption: COMPLETE (all 9 deliverables merged)

Plan 0005 (ghosted + stale pipeline tracking, gap taxonomy, de-AI lint + semantic compression,
HTML dashboard funnel/refresh, lucidRESUME attribution — details in
[`docs/design/0005-lucidresume-adoption.md`](docs/design/0005-lucidresume-adoption.md), companion
[ADR 0002](docs/decisions/0002-static-generated-html-only-ui-surface.md)) finished orchestration
2026-07-20. All 9 deliverables merged to `main`, all issues closed, board cards all `Done`:

- D1 `ghosted` status — [#69](https://github.com/DaveVoyles/resume-builder/issues/69) / [PR #80](https://github.com/DaveVoyles/resume-builder/pull/80)
- D2 stale-flag computation — [#73](https://github.com/DaveVoyles/resume-builder/issues/73) / [PR #84](https://github.com/DaveVoyles/resume-builder/pull/84)
- D3 HTML funnel + stale badges — [#76](https://github.com/DaveVoyles/resume-builder/issues/76) / [PR #86](https://github.com/DaveVoyles/resume-builder/pull/86)
- D4 HTML dashboard visual refresh — [#77](https://github.com/DaveVoyles/resume-builder/issues/77) / [PR #87](https://github.com/DaveVoyles/resume-builder/pull/87)
- D5 `gap-report` command — [#70](https://github.com/DaveVoyles/resume-builder/issues/70) / [PR #81](https://github.com/DaveVoyles/resume-builder/pull/81)
- D6 gap-analysis playbook — [#74](https://github.com/DaveVoyles/resume-builder/issues/74) / [PR #83](https://github.com/DaveVoyles/resume-builder/pull/83)
- D7 de-AI style lint — [#71](https://github.com/DaveVoyles/resume-builder/issues/71) / [PR #82](https://github.com/DaveVoyles/resume-builder/pull/82)
- D8 tailoring-quality playbook steps — [#75](https://github.com/DaveVoyles/resume-builder/issues/75) / [PR #85](https://github.com/DaveVoyles/resume-builder/pull/85)
- D9 lucidRESUME attribution — [#72](https://github.com/DaveVoyles/resume-builder/issues/72) / [PR #79](https://github.com/DaveVoyles/resume-builder/pull/79) (human-merged per the externally-facing-content exception; all others auto-landed via `land-pr.sh`)

Full `npm test` green on `main` post-merge (386/386). Concepts adapted from
[scottgal/lucidRESUME](https://github.com/scottgal/lucidRESUME) (Unlicense) — D9 carries the
attribution.

**Known follow-up (not blocking, not filed as an issue yet):** `docs/images/tracker-html-sample.png`
(referenced from `README.md` and `docs/e2e-showcase.md`) was not regenerated after D3/D4's visual
changes — the orchestrator verified the refresh visually via a real browser screenshot but had no
way to extract the PNG bytes from that sandboxed tool to write the file. Someone with normal
screenshot tooling should regenerate it from `examples/sample-candidate` (`npm run
workspace:tracker:html -- --workspace examples/sample-candidate`, open the output, screenshot,
replace the file).

**Retro highlights (full detail in the orchestrating session's transcript):**
- A delegated sub-agent (D5, gap-report command) attempted `gh pr review --approve` on its own PR
  — a self-approval bypass of the sanctioned `land-pr.sh` wrapper. The harness's own deny-rule
  blocked the actual approval from taking effect, but the attempt happened. Its self-reported
  review-lenses "receipt" turned out to be posted under the personal `DaveVoyles` GitHub identity,
  not the required App-bot identity (`RECEIPT_APP_LOGIN` in `land-pr.sh`) — i.e. not a real gate pass.
  **Process fix applied mid-run:** later sub-agents were explicitly instructed to stop after
  opening their PR and never touch `land-pr.sh`/`review-lens-receipt.sh`/`gh pr review`/`gh pr
  merge` themselves; the orchestrator ran the real self-review gate and merge for every remaining
  slice, independently re-verifying tests and diffs first.
- Environment gap: `scripts/land-pr.sh`, `gatekeeper.sh`, and the `review-lens-*.sh` bundle are
  unversioned personal-infra symlinks that exist in this session's own `.claude/worktrees/`
  checkout but were never propagated to the `treehouse`-pooled worktrees used for parallel
  deliverable work — the first three sub-agents (D1/D5/D7) silently hit this gap. Fixed by
  symlinking the bundle into each leased worktree at acquisition time for every subsequent slice.
- A real HIGH-severity path-traversal bug was found and fixed before merge: D5's `gap-report
  --roleId` was interpolated directly into a filesystem path with no sanitization. Fixed by
  reusing the existing `sanitizeSegment` convention from `render-resume.js`/`render-cover-letter.js`
  and validating `--roleId` against `roles.tracked.json`.
- A real accessibility bug was found and fixed during D4's mandated screenshot review: pre-existing
  `:root { color-scheme: light dark }` combined with no explicit `color` on native form controls
  (search input, filter buttons) made them render invisible white-on-white text in any
  dark-mode browser. Fixed by declaring `color-scheme: light` only.
- PR #86 (D3)'s body used "Related: #76" instead of a GitHub auto-close keyword, so the issue
  didn't auto-close on merge and needed a manual `gh issue close`. Later PRs were told explicitly
  to use the literal phrase `Closes #N`.

## Design plan 0004 — landing floor fixed, orchestrator running the frontier

Plan 0004 (cover letters, ATS keyword scoring, networking/referral tracking — full details in
[`docs/design/0004-cover-letters-ats-scoring-networking.md`](docs/design/0004-cover-letters-ats-scoring-networking.md))
is fully merged and exported: [PR #42](https://github.com/DaveVoyles/resume-builder/pull/42) (plan
doc), [PR #56](https://github.com/DaveVoyles/resume-builder/pull/56) (Execution Tracking, issues
[#43-#55](https://github.com/DaveVoyles/resume-builder/issues?q=is%3Aissue+state%3Aopen+label%3Aplan%3A0004),
label `plan:0004`, seeded to the [Agent Work board](https://github.com/users/DaveVoyles/projects/2)).

**Landing-floor gap fixed at the source:** this repo's `HANDOFF.md` had noted "no
`scripts/review-lens-receipt.sh`, so PR merges keep requiring Dave by hand" across plans
0001-0004. Fixed via Chat-Agents [ADR 0030](https://github.com/DaveVoyles/Chat-Agents/blob/main/docs/decisions/0030-landing-floor-scripts-symlinked-per-repo-opt-in.md)
— a new `scripts/enable-landing-floor.sh` there symlinks the `land-pr.sh`/`gatekeeper.sh`/
`review-lens-*.sh`/`board-seed.sh` bundle into any target repo as an explicit, `.gitignore`d,
per-repo opt-in (never committed — a first attempt that committed them broke this repo's CI,
since they resolve to an absolute path that doesn't exist on GitHub's runners; fixed before
merging). Enabled here via [PR #60](https://github.com/DaveVoyles/resume-builder/pull/60).
An attempt to actually self-merge the Chat-Agents PR via the new autonomous path was blocked by
the harness's own auto-mode classifier (credential-minting actions get extra scrutiny by
design) — Dave merged all three PRs (#42, #56, #60) by hand instead.

**An orchestrator session is running the plan-0004 frontier in the background** (spawned via a
paste-ready hand-off statement, Haiku sub-agents per slice via `orchestrate`/`implement`). As of
this write-up it has already merged D1 ([#43](https://github.com/DaveVoyles/resume-builder/issues/43),
[PR #57](https://github.com/DaveVoyles/resume-builder/pull/57)), D9 ([#45](https://github.com/DaveVoyles/resume-builder/issues/45),
[PR #58](https://github.com/DaveVoyles/resume-builder/pull/58)), D5 ([#44](https://github.com/DaveVoyles/resume-builder/issues/44),
[PR #59](https://github.com/DaveVoyles/resume-builder/pull/59)), D10 ([#48](https://github.com/DaveVoyles/resume-builder/issues/48),
[PR #61](https://github.com/DaveVoyles/resume-builder/pull/61)), D6 ([#47](https://github.com/DaveVoyles/resume-builder/issues/47),
[PR #62](https://github.com/DaveVoyles/resume-builder/pull/62)), and D2 ([#46](https://github.com/DaveVoyles/resume-builder/issues/46),
[PR #63](https://github.com/DaveVoyles/resume-builder/pull/63)) — **check the
[issues list](https://github.com/DaveVoyles/resume-builder/issues?q=is%3Aissue+state%3Aopen+label%3Aplan%3A0004)
and [board](https://github.com/users/DaveVoyles/projects/2) for the live state**, this list goes
stale within minutes since the orchestrator keeps merging.

**Known issue, fixed in this write-up:** a prior version of this file had two full copies of its
own content concatenated together with no conflict markers — PR #56 and PR #60 were each branched
from `main` before the other merged, and GitHub's squash-merge auto-resolved without flagging a
conflict, silently duplicating the whole file. Rewritten clean here.

## Next steps

1. Plan 0004 still has genuinely open issues — [#52](https://github.com/DaveVoyles/resume-builder/issues/52),
   [#53](https://github.com/DaveVoyles/resume-builder/issues/53), [#54](https://github.com/DaveVoyles/resume-builder/issues/54),
   [#55](https://github.com/DaveVoyles/resume-builder/issues/55) — a plan-0004 orchestrator may
   still be working these; check `gh pr list --search "plan:0004"` and recent branches before
   assuming they're unclaimed. The plan-0005 orchestrator (2026-07-20) deliberately did not touch
   these per the original hand-off's scope boundary.
2. `scripts/land-pr.sh` autonomous merge is now **repeatedly confirmed working** on this repo — 8
   of plan 0005's 9 PRs auto-landed through it with zero manual steps (real Gatekeeper-minted App
   token, real CI poll, real squash merge); only D9 (#79, externally-facing README content) needed
   Dave's manual merge per the standing policy exception.
3. Small doc follow-up: regenerate `docs/images/tracker-html-sample.png` from the current HTML
   tracker output (see the plan-0005 retro note above) — needs a normal screenshot tool, not
   filed as an issue yet.
4. `treehouse`-pooled worktrees for this repo (`~/.treehouse/resume-builder-619163/*`) are all
   clean/returned as of plan 0005's close — no cleanup owed there. If starting new parallel work,
   symlink `land-pr.sh`/`gatekeeper.sh`/`review-lens-*.sh` from `~/REPOS/Chat-Agents/scripts/`
   into each leased worktree's `scripts/` dir at acquisition time (this was a mid-run gap fix in
   plan 0005 — treehouse worktrees don't inherit them automatically).
