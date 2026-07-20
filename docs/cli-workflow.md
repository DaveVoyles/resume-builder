# 🧰 CLI workflow

Try this:

```bash
npm install
npm start
```

The project is designed for an agent-first workflow. Use the CLI-only workflow when you want a structured, local job-search workspace but plan to do the thinking and writing yourself.

---

## ✅ What the CLI can do

The CLI can:

- 🗂️ Initialize a private candidate workspace.
- 📥 Ingest resumes, notes, text files, and optional public GitHub metadata.
- 🧾 Store source-backed facts in `evidence.jsonl`.
- 📌 Create seed roles and tracked application records.
- 📄 Render a schema-validated resume config to a finished DOCX resume, and audit its claims against `evidence.jsonl`.
- 📊 Render a markdown application tracker.
- 🧭 Generate similar-role search briefs.
- ⚖️ Score manually collected candidate roles against seed-role patterns.
- 🔒 Validate workspace files, tracker freshness, evidence-backed claims, and privacy boundaries.

The CLI does not currently:

- 🕸️ Automatically scrape job boards.
- 🎯 Automatically decide which jobs you should apply to.
- 🙋 Interview the candidate for missing details.
- ✍️ Rewrite resume bullets or application answers on its own.

## 🧾 Common commands

| Workflow | Command |
| --- | --- |
| Run the sample workflow | `npm start` |
| Create the default private workspace | `npm run setup` |
| Initialize a named workspace | `npm run workspace:init -- --workspace <dir>` |
| Ingest resumes, notes, text, or public GitHub metadata | `npm run workspace:ingest -- --workspace <dir> --resume <file> --notes <file> --github <user>` |
| Add a seed or tracked role | `npm run workspace:add-role -- --workspace <dir> --url <url>` or add `--tracked` |
| Build similar-role review output | `npm run workspace:similar -- --workspace <dir> [--candidates <file>]` |
| Render the application tracker | `npm run workspace:tracker -- --workspace <dir>` |
| Render an interactive HTML tracker (searchable/filterable, stat cards) | `npm run workspace:tracker -- --workspace <dir> --format html` |
| Render a schema-validated resume config to DOCX | `npm run workspace:render -- --workspace <dir> --config <resume-config.json>` |
| Validate, render, and track a role for a job posting in one pass | `npm run workspace:tailor -- --workspace <dir> --config <resume-config.json> --url <url> --title <title>` |
| Validate workspace files, the claim audit, and tracker freshness | `npm run workspace:validate -- --workspace <dir>` |
| Check privacy before sharing | `npm run check:privacy` |

## 🧭 CLI-only path

```bash
npm run setup
npm run workspace:ingest -- --workspace candidate --resume ./my-resume.docx --notes ./notes.md
npm run workspace:add-role -- --workspace candidate --url https://example.com/job
npm run workspace:similar -- --workspace candidate
npm run workspace:tracker -- --workspace candidate
npm run workspace:validate -- --workspace candidate
```

Then manually review:

- 👤 `candidate/profile.json`
- 🧾 `candidate/evidence.jsonl`
- 📌 `candidate/roles.seed.json`
- 📊 `candidate/outputs/tracker.md`
- 🖥️ `candidate/outputs/tracker.html` (optional, generate with `--format html`)
- 🧭 `candidate/outputs/similar-roles.md`

This is structured and private, but it is more hands-on. You provide the judgment, rewrite the content, and decide which roles to pursue.

## 🔎 Similar-role review

`find-similar` is a bounded discovery helper, not a job-board scraper. It derives search briefs from seed roles and preferences, scores optional manually researched candidate roles from a local JSON file, and writes `<workspace>/outputs/similar-roles.md` for review.

Promote only candidate-approved roles with `add-role --tracked`, update application state in `roles.tracked.json`, then run `workspace:tracker` and `workspace:validate`.

## 📚 Related pages

- [Getting started](getting-started.md)
- [Agent workflow](agent-workflow.md)
- [Candidate workspace](candidate-workspace.md)
- [Workspace schemas](workspace-schemas.md)
