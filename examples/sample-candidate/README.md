# Sample candidate workspace

Try this:

```bash
npm run sample:quickstart
```

This sample exists to show the modular workflow without exposing private candidate data. It uses only fictional names, companies, roles, evidence, notes, and reserved example domains.

---

## Friend-facing quickstart

Use this folder when you want to explain the reusable workflow to a friend before you create a private workspace for them.

1. Review the fixture files:

   ```bash
   ls examples/sample-candidate
   ```

2. Build generated markdown outputs locally:

   ```bash
   npm run workspace:tracker -- --workspace examples/sample-candidate
   npm run workspace:similar -- --workspace examples/sample-candidate --candidates examples/sample-candidate/roles.similar.candidates.json
   ```

3. Validate the sample workspace:

   ```bash
   npm run workspace:validate -- --workspace examples/sample-candidate
   ```

The shortcut command runs the tracker, similar-role review, and validation steps together:

```bash
npm run sample:quickstart
```

Generated markdown outputs land under `examples/sample-candidate/outputs/` and stay local because generated outputs are ignored. Do not create or commit generated DOCX files for this sample.

## Sample fixture files

| Path | Purpose |
| --- | --- |
| `profile.json` | Fictional normalized candidate facts. |
| `preferences.json` | Fictional role, location, compensation, and style preferences. |
| `evidence.jsonl` | Small evidence ledger that references fictional markdown inputs. |
| `roles.seed.json` | Seed role used to derive search briefs. |
| `roles.tracked.json` | Accepted sample role used to render the tracker. |
| `claim-policy.json` | Claim-safety rules for the sample candidate. |
| `inputs/` | Fictional resume summary, notes, and links. |
| `roles.similar.candidates.json` | Manually researched fictional roles for scoring. |

## Similar-role review sample

Use fictional seed roles and preferences to produce a similar-role review output:

```bash
npm run workspace:similar -- --workspace examples/sample-candidate --candidates examples/sample-candidate/roles.similar.candidates.json
```

The output belongs in `outputs/similar-roles.md` for real workspaces. It should show search briefs, scored candidate roles, duplicate candidates that were suppressed, and the review flow. The review-before-tracking rule always applies: a similar role is only a recommendation until the candidate accepts it and an operator promotes it to `roles.tracked.json`.

For sample data, keep candidate roles fictional and use `.invalid` links.

## Privacy rules

Do not copy real candidate resumes into this folder. Do not include real personal notes, real compensation data, real application links, or generated DOCX files.

If a sample needs to show structure, use fictional data and keep it small.

## Related pages

- [Modular architecture](../../docs/modular-architecture.md)
- [Candidate workspace](../../docs/candidate-workspace.md)
