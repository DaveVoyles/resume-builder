# resume-builder handoff (2026-10-07)

## State

- Handoff commit: `c85f44a` on `main` (PR #179, "PR G", the last PR by the previous team). All CI on that commit passed: validate (node 18.x), validate (node 20.x), cursor-cloud-setup, Build demo, Deploy to GitHub Pages. The public demo runs this code. `npm test`: 736 tests pass (8 `.pptx` tests fail if the `zip` tool is not installed).
- A final new-user browser walk on `c85f44a` with sample data passed: all 6 home steps tick; after setup, "Continue setup" becomes "Edit my answers"; after a reload all 10 form fields come back; a goal change persists; a cleared optional field stays empty; the Jobs tab and tracker show the tracked job.

## How to run

- Node 16 or later; one runtime dependency (`docx`). `npm install` (CI uses `npm ci`).
- `npm start` runs a sample on fictional data in a temp folder and deletes it.
- `npm run setup` creates a workspace; `npm run home` serves the home page at http://localhost:4321 (tracker at /tracker.html).
- `npm run workspace:ingest -- --workspace candidate` reads files in; `npm run workspace:add-role -- --workspace candidate --title T --company C --tracked` adds a job; `node src/cli/index.js --help` lists commands.
- Test: `npm test`, `npm run check:workspace`, `npm run check:privacy`, `npm run validate` (tests + sample + privacy).
- CI: `validate.yml` (node 18.x and 20.x), `cursor-cloud-setup.yml` (node 22). Each push to `main` runs `deploy-demo.yml` and redeploys the public demo to GitHub Pages.

## Fix first (in order)

1. Duplicate ids: `src/core/home-answers.js` makes Education ids (~line 164) and deal-breaker ids (~line 88) as count+1, so ids can repeat (e.g. agent wrote edu-001 and edu-003, a user save adds a second edu-003). `validate` does not catch it. Also fixing a typo in an agent-written Education entry adds a duplicate instead of replacing it. Fix: next id = highest id + 1; make validate reject repeated ids; replace on edit.
2. Add a browser test to CI. Show/hide/fill bugs got past unit tests three times (#178, and the goal and clear bugs in PR G). Move headless Playwright checks into the repo and run them in `validate.yml`.
3. The `validate.yml` step is named as workspace validation, but `npm run validate` (`package.json` ~line 48) does not run `check:workspace`. Add it or rename the step.
4. Every push to `main` redeploys the public demo. Run the privacy check before the deploy so a bad merge cannot publish private data.
5. If an agent and the home page both set the same work mode, changing the home answer removes it (from #177). This silently changes job matching.

## Smaller wording and layout items

- No "X of 10" count on home; only a percent (`onboarding/home.html` checklist and progress bar).
- No confirmation when a Save changes salary; it overwrites `preferences.json` `compensation.baseMinimum` (always USD).
- "Choose one" in When clears the saved answer; "Choose one" in Where to work keeps the old choice. Make them consistent.
- Numbering in the short list on the card after a Save is wrong; the "A draft comes later" note needs new wording.
- "Edit my answers" shows twice after a Save (Ready panel and saved card).
- "Get your first draft" can be ticked before the answers are saved, which reads oddly next to its own text; home shows 83% before any answers.
- `src/cli/commands/build-tracker.js` lines 39 and 45 print a full file path.
- Education is stored only in `institution` (not split into degree and school).

## Known risks

- Node versions differ: CI 18/20, cloud check 22, `engines` >=16.
- No browser test tool in the repo.

## Not checked

- No browser test of an unchanged Save on a workspace an agent set up (only a server test).
- An unchanged Save can still rewrite `.onboarding-state.json` and `outputs/tracker.html`.
- The Jobs "Edit my answers" button was never clicked with tracked jobs (it does not show then).
- Blank goal not tested in a browser (the field is required).
- Non-USD salary.
