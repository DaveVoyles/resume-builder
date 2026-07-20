# ✅ Tests

Node's built-in test runner (`node:test`, zero extra dependencies) — run everything with:

```bash
npm test
```

## Subfolders

| Folder | What it covers |
| --- | --- |
| [`cli/`](cli/) | Composition tests for CLI commands — `ingest`, `init`, `render-resume`, `tailor`, `validate` — exercised as real command calls against a temp-dir workspace, not mocked. |
| [`core/`](core/) | Unit tests for `src/core/`: the evidence-backed claim audit (`claim-audit.test.js`) and resume-config schema validation (`resume-config.test.js`). |
| [`renderers/`](renderers/) | Tests for `src/renderers/`, currently the DOCX resume renderer — asserts the generated `.docx` actually contains the expected text, via `helpers/read-docx-text.js`. |
| [`helpers/`](helpers/) | Shared test-only utilities. `read-docx-text.js` is a minimal ZIP + WordprocessingML extractor used only to read back generated DOCX files in assertions — not a runtime dependency. |

**Note:** two commands added after this layout was established keep their tests colocated
instead — [`src/cli/commands/set-status.test.js`](../src/cli/commands/set-status.test.js) and
[`src/cli/commands/study-guide-bundle.test.js`](../src/cli/commands/study-guide-bundle.test.js).
`npm test` picks up both locations (`node --test` discovers `*.test.js` files anywhere in the
tree), so either placement runs; new command tests can go in `tests/cli/` to match the folder
convention above.

## Related pages

- [`src/`](../src/) — the code this tree tests, same subfolder layout.
- [End-to-end showcase](../docs/e2e-showcase.md) — the higher-level regression pass that runs actual playbooks against the sample candidate, complementary to these unit/composition tests.
