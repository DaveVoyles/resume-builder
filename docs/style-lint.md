# De-AI style lint

A deterministic lint over resume and cover-letter text that flags writing patterns commonly
associated with AI-generated (or AI-flavored, over-polished) prose — buzzwords and clichés,
suspiciously uniform sentence lengths, and repeated words or phrases. It never blocks anything;
it prints advisory warnings so a candidate or agent can decide whether to rewrite the flagged
text before finalizing a resume.

Adapted from lucidRESUME's style-review concept (see the root [README](../README.md)'s
Acknowledgements section) — no ML models or API calls involved, just wordlist matching and a
couple of statistical heuristics over plain text.

## What it checks

Implemented in `src/core/style-lint.js`, over three independent heuristics:

| Heuristic | What it flags |
| --- | --- |
| Buzzword/cliché matching | Any phrase from the wordlist below appears in the text (case-insensitive, whole-phrase match). |
| Sentence-uniformity | Most sentences fall within a suspiciously narrow length range — a common AI-writing tell (real writers vary sentence length more). |
| Repetition | The same non-common word, or the same sentence-opening words, recur several times across the text. |

### The wordlist

`src/core/data/ai-style-wordlist.json` — a plain JSON array of ~58 buzzword/cliché phrases
(`leverage`, `synergies`, `results-driven`, `passionate about`, `cutting-edge`, `seamlessly
integrate`, `proven track record`, `move the needle`, and similar corporate/AI-flavored stock
phrases). It's data, not code — add, remove, or retune entries there without touching the lint
logic itself.

## Where it runs

The lint is wired as **advisory-only** into two commands — it only ever adds warnings, never a
non-zero exit code or a blocked render:

- **`tailor`** — lints the drafted resume config's summary, experience bullets, and skills text
  (and, if `--cover-letter` is passed, the cover-letter config's body paragraphs too) right after
  drafting, before the config is validated/rendered.
- **`validate`** — lints every resume config found in the workspace as part of the broader
  validation pass, alongside the evidence-backed claim audit.

Both commands print warnings to the console; `validate` also folds them into its warnings list
(not its errors list — a style warning never fails validation).

## Acting on warnings

The [tailor playbook](playbooks/tailor.md) has a dedicated **de-AI rewrite step** (Section 3,
after the drafting step) that walks through reading the printed warnings and rewriting the
flagged text — with before/after examples for each heuristic. That playbook is the how-to; this
page is the what-and-why reference.

## Related pages

- [Root README](../README.md) — feature table entry and Acknowledgements (attribution).
- [`tailor.md`](playbooks/tailor.md) — the de-AI rewrite step and the semantic-compression step
  that precedes it.
- [`workspace-schemas.md`](workspace-schemas.md) — schema reference for the resume/cover-letter
  config fields this lint reads.
