# 🧪 Examples

Fictional, safe-to-inspect fixture data that shows the modular workflow without exposing any
real candidate's information. Everything under this folder is committed to Git on purpose —
nothing here is a real person, company, or job posting.

Try this:

```bash
npm start
```

`npm start` (`scripts/sample-quickstart.js`) runs the entire lifecycle — tracker, similar-role
review, a rendered DOCX, a full `tailor` pass, a status update, and a study-guide bundle —
against the fixtures in this folder. See [`docs/e2e-showcase.md`](../docs/e2e-showcase.md) for
the real, captured output of every step.

## Subfolders

| Folder | What it holds |
| --- | --- |
| [`sample-candidate/`](sample-candidate/) | The fictional candidate workspace ("Alex Rivera") used by every playbook and by `npm start`. Has its own [README](sample-candidate/README.md) with the full fixture-file table. |

## Related pages

- [Sample candidate workspace](sample-candidate/README.md)
- [Modular architecture](../docs/modular-architecture.md)
- [Candidate workspace](../docs/candidate-workspace.md)
- [End-to-end showcase](../docs/e2e-showcase.md)
