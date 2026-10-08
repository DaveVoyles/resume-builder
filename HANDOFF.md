# resume-builder handoff (2026-10-07)

## State

- Handoff commit: `c85f44a` on `main` (PR #179, "PR G", the last PR by the previous team). All CI on that commit passed: validate (node 18.x), validate (node 20.x), cursor-cloud-setup, Build demo, Deploy to GitHub Pages. The public demo runs this code. `npm test`: 736 tests pass (8 `.pptx` tests fail if the `zip` tool is not installed).
- A final new-user browser walk on `c85f44a` with sample data passed: all 6 home steps tick; after setup, "Continue setup" becomes "Edit my answers"; after a reload all 10 form fields come back; a goal change persists; a cleared optional field stays empty; the Jobs tab and tracker show the tracked job.
- After handoff, PR #181 merged to `main` as `28b6115` (2026-10-08). It fixed the five fix-first items below. `main` now includes that work.

## How to run

- Node 16 or later; one runtime dependency (`docx`). `npm install` (CI uses `npm ci`). Browser checks need Playwright (devDependency) and Chromium; they need Node 20+.
- `npm start` runs a sample on fictional data in a temp folder and deletes it.
- `npm run setup` creates a workspace; `npm run home` serves the home page at http://localhost:4321 (tracker at /tracker.html).
- `npm run workspace:ingest -- --workspace candidate` reads files in; `npm run workspace:add-role -- --workspace candidate --title T --company C --tracked` adds a job; `node src/cli/index.js --help` lists commands.
- Test: `npm test`, `npm run test:browser` (headless Playwright home checks in `tests/browser/`; skips if Playwright or Chromium is missing), `npm run check:workspace`, `npm run check:privacy`, `npm run validate` (tests + sample + workspace check + privacy).
- CI: `validate.yml` (node 18.x and 20.x; browser checks run on the 20.x job only), `cursor-cloud-setup.yml` (node 22). Each push to `main` runs `deploy-demo.yml` (privacy check first) and redeploys the public demo to GitHub Pages.

## Fixed after handoff (PR #181)

1. Duplicate ids — done in #181: Education (`edu-`) and deal-breaker (`deal-`) ids use highest existing id + 1; `validate` rejects repeated ids in profile experience/projects/education and preferences dealBreakers. Home still replaces only the education row tracked by `lastHomeEducationId` (unchanged); an edit of an agent-written row that home does not own still adds a new entry, now with a unique id.
2. Browser tests in CI — done in #181: headless Playwright checks live in `tests/browser/` and run via `npm run test:browser` in `validate.yml` (Node 20.x job).
3. `validate` vs workspace check — done in #181: `npm run validate` now runs `check:workspace`, and the workflow step name matches.
4. Privacy before demo deploy — done in #181: `deploy-demo.yml` runs `check:privacy` before build and deploy.
5. Work mode loss — done in #181: home Save only removes a work mode it added itself (`lastHomeWorkModeOwned`); an agent-written mode that home also picked is kept when the home answer changes.

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

- Node versions differ: CI 18/20 (browser checks on 20 only), cloud check 22, `engines` >=16, Playwright needs Node 20+.

## Not checked

- No browser test of an unchanged Save on a workspace an agent set up (only a server test).
- An unchanged Save can still rewrite `.onboarding-state.json` and `outputs/tracker.html`.
- The Jobs "Edit my answers" button was never clicked with tracked jobs (it does not show then).
- Blank goal not tested in a browser (the field is required).
- Non-USD salary.
