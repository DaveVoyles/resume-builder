# Onboarding playbook

**Onboarding** is the proactive, state-aware first-run sequence: workspace setup, dropping in real source material, ingesting it, and starting the grill intake interview. It replaces guessing at "what step is this candidate on" with a quick check of the workspace's actual state, then greeting the candidate at the right point instead of always starting from step one.

This playbook covers setup, old material, reading those files, and the interview. The sentences you say are in [`docs/first-run/what-to-say.md`](../first-run/what-to-say.md). Open [`docs/first-run/guide.html`](../first-run/guide.html) before the first of those sentences. Later stages (a job, a resume, the list, a study guide) are in [`docs/first-run/FAQ.md`](../first-run/FAQ.md).

Before you start:

- Run this check at the start of any session in this repo, before doing anything else — it's how you decide whether to greet the candidate with onboarding messaging or get straight to whatever they asked for.
- You need read access to the candidate workspace directory (default `candidate/`) to check its state.

---

## Check workspace state

Work through these four checks, in order. The first one that's true tells you which state the candidate is in — stop there.

`candidate/.onboarding-state.json` is the one progress record home and the tracker both read. `src/core/onboarding-state.js` derives each step from workspace files. `materialIngested` tracks check 3. The seven `sections` track grill intake. The tracker shows this list while onboarding is incomplete, then a "✓ Onboarding complete" pill once every step is done. If the file is missing (older workspaces), use the checks below.

Home still shows six steps. Those map through `HOME_STEP_TO_TRACKER_STEPS` in `src/core/onboarding-state.js`. A home step is done only when every mapped key is done, except Download RB and Start RB, which are done as soon as the home page is served.

| Home step | Tracker step(s) |
| --- | --- |
| Download RB | none. Done when the home page loads. The running server is the proof. Not a tracker step. |
| Start RB and open this page | none. Done when the home page loads. Not a tracker step. |
| Add your files to `my-documents` | Your resumes and notes are read in (`materialIngested`) |
| Answer a few questions | Basic information (`basicInfo`) and Target role (`targetRole`) |
| Get your first draft | `firstDraftReady` (home-only). Ticks when `candidate/outputs/resumes` has at least one real resume file. Dotfiles and README placeholders do not count. Not a tracker checkbox. |
| Add jobs you want | First role added (`firstRoleAdded`) |

The other grill sections (work history, education, location, compensation, deal breakers) appear only on the tracker. They turn done when those files contain that data, or when the person recorded an explicit skip.

### 1. Does the workspace exist?

Check whether `candidate/profile.json` exists (substitute the candidate's actual `--workspace` path if they're using something other than the default `candidate/`).

- **Missing** → **State 0: No workspace yet.**
- **Exists** → continue to check 2.

### 2. Are the input folders still just their scaffolded template state?

The person drops files in `my-documents`. You copy them into `candidate/inputs/` before ingest. `npm run setup` scaffolds `candidate/inputs/resumes/` (empty except `.gitkeep`), `candidate/inputs/notes/intake.md` (a blank question template), and `candidate/inputs/links.md` (a commented one-link-per-line template) — see [Candidate workspace](../candidate-workspace.md). Check whether any of these hold real candidate material yet:

- `my-documents/` has any file besides `START-HERE.txt` and `sample-resume.txt`.
- `inputs/resumes/` has any file besides `.gitkeep`.
- `inputs/notes/intake.md` has been edited — real answers under its headings, not just the blank template from `templates/candidate-intake.md`.
- `inputs/notes/` has any other file besides `intake.md` and `.gitkeep`.
- `inputs/links.md` has any non-comment line (the template is all `#`-prefixed placeholder text).
- The candidate has already mentioned a GitHub username in conversation.

None of these true → **State 1: Workspace scaffolded, nothing real added yet.**
Any true → continue to check 3.

### 3. Is the evidence ledger still empty?

Check `candidate/evidence.jsonl` (or the workspace's evidence file). If it's empty (zero lines) — nothing has been ingested yet, even though real material exists in `inputs/` — that's **State 2: Material dropped, not yet ingested.**

If it has at least one entry, continue to check 4.

### 4. Does the profile still equal the default scaffold?

Check `candidate/profile.json`'s `experience` array (see `createDefaultProfile()` in `src/core/candidate-profile.js` for the exact default shape — a fresh scaffold has `experience: []`). If it's still empty, ingestion has populated raw evidence but the candidate hasn't been interviewed yet — that's **State 3: Ingested, intake interview not started.**

### Short-circuit: returning candidate

If `profile.json`'s `experience` array has at least one entry, the candidate has already been through intake. **Skip onboarding messaging entirely** — don't greet them with any of the states below. Proceed directly to whatever they asked for (tailoring a resume, finding roles, checking their tracker, etc.).

---

## State 0: No workspace yet

**Say first**, before any setup, if they have not seen the start page yet:

"I'm opening a one-page briefing in your browser. It covers the profile, the resume, the role list, and the interview brief. Tell me when you can see it."

Open `docs/first-run/guide.html`. Wait until they can see it.

**Then say:**

"I'll make a private folder on your computer for your resumes and notes. It stays on this machine. I will not publish it."

**Do:**

```bash
npm run setup
```

**`npm run setup` already opens a concrete preview for you.** It writes an initial (empty) `tracker.html`. Open it from the home page ("Open my tracker") at http://localhost:4321/tracker.html. The file also lives at `candidate/outputs/tracker.html`. Seeing the tracker now, empty, gives the candidate a concrete payoff before they've invested any time in intake.

**Say:**

"That page is your job list. It is empty on purpose. It fills in as we add real jobs. Each row will say where things stand, in plain words."

Then move straight into State 1's messaging below — the candidate is now in that state.

**Worktree note (agent-facing, not for the candidate):** `candidate/` is gitignored on purpose, for privacy — but a side effect of being gitignored is that it's *not* shared across git worktree checkouts. Each worktree has its own separate, untracked `candidate/` directory on disk. If files get dropped into one checkout's `candidate/` folder (by the candidate, by Dave, or by a session running elsewhere), a session running from a different worktree won't see them — the workspace-state check above will read as State 0 or State 1 even though real material exists in another checkout. Work from the same checkout/worktree consistently for a given candidate workspace, or copy/symlink `candidate/` across worktrees if you genuinely need to share it.

---

## State 1: Workspace scaffolded, nothing real added yet

**Do:** Open `my-documents` (`open` / `start` / `xdg-open`). Name the path. If Open folder fails, open `my-documents` from the repo root yourself.

**Say:**

Say both sentences under "Old material" in [`docs/first-run/what-to-say.md`](../first-run/what-to-say.md). Do not add a third version.

If they ask about LinkedIn, then say you cannot read a page behind a login, and a public GitHub username is fine.

**Wait** for the candidate to confirm they've dropped material, or to ask for help deciding what to include (in which case, point them at the "before you begin" checklist in [Getting started](../getting-started.md) and wait again).

Once they confirm, copy files from `my-documents` into `candidate/inputs/resumes` or `candidate/inputs/notes`, then move to State 2's messaging.

---

## State 2: Material dropped, not yet ingested

**Say:**

"I'll read what you added and turn it into a list of facts we can check. I won't write a resume yet. Want me to do that now?"

**Wait** for confirmation, then **do:**

```bash
npm run workspace:ingest -- --workspace candidate
```

With no `--resume`, `--notes`, `--input`, or `--github`, ingest reads `candidate/inputs/resumes` and `candidate/inputs/notes` (non-recursive), plus `candidate/inputs/links.md`. It prints each file it read and each file it skipped, with the reason. Unchanged setup templates are skipped: `inputs/notes/intake.md` while it still matches the blank template, and `inputs/links.md` when every line is blank or a `#` comment. `--links` adds extra link files on top of that scan. `--resume`, `--notes`, `--input`, or `--github` skip the folder scan and read only the sources you pass. `--links` still adds if you pass it too. Report back what was ingested (the command prints a source/entry count).

Then move to State 3's messaging.

---

## State 3: Ingested, intake interview not started

**Say:**

"I have your files, and I still need your story in order. I'll ask one question at a time, about jobs, the kind of role you want, where you can work, and pay if you want to share it. Correct me when I'm wrong. You can skip any question."

**Wait** for confirmation, then **hand off to [`grill.md`](grill.md)** — follow that playbook's "Start the intake conversation" section from here.

---

## Returning candidate

No messaging — this state is a deliberate no-op. A candidate with a populated profile has already been onboarded; interrupting them with setup/drop-docs/ingest/grill prompts on every session would be noise, not help.

---

## Tips

- **One step at a time.** Don't dump all four states' instructions on the candidate at once — greet them at their actual state, wait for a response, then move forward.
- **Re-check state, don't assume progression.** A candidate might add more resumes after grill intake, or skip straight from State 1 to sharing a GitHub username. Re-run the state check rather than assuming the next state always follows in order.
- **The short-circuit is not a one-time check.** Run the four-state check at the start of every session in this repo — most sessions with a returning candidate will hit the short-circuit immediately and move on.

---

## Schema reference

- `candidate/profile.json`, `candidate/evidence.jsonl`: see [Candidate workspace](../candidate-workspace.md) and [Candidate workspace schemas](../workspace-schemas.md).
- Next playbook: [`grill.md`](grill.md) — the intake interview this playbook hands off to.

See [`onboarding-sample-transcript.md`](onboarding-sample-transcript.md) for a walkthrough against a fresh, empty workspace.
