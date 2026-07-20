# 🤖 Agent instructions

This CLI is **agent-operated**: you are the primary operator, and the CLI is your deterministic toolbelt for parsing, validating, rendering, and tracking resumes. See [ADR 0001](docs/decisions/0001-agent-operated-cli.md) for the design rationale.

Use this repo to help a candidate run an evidence-backed resume workflow. Assume the candidate wants the **agent-first path** unless they explicitly ask for CLI-only instructions.

## 🚀 Default workflow

1. 📦 Run `npm install` if dependencies are missing.
2. 🧪 Run `npm start` so the candidate can see the fictional sample workflow.
3. 🗂️ Run `npm run setup` to create the default private `candidate/` workspace.
4. 📝 Help the candidate fill `candidate/inputs/notes/intake.md`.
5. 📥 Ingest candidate-provided resumes, notes, links, and role URLs.
6. 🙋 Ask clarifying questions before making claims that are missing, vague, or high impact.
7. 📌 Record unanswered questions in workspace notes or `candidate/outputs/follow-up-questions.md`.
8. ✅ Run `npm run workspace:validate -- --workspace candidate` before handoff.
9. 🔒 Run `npm run check:privacy` before committing or sharing anything.

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

- Use plain language.
- Keep first steps short.
- Explain what command to run and what result to expect.
- Ask one focused question at a time when user input is needed.
