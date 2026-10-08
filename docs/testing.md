# Testing with personas

Every run of the persona suite uses the same people, so the whole path from empty folder to tailored resume is measured the same way each time. Four of the personas are fictional. The fifth, `owner`, is the one persona built from a real person, with permission: the repo owner's own scrubbed resume and three real job postings saved as offline snapshots. Nothing here submits an application.

## What is in `examples/personas/<name>/`

| File or folder | What it is |
| --- | --- |
| `answers.json` | The answers typed into the home form (`name`, `location`, `history`, `goal`, `where`, `when`, `extra`, `dealBreakers`, `dealBreakersChoice`, `education`, `educationChoice`, `salary`, `salaryChoice`). Same shape `saveHomeAnswers` takes. |
| `inputs/resumes/`, `inputs/notes/` | Old resumes and notes, copied into the temp workspace and ingested. Optional: see "Inputs that live elsewhere" below. |
| `postings/*.md` | Job-description text for each target role. |
| `resume-configs/*.json` | The committed tailored resume per posting. Every number in them must be backed by the persona's notes. |
| `expected.json` | Scorecard thresholds and posting metadata (company, title, URL). Per posting: `expectedKeywords` (keywords posting extraction must store on the role), `forbiddenKeywords` (company names, places, and filler it must not store), `minKeywordPercent`, `maxProxyScore`, and an optional `note` that says why the threshold is what it is. Optional `maxPages` (with a one-line `maxPagesReason`) raises the page limit for one posting; the default is 1. |
| `golden/*.txt` | Expected extracted DOCX text per role. |

Personas: `alex` (product manager, two roles, adapted from `examples/sample-candidate`), `jordan` (office and operations, skips salary), `morgan` (teacher moving into customer education, has a counted claim "6 workshops" backed by a note), `owner` (the repo owner's real resume and three real postings, described below).

### Inputs that live elsewhere

By default a persona's files come from its own `inputs/resumes/` and `inputs/notes/`. When the file already lives elsewhere in the repo, `expected.json` can point at it instead of keeping a second copy:

```json
"inputs": { "resumes": ["../../real-resume/owner/owner-resume.docx"], "notes": ["inputs/notes/owner-confirmations.md"] }
```

Paths are relative to the persona folder, must exist, and must stay inside the repo. `scripts/e2e-persona.js` (`personaInputFiles`) resolves them for `npm run e2e`, `npm test` and `tests/browser/persona-home.browser.js`. Personas without an `inputs` key behave as before.

### The owner persona

`owner` is the only persona built from a real person, with their permission. Its resume is `examples/real-resume/owner/owner-resume.docx` (email scrubbed), read through the real Word ingest path; its one note, `examples/personas/owner/inputs/notes/owner-confirmations.md`, records the owner's yes/no answers of 2026-10-08 about nine posting keywords (confirmed) and RAID, agile and ServiceNow (not done); see [the tailor playbook](playbooks/tailor.md#step-32c-record-the-persons-yesno-answers-then-re-ingest-and-re-tailor). Its three postings in `examples/personas/owner/postings/` are real public job pages saved as offline snapshots (text plus a screenshot), so the run still works after the pages come down. They are for tailoring and testing only and nothing is ever sent.

The three tailored resumes use only what the resume shows. `JOBS.md` in that folder lists, per posting, what the resume backs and what it does not, and `tests/e2e/personas.test.js` fails if a tailored config names a tool, platform or credential from that "not on the resume" list. The roles are deliberately uneven: one close fit, one stretch, and one weak fit. The thresholds in `expected.json` are the measured results with a `note` saying why, so a drop is a regression, not noise. Because the general resume already holds everything the resume supports, tailoring for the stretch roles cannot raise the keyword percent; the scorecard prints that as a WARN and the report says so.

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
| keyword coverage | the percent stored on the role (`resume.keywordCoverage.percent`, scored against the keywords extracted from the posting) is below `minKeywordPercent`. This is the same number the tailor report prints, and the scorecard also fails if the two differ |
| report proof of tailoring | the role's `.html` report has no before/after block or no coverage bar, `baselineCoverage` is not stored, the `.md` lacks the "Your general resume covers X of N ... This resume covers ..." line, or tailored coverage is below the general resume. It is a **WARN** (not a failure) when the lift is exactly 0: the person cannot see a benefit from tailoring |
| posting keywords | an `expectedKeywords` entry was not stored, or a `forbiddenKeywords` entry was |
| possible matches | a possible match stored on the role is missing from the `.md` or `.html` report (quote and evidence id), is counted as covered, or the section heading is missing |
| never claim | `expected.json` lists top-level `neverClaim` keywords (the owner persona: RAID, agile, ServiceNow) and one appears in a resume config or its rendered DOCX |
| style-lint warnings | more than `maxStyleWarnings` |
| proxy score | above `maxProxyScore` (summary words + bullet words + 40 per job + 20 per education row) |
| page count | more pages than the posting's limit (1, or `maxPages` in `expected.json`), counted with `src/core/page-count.js` (the same check `tailor` runs). Runs only when LibreOffice (`soffice`) is installed, otherwise skipped |
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
3. Add a persona when you find a kind of candidate the others do not cover: copy a folder, change the fiction, run with `UPDATE_GOLDEN=1`, and review the new golden text. Keep everything fictional (`example.invalid` or `example.com` addresses). `owner` is the one exception and is not a template: do not add anyone else's real resume.
4. Never point these runs at `candidate/`. They use a temp workspace and delete it afterward.

See [`docs/showcase/README.md`](showcase/README.md) for a screenshot walkthrough of one run on the owner persona.

A keyword the person declined (a `Not done` line in their notes) must never reach a resume: `tailor` and `validate` block it (`src/core/declined-guard.js`, tests in `tests/core/declined-guard.test.js` and `tests/cli/tailor-declined.test.js`).
