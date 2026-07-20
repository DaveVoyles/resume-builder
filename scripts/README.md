# 🔧 Scripts

Standalone Node scripts invoked via `npm run` — privacy/workspace checks and the sample
walkthrough. Each is plain Node with no dependencies beyond what's already in `package.json`; no
subfolders here.

| Script | `npm run` | What it does |
| --- | --- | --- |
| [`check-privacy.js`](check-privacy.js) | `npm run check:privacy` | Scans staged and tracked Git paths against a list of private candidate-data patterns (`candidate/inputs/`, `roles.tracked.json`, `claim-policy.json`, `resume-configs/`, generated `outputs/`, ...) and fails if any are about to be committed. |
| [`check-workspace.js`](check-workspace.js) | `npm run check:workspace` | Validates a workspace's evidence ledger and feedback ledger, and regenerates the tracker to confirm it's current — used against the fictional sample candidate in CI. |
| [`sample-quickstart.js`](sample-quickstart.js) | `npm start` / `npm run sample:quickstart` | Runs the full lifecycle against `examples/sample-candidate/`: builds the tracker and similar-role review from the committed fixtures, renders the tracked DOCX, then exercises `tailor`, `set-status`, and `study-guide-bundle` in a disposable temp-dir copy so the committed fixtures never change. |

## Agent-landing-floor tooling (not tracked in this repo)

An operator session can locally enable `land-pr.sh`, `gatekeeper.sh`,
`review-lens-route.sh`/`-fanout.sh`/`-synthesize.sh`/`-validate-findings.sh`/`-receipt.sh`, and
`board-seed.sh` here by running `scripts/enable-landing-floor.sh <this-repo>` from a Chat-Agents
checkout ([ADR
0030](https://github.com/DaveVoyles/Chat-Agents/blob/main/docs/decisions/0030-landing-floor-scripts-symlinked-per-repo-opt-in.md)).
That creates symlinks into `scripts/` here pointing at Chat-Agents' canonical copies — but they're
**deliberately `.gitignore`d, never committed**: they resolve to an absolute path on the operator's
own machine, and a checked-in symlink to a path that doesn't exist elsewhere (any other clone,
including GitHub Actions' runners) breaks `node --test`'s file walk there (confirmed live —
[resume-builder#60](https://github.com/DaveVoyles/resume-builder/pull/60)'s first CI run failed
exactly this way before the fix). Not product scripts of this repo, not listed in the table above
— they're the self-review/PR-approval automation an agent session uses when landing a PR here, run
once per machine, not something a resume-builder user ever runs or that ships with a clone.

## Related pages

- [`package.json`](../package.json) — the `npm run` scripts these wrap.
- [End-to-end showcase](../docs/e2e-showcase.md) — captured output of `sample-quickstart.js`'s full run.
- [Candidate workspace](../docs/candidate-workspace.md) — the privacy rules `check-privacy.js` enforces.
