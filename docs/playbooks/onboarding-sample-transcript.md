# Sample onboarding transcript

A walkthrough of the [onboarding playbook](onboarding.md)'s state-detection logic, run against a brand-new throwaway workspace (`/tmp/onboarding-walkthrough/candidate` — not the fictional `examples/sample-candidate`, which already has a populated profile and would short-circuit past every state below). Each step shows the actual command and its real output, followed by what the agent would say next per the playbook.

---

## State 0 → State 1: no workspace yet

**Check:** `candidate/profile.json` doesn't exist.

**Agent:** "Welcome — let's get your workspace set up. I'll run the setup command, which creates a private `candidate/` folder for your resumes, notes, and generated files. None of it gets committed to Git."

```
$ node src/cli/index.js init --workspace /tmp/onboarding-walkthrough/candidate
Initialized candidate workspace at /tmp/onboarding-walkthrough/candidate
```

Immediately re-checks state: `profile.json` now exists, `inputs/resumes/` is empty, `inputs/notes/intake.md` is still the blank template, `inputs/links.md` is still all comment lines, `evidence.jsonl` is empty (0 lines), `profile.json`'s `experience` array is `[]`. That's **State 1**.

---

## State 1: nothing real added yet

**Agent:** "Your workspace is ready. Now I need some real material to work with — the more you give me, the better the resumes I can generate and the better I can match you to roles. There are four ways to hand me material, and you can use any combination: drop resume files into `candidate/inputs/resumes/`, add notes to `candidate/inputs/notes/intake.md`, list links in `candidate/inputs/links.md`, or share your GitHub username. Let me know when you've added something."

**Candidate action (simulated):** drops a career notes file and fills in `links.md`:

```
$ cat candidate/inputs/notes/career-notes.md
I'm a backend engineer at a mid-size logistics company. Led the migration of our
order-tracking service from a monolith to a set of Node.js microservices, cutting
p99 latency by 35%. Mentored two junior engineers.

$ cat candidate/inputs/links.md
# Public source links
https://github.com/example-walkthrough-user
https://example-walkthrough-user.dev
```

Re-checking state: `inputs/notes/` now has a real file beyond `intake.md`, and `inputs/links.md` has non-comment lines — check 2 is now true. `evidence.jsonl` is still 0 lines. That's **State 2**.

---

## State 2: material dropped, not yet ingested

**Agent:** "Got it — want me to ingest that now? I'll read what you've added and extract structured evidence from it."

**Candidate:** confirms.

```
$ node src/cli/index.js ingest --workspace /tmp/onboarding-walkthrough/candidate \
    --notes /tmp/onboarding-walkthrough/candidate/inputs/notes/career-notes.md \
    --links /tmp/onboarding-walkthrough/candidate/inputs/links.md
Ingested 2 source(s); appended 2 evidence entries.
Profile now references 2 source(s). Latest snippet: inputs/links.md
```

Re-checking state: `evidence.jsonl` now has 2 lines (non-empty) — check 3 is now true. `profile.json`'s `experience` array is still `[]` — check 4 is also true. That's **State 3**.

---

## State 3: ingested, intake interview not started

**Agent:** "I've pulled in what you shared, but I still don't have your structured work history, target roles, or preferences — that's what makes the difference between a generic resume and one tailored to you. Want to do a quick intake interview now? I'll ask about your work history, target roles, location, and compensation, one question at a time, and you can confirm or correct what I propose. The more information I have, the better the resumes I can generate and the more accurately I can find matching roles."

**Candidate:** confirms.

**Agent:** hands off to [`grill.md`](grill.md)'s "Start the intake conversation" section — see [`grill-sample-transcript.md`](grill-sample-transcript.md) for how that conversation continues.

---

## Returning candidate (short-circuit, not exercised above)

Once grill intake adds at least one entry to `profile.json`'s `experience` array, every future session's state check hits the short-circuit immediately — the agent skips all onboarding messaging and proceeds directly to whatever the candidate asks for. This is the expected steady state for any candidate past their first session; it isn't exercised in this transcript since the point of this walkthrough is the empty-state path.
