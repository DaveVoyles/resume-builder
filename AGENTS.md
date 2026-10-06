# 🤖 Agent instructions

Cursor Cloud: see [`docs/cursor-cloud.md`](docs/cursor-cloud.md).

This CLI is **agent-operated**: you are the primary operator, and the CLI is your deterministic toolbelt for parsing, validating, rendering, and tracking resumes. See [ADR 0001](docs/decisions/0001-agent-operated-cli.md) for the design rationale.

Use this repo to help a person run an evidence-backed resume workflow. The person is not technical. You drive. They talk.

## Guide the person

At the start of a new setup, before any other step:

1. Read [`docs/first-run/README.md`](docs/first-run/README.md). That file is only the index. The long path is [`docs/first-run/FAQ.md`](docs/first-run/FAQ.md).
2. Open [`docs/first-run/guide.html`](docs/first-run/guide.html) in their browser and walk the page with them.
3. Follow [`docs/first-run/FAQ.md`](docs/first-run/FAQ.md) from an empty folder through a resume, a job list, and a study guide. Say only the sentences in [`docs/first-run/what-to-say.md`](docs/first-run/what-to-say.md).

Do not ask them to run commands. Do not ask them to edit files. Do not open a practice application form during first-run.

## 🚀 Default workflow

1. 📦 Run `npm install` if dependencies are missing. You run it.
2. Open `docs/first-run/guide.html` in the browser before setup.
3. 🧭 Follow [`docs/playbooks/onboarding.md`](docs/playbooks/onboarding.md) for which step they are on. Follow [`docs/first-run/FAQ.md`](docs/first-run/FAQ.md) for what to say and what to run.

Throughout the lifecycle, not just at first launch:

4. 🙋 Ask clarifying questions before making claims that are missing, vague, or high impact.
5. 📌 Record unanswered questions in workspace notes or `candidate/outputs/follow-up-questions.md`.
6. ✅ Run `npm run workspace:validate -- --workspace candidate` before handoff.
7. 🔒 Run `npm run check:privacy` before committing or sharing anything.

## ⚠️ Claim rules

- Do not invent experience, metrics, degrees, employers, production usage, or ownership.
- Use `profile.json` and `evidence.jsonl` as the source of truth.
- If a claim lacks evidence, ask the candidate or record a follow-up question.
- Phrase low-confidence claims cautiously and mark them for candidate review.
- Do not promote a similar role to tracked status until the candidate approves it.

## 🔒 Privacy rules

- Treat `candidate/` as private workspace data.
- Do not commit real resumes, private notes, profile files, evidence ledgers, tracked roles, or generated outputs.
- Commit reusable code, docs, templates, schemas, and fictional examples only.
- If a privacy check fails, stop and fix the staged or tracked private file before proceeding.

## 💬 Communication style

- Use plain language with the person. The sentences you may say are in [`docs/first-run/what-to-say.md`](docs/first-run/what-to-say.md).
- Keep first steps short. One question, then wait.
- Tell them the result (a page opened, a Word file ready, a list updated). Do not tell them the command you ran unless they ask.
- Ask one focused question at a time when you need an answer.

## 📊 Status update recipe

When a candidate reports a status change ("I was denied for X", "I have an interview at Y", etc.), use the `set-status` command to record it deterministically:

```bash
npm run workspace -- set-status \
  --workspace candidate \
  --company "<Company Name>" \
  --title "<Role Title>" \
  --status <status> \
  [--date YYYY-MM-DD]
```

**Status enum:** `interested`, `applied`, `interview`, `offer`, `rejected`, `withdrawn`

If the candidate has more than one tracked role with the same company + title (e.g. a reapply after an earlier rejection), `set-status` refuses to guess and lists the ambiguous role IDs — re-run with `--id <role-id>` instead of `--company`/`--title` to disambiguate.

**Examples:**
- "I got rejected by Acme Corp for Senior Engineer":
  ```bash
  npm run workspace -- set-status --workspace candidate --company "Acme Corp" --title "Senior Engineer" --status rejected
  ```

- "I interviewed at TechCorp for the PM role yesterday":
  ```bash
  npm run workspace -- set-status --workspace candidate --company "TechCorp" --title "Product Manager" --status interview --date 2026-07-19
  ```

The command updates `roles.tracked.json` and rebuilds `outputs/tracker.md` and `outputs/tracker.html` automatically.
## 🎤 Intake interview (grill)

**When to use:** After the candidate has set up their workspace, run the grill intake interview to capture their work history, target roles, location preferences, compensation, and constraints.

**How to use:**

1. You are the agent. Follow [`docs/playbooks/grill.md`](docs/playbooks/grill.md). Do not ask the person to paste it somewhere else.
2. Ask one question at a time. Use the sentences in [`docs/first-run/what-to-say.md`](docs/first-run/what-to-say.md).
3. Write answers to `candidate/profile.json`, `candidate/preferences.json`, and `candidate/evidence.jsonl`. The person does not edit those files.
4. Validate: `npm run workspace:validate -- --workspace candidate`

The grill playbook is the source of truth for the questions. See the `.claude/skills/grill` skill for usage details.

## 🎓 Study guide recipe

**When to use:** Before an interview for a tracked role.

1. Gather everything relevant — profile, evidence, the tailored resume config, and the job posting — into one context bundle:
   ```bash
   npm run workspace:bundle -- --workspace candidate --company "<Company Name>" --title "<Role Title>"
   ```
   This writes `outputs/study-guide-bundles/<role-id>.json`. See [`docs/workspace-schemas.md`](docs/workspace-schemas.md#study-guide-bundle-study-guide-bundle) for the exact bundle shape.
2. Read the bundle and write the actual study guide to `outputs/study-guides/<company>/study-guide.md`, following [`docs/playbooks/study-guide.md`](docs/playbooks/study-guide.md) — organized by interview stage, with every talking point tied back to an `evidence.jsonl` entry ID.

   Write the guide in the order set by the playbook: plain-language briefing, short jargon table, optional pictures in a two-column markdown table, 60-second opener, honesty gaps, 90-minute hands-on lab, questions to ask the recruiter. Claude, Grok, and Gemini are all valid writers. Every claim cites an evidence id from the bundle; no invented product internals.

## 🗣️ Debrief recipe

**When to use:** After any interview, practice session, or grill/tailor conversation the candidate wants to learn from.

Follow [`docs/playbooks/debrief.md`](docs/playbooks/debrief.md) to run a one-question-at-a-time debrief and write structured Q&A feedback (question, answer, sentiment, proposed improvement) to `candidate/feedback.jsonl`. This never touches `profile.json` or `evidence.jsonl` directly — treat it as its own private ledger.
