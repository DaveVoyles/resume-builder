# 🏗️ Source

The reusable engine: parsing, validation, rendering, and the CLI that wraps them. No candidate
data lives here — see [`examples/`](../examples/) for fixtures and `candidate/` (gitignored) for
real workspace data. The CLI never calls an LLM; see
[ADR 0001: Agent-operated CLI](../docs/decisions/0001-agent-operated-cli.md) for why.

## Subfolders

| Folder | What it holds |
| --- | --- |
| [`cli/`](cli/) | The command-line entry point (`index.js`) and one file per command under [`cli/commands/`](cli/commands/) (`init`, `ingest`, `add-role`, `build-tracker`, `find-similar`, `render-resume`, `render-cover-letter`, `tailor`, `score-keywords`, `gap-report`, `set-status`, `add-contact`, `set-contact-status`, `build-contacts-tracker`, `study-guide-bundle`, `validate`). Each command is a thin wrapper that reads/writes workspace files via `core/workspace.js` and calls into `core/` and `renderers/`. See [Modular architecture](../docs/modular-architecture.md) for the full command surface table. |
| [`core/`](core/) | Schema validation, the evidence ledger, the evidence-backed claim audit, candidate-profile merging, similar-role scoring, ID generation, the contact schema, staleness computation, the de-AI style lint, and the shared workspace file I/O every command builds on. |
| [`renderers/`](renderers/) | Turns structured workspace data into output files: the DOCX resume/cover-letter renderers (`docx-resume.js`/`docx-cover-letter.js` + `docx-helpers.js`), and the markdown/HTML renderers for the role tracker, contacts tracker, gap report, and similar-roles review. |
| [`adapters/`](adapters/) | Reads external or semi-structured input into evidence: freeform notes/resumes (`.docx`/`.md`/`.txt`), a public GitHub profile, and job-posting URLs. |

## How a command is built

Every command in `cli/commands/` follows the same shape: resolve the workspace path
(`core/workspace.js`), read the relevant JSON/JSONL files, do its work via `core/` and
`renderers/`, then write the result back. `tailor.js` is the clearest example of composition —
it calls `render-resume.js`, `add-role.js`, `set-status.js`, and `build-tracker.js` in sequence
rather than duplicating their logic.

## Related pages

- [Modular architecture](../docs/modular-architecture.md) — the full CLI command surface table and data-flow narrative.
- [Workspace schemas](../docs/workspace-schemas.md) — the exact shape of every file these modules read and write.
- [Accuracy and claims](../docs/accuracy-and-claims.md) — the rules `core/claim-audit.js` enforces mechanically.
- [`tests/`](../tests/) — test coverage for this tree, mirroring its folder layout.
