# 🔧 Scripts

Standalone Node scripts invoked via `npm run` — privacy/workspace checks and the sample
walkthrough. Each is plain Node with no dependencies beyond what's already in `package.json`; no
subfolders here.

| Script | `npm run` | What it does |
| --- | --- | --- |
| [`check-privacy.js`](check-privacy.js) | `npm run check:privacy` | Scans staged and tracked Git paths against a list of private candidate-data patterns (`candidate/inputs/`, `roles.tracked.json`, `claim-policy.json`, `resume-configs/`, generated `outputs/`, ...) and fails if any are about to be committed. |
| [`check-workspace.js`](check-workspace.js) | `npm run check:workspace` | Validates a workspace's evidence ledger and feedback ledger, and regenerates the tracker to confirm it's current — used against the fictional sample candidate in CI. |
| [`sample-quickstart.js`](sample-quickstart.js) | `npm start` / `npm run sample:quickstart` | Runs the full lifecycle against `examples/sample-candidate/`: builds the tracker and similar-role review from the committed fixtures, renders the tracked DOCX, then exercises `tailor`, `set-status`, and `study-guide-bundle` in a disposable temp-dir copy so the committed fixtures never change. |

## Related pages

- [`package.json`](../package.json) — the `npm run` scripts these wrap.
- [End-to-end showcase](../docs/e2e-showcase.md) — captured output of `sample-quickstart.js`'s full run.
- [Candidate workspace](../docs/candidate-workspace.md) — the privacy rules `check-privacy.js` enforces.
