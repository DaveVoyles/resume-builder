# Onboarding playbook

**Onboarding** is the proactive, state-aware first-run sequence: workspace setup, dropping in real source material, ingesting it, and starting the grill intake interview. It replaces guessing at "what step is this candidate on" with a quick check of the workspace's actual state, then greeting the candidate at the right point instead of always starting from step one.

This playbook covers **workspace-init → drop-docs → ingest → grill intake only**. Once the candidate has a populated profile, later stages (find-roles, tailor, tracker) are already well documented — see [Playbooks](README.md) and hand off to `grill.md` at the end of this one.

Before you start:

- Run this check at the start of any session in this repo, before doing anything else — it's how you decide whether to greet the candidate with onboarding messaging or get straight to whatever they asked for.
- You need read access to the candidate workspace directory (default `candidate/`) to check its state.

---

## Check workspace state

Work through these four checks, in order. The first one that's true tells you which state the candidate is in — stop there.

`candidate/.onboarding-state.json` (design plan 0006 D1) mechanically backs these same states as onboarding progresses — `materialIngested` tracks check 3, and `sections` tracks check 4's finer-grained progress through [`grill.md`](grill.md)'s seven sections. A future deliverable renders this as a visual checklist on the tracker page; for now it's a mechanical record only. It doesn't replace the manual checks above; read it as a shortcut when it's present, but fall back to the checks themselves for any workspace created before this file existed.

### 1. Does the workspace exist?

Check whether `candidate/profile.json` exists (substitute the candidate's actual `--workspace` path if they're using something other than the default `candidate/`).

- **Missing** → **State 0: No workspace yet.**
- **Exists** → continue to check 2.

### 2. Are the input folders still just their scaffolded template state?

`npm run setup` scaffolds `inputs/resumes/` (empty except `.gitkeep`), `inputs/notes/intake.md` (a blank question template), and `inputs/links.md` (a commented one-link-per-line template) — see [Candidate workspace](../candidate-workspace.md). Check whether any of these hold real candidate material yet:

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

**Say:**

"Welcome — let's get your workspace set up. I'll run the setup command, which creates a private `candidate/` folder for your resumes, notes, and generated files. None of it gets committed to Git."

**Do:**

```bash
npm run setup
```

**`npm run setup` already opens a concrete preview for you** — it writes an initial (empty) `tracker.html` and auto-launches the local server, opening a browser tab automatically. There's no separate `build-tracker`/`serve` step to run; seeing the tracker now, empty, gives the candidate a concrete payoff before they've invested any time in intake.

**Say:**

"You should already have a browser tab open — that's your tracker dashboard, live. It's empty right now, but as you add roles and I tailor resumes for them, this page fills in — funnel stage counts, application status, stale-application flags, all in one view. It'll rebuild automatically each time we update it."

Then move straight into State 1's messaging below — the candidate is now in that state.

**Worktree note (agent-facing, not for the candidate):** `candidate/` is gitignored on purpose, for privacy — but a side effect of being gitignored is that it's *not* shared across git worktree checkouts. Each worktree has its own separate, untracked `candidate/` directory on disk. If files get dropped into one checkout's `candidate/` folder (by the candidate, by Dave, or by a session running elsewhere), a session running from a different worktree won't see them — the workspace-state check above will read as State 0 or State 1 even though real material exists in another checkout. Work from the same checkout/worktree consistently for a given candidate workspace, or copy/symlink `candidate/` across worktrees if you genuinely need to share it.

---

## State 1: Workspace scaffolded, nothing real added yet

**Say:**

"Your workspace is ready. Now I need some real material to work with — the more you give me, the better the resumes I can generate and the better I can match you to roles. There are four ways to hand me material, and you can use any combination:

- Drop resume files (`.docx`, `.md`, `.txt`) into `candidate/inputs/resumes/`.
- Add freeform notes — projects, metrics, career history — to `candidate/inputs/notes/intake.md` or new files in that folder.
- List portfolio, writing, or talk links in `candidate/inputs/links.md`, one per line.
- Share your GitHub username, and I'll pull your public profile and repos.

Note: LinkedIn profile pages are login-walled, so there's no automatic LinkedIn pull the way there is for GitHub. If you want your LinkedIn history included, either export your data (LinkedIn Settings > 'Get a copy of your data') and drop the relevant parts into your notes file, or add your LinkedIn URL to `links.md` as a reference link — it'll be recorded, just not scraped for content.

Take your time — let me know when you've added something, or ask 'what should I include?' if you want help deciding."

**Wait** for the candidate to confirm they've dropped material, or to ask for help deciding what to include (in which case, point them at the "before you begin" checklist in [Getting started](../getting-started.md) and wait again).

Once they confirm, move to State 2's messaging.

---

## State 2: Material dropped, not yet ingested

**Say:**

"Got it — want me to ingest that now? I'll read what you've added and extract structured evidence from it."

**Wait** for confirmation, then **do:**

```bash
npm run workspace:ingest -- --workspace candidate \
  --resume <file> --notes <file> --links candidate/inputs/links.md --github <username>
```

Pass only the flags that apply — e.g. skip `--github` if the candidate didn't share a username, repeat `--resume`/`--notes`/`--links` for multiple files. Report back what was ingested (the command prints a source/entry count).

Then move to State 3's messaging.

---

## State 3: Ingested, intake interview not started

**Say:**

"I've pulled in what you shared, but I still don't have your structured work history, target roles, or preferences — that's what makes the difference between a generic resume and one tailored to you. Want to do a quick intake interview now? I'll ask about your work history, target roles, location, and compensation, one question at a time, and you can confirm or correct what I propose. The more information I have, the better the resumes I can generate and the more accurately I can find matching roles."

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
