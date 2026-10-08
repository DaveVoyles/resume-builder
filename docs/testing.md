# Testing with personas

Every run of the persona suite uses fictional people, so the whole path from empty folder to tailored resume is measured the same way each time. Nothing here submits an application.

## What is in `examples/personas/<name>/`

| File or folder | What it is |
| --- | --- |
| `answers.json` | The answers typed into the home form (`name`, `location`, `history`, `goal`, `where`, `when`, `extra`, `dealBreakers`, `dealBreakersChoice`, `education`, `educationChoice`, `salary`, `salaryChoice`). Same shape `saveHomeAnswers` takes. |
| `inputs/resumes/`, `inputs/notes/` | Old resumes and notes, copied into the temp workspace and ingested. |
| `postings/*.md` | Job-description text for each target role. |
| `resume-configs/*.json` | The committed tailored resume per posting. Every number in them must be backed by the persona's notes. |
| `expected.json` | Scorecard thresholds and posting metadata (company, title, URL, keywords). |
| `golden/*.txt` | Expected extracted DOCX text per role. |

Personas: `alex` (product manager, two roles, adapted from `examples/sample-candidate`), `jordan` (office and operations, skips salary), `morgan` (teacher moving into customer education, has a counted claim "6 workshops" backed by a note).

## Run it

```bash
npm run e2e                      # every persona
npm run e2e -- --persona jordan  # one persona
npm run e2e -- --persona jordan --keep   # keep the temp workspace to inspect it
UPDATE_GOLDEN=1 npm run e2e      # regenerate golden text after an intended change
npm test                         # also runs the scorecard and golden checks (no page counts)
npm run test:browser             # includes persona-home.browser.js, which fills the form from answers.json
```

For each persona the script builds a temp workspace and runs: `init`, copy inputs, `ingest`, `saveHomeAnswers`, `add-role`, `tailor`, `render-resume`, `build-tracker` (md and html), `validate`. It prints one line per check and exits non-zero if any check fails. JSON scorecards go to `<tmp>/resume-builder-e2e/scorecard-<persona>.json` so runs can be compared.

## Scorecard

| Check | Fails when |
| --- | --- |
| setup reaches 10/10 | any of the ten tracker steps is still pending |
| claim audit | a number in the resume config has no matching evidence |
| keyword coverage | below `minKeywordPercent` for the posting |
| style-lint warnings | more than `maxStyleWarnings` |
| proxy score | above `maxProxyScore` (summary words + bullet words + 40 per job + 20 per education row) |
| page count | more than one page, counted with `src/core/page-count.js` (the same check `tailor` runs). Runs only when LibreOffice (`soffice`) is installed, otherwise skipped |
| tracker lists the role | company missing from `tracker.md` or `tracker.html`, or a role is marked applied |
| golden DOCX text | extracted text differs from `golden/<role>.txt` |
| no absolute paths in CLI output | Fails if any command prints the machine's absolute path. Commands name files relative to the workspace or working directory. |

## Golden checks

`tests/e2e/personas.test.js` compares fresh DOCX text (via `tests/helpers/read-docx-text.js`) with `golden/*.txt`. If a change to a renderer or a resume config is intended, run `UPDATE_GOLDEN=1 npm test` (or `UPDATE_GOLDEN=1 npm run e2e`), then review the diff of the golden files in the PR.

## No-submit guard

Submitting applications is out of scope for every test. See [`docs/playbooks/apply.md`](playbooks/apply.md).

- `scripts/e2e-persona.js` refuses to run `apply` or `approve-apply` and refuses `--confirm-submit`.
- `tests/cli/apply-flow.test.js` checks `apply` throws without `--dry-run` and never writes `applied`.
- `tests/cli/no-submit-guard.test.js` fails if `src/` gains network, browser-automation, or child-process access outside a short allowlist.

## For agents

1. Run `npm run e2e` after changing anything in `src/`, `onboarding/`, `templates/`, or a persona.
2. Read the scorecard. A `FAIL` names the stage and the check. A `WARN` is information.
3. Add a persona when you find a kind of candidate the three do not cover: copy a folder, change the fiction, run with `UPDATE_GOLDEN=1`, and review the new golden text. Keep everything fictional (`example.invalid` or `example.com` addresses).
4. Never point these runs at `candidate/`. They use a temp workspace and delete it afterward.
