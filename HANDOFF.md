# Handoff

## Design plan 0004 exported; landing-floor gap fixed at the source

Plan 0004 (cover letters, ATS keyword scoring, networking/referral tracking — full details in
[`docs/design/0004-cover-letters-ats-scoring-networking.md`](docs/design/0004-cover-letters-ats-scoring-networking.md))
merged via [PR #42](https://github.com/DaveVoyles/resume-builder/pull/42), exported to issues
[#43-#55](https://github.com/DaveVoyles/resume-builder/issues?q=is%3Aissue+state%3Aopen+label%3Aplan%3A0004)
(label `plan:0004`, native `blocked_by` dependencies, seeded to the Agent Work board), Execution
Tracking recorded via [PR #56](https://github.com/DaveVoyles/resume-builder/pull/56) (**awaiting
Dave's manual merge**). An orchestrator session is already running the frontier in the background
(spawned via the paste-ready hand-off statement) — Haiku sub-agents implementing D1/D5/D9 and
onward.

**Recurring gap fixed at the source:** this repo's `HANDOFF.md` has noted "no
`scripts/review-lens-receipt.sh`, so PR merges keep requiring Dave by hand" across every plan
0001-0004 close-out. Dave asked why that script can't just be global; the answer (Chat-Agents
[ADR 0030](https://github.com/DaveVoyles/Chat-Agents/blob/main/docs/decisions/0030-landing-floor-scripts-symlinked-per-repo-opt-in.md))
is a new `scripts/enable-landing-floor.sh` in Chat-Agents that symlinks the whole
`land-pr.sh`/`gatekeeper.sh`/`review-lens-*.sh`/`board-seed.sh` bundle into any target repo as an
explicit per-repo opt-in — run against this repo in
[PR #60](https://github.com/DaveVoyles/resume-builder/pull/60). **Once that PR merges, this repo
finally has the autonomous landing floor** — subsequent PRs (including the plan-0004
orchestrator's own PRs) can go through `land-pr.sh` instead of needing Dave's manual merge, once
a `review-lenses` receipt is posted.

## Next steps

1. Dave merges [PR #56](https://github.com/DaveVoyles/resume-builder/pull/56) (Execution
   Tracking) and [PR #60](https://github.com/DaveVoyles/resume-builder/pull/60) (landing-floor
   symlinks) — both are plain, low-risk docs/symlink-only diffs.
2. Once `chore/enable-landing-floor` merges, verify the landing floor actually works end-to-end
   on the *next* PR this repo produces: `scripts/review-lens-receipt.sh` should successfully post
   a commit status, and `scripts/land-pr.sh` should be able to auto-approve/merge a clean PR
   without Dave's hand — first real live-fire test of the new capability here.
3. Let the already-running orchestrator session keep working the plan-0004 frontier
   (D1 → D2 → D3 → D4 cover letters; D5 → D6 → D7 → D8 ATS scoring; D9 → D10 → D11 → D12 → D13
   networking) — it's a background task in this session, not something to restart.
4. This session's own worktree (`.claude/worktrees/resume-builder-improvements-9dd600`) now has
   several branches that have moved through it (`claude/resume-builder-improvements-9dd600`
   merged, `docs/plan-0004-execution-tracking` pending PR #56, `chore/enable-landing-floor`
   pending). Prune whichever have merged via `scripts/git-prune-merged-branch.sh` once this
   session ends and everything's landed.
