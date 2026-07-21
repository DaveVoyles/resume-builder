# 🚀 Getting started

Try this with a terminal agent:

```text
Download https://github.com/DaveVoyles/resume-builder and help me get started. Run the sample workflow first, then follow docs/playbooks/onboarding.md to create my private workspace, walk me through dropping my resume, notes, and job links into candidate/inputs/, and start my grill intake interview when I'm ready. Ask clarifying questions before making resume claims.
```

Resume Builder is designed for an **agent-first workflow**. The easiest path is to let a terminal agent guide setup, ask clarifying questions, and keep resume claims tied to source evidence. The agent is the primary operator; the CLI is a deterministic toolbelt for validation and rendering. See [ADR 0001: Agent-operated CLI](../decisions/0001-agent-operated-cli.md) for the design rationale.

New here? [`docs/playbooks/onboarding.md`](playbooks/onboarding.md) is the proactive, state-aware sequence an agent follows: it checks what you've already set up and picks up wherever you left off, instead of always starting from scratch.

---

## 🤖 Recommended path: use an agent

Use this path if you want the simplest experience. Ask a terminal agent to download the repo, run the sample, create your workspace, and interview you before drafting anything.

An agent can help you by following packaged **playbooks** from [`docs/playbooks/`](playbooks/) — vendor-neutral markdown instructions for intake interviews, workspace validation, and resume tailoring. The agent does the semantic work (asking clarifying questions, drafting strategy); the CLI validates the output.

An agent can help you:

- 🧰 Run setup commands.
- 📂 Explain generated files.
- 🙋 Ask about missing work history, education, projects, metrics, and preferences.
- ⚠️ Avoid unsupported resume claims.
- ✍️ Turn workspace evidence into resume strategy notes and application answers.

## 🧪 First success: run the sample

The first goal is to make sure the fictional sample works. Your agent can run this for you:

```bash
npm install
npm start
```

`npm start` runs the sample workflow. You should see generated sample outputs under `examples/sample-candidate/outputs/`.

## 🗂️ Create your private workspace

When you are ready to use real data, ask your agent to run:

```bash
npm run setup
```

This creates a local `candidate/` workspace with:

- 📄 `inputs/resumes/` for source resumes.
- 📝 `inputs/notes/intake.md` for background notes and follow-up answers.
- 🔗 `inputs/links.md` for portfolio, GitHub, writing, or talk links (one per line).
- 👤 `profile.json` for structured candidate facts.
- 🧾 `evidence.jsonl` for source-backed facts.
- 📌 `roles.seed.json` and `roles.tracked.json` for job search tracking.
- 📊 `outputs/` for generated local outputs.

Drop your material into `inputs/`, then ask your agent to ingest it:

```bash
npm run workspace:ingest -- --workspace candidate --resume <file> --notes <file> --links candidate/inputs/links.md
```

## 🎙️ Do the intake interview

Once your material is ingested, your agent should walk you through **grill intake**: a one-question-at-a-time interview covering your work history, target roles, location, and compensation, written into `profile.json`, `preferences.json`, and `evidence.jsonl`. Follow [`docs/playbooks/grill.md`](playbooks/grill.md) — the onboarding playbook hands off to it automatically once you have real material ingested.

The more you share here, the better the resumes your agent can generate and the more accurately it can match you to roles.

## 🧳 Before you begin

Gather:

- 📄 Your current resume, ideally as `.docx`, `.md`, or `.txt`.
- 🗃️ Older resumes with projects or accomplishments you may want to reuse.
- 🔗 LinkedIn, portfolio, personal site, or GitHub links (LinkedIn isn't scraped automatically — see [onboarding.md](playbooks/onboarding.md) for how to include it).
- 🧠 Notes about projects, metrics, launches, teams, publications, or speaking work.
- 🎯 Three job links that represent roles you believe are a good fit.
- 🚫 Constraints, such as location, compensation, industries to avoid, or claims to avoid.

## ✅ What good looks like

After setup, you should be able to say:

- 🧪 The sample workflow runs successfully.
- 🔒 Real candidate files are in `candidate/`, not committed to Git.
- 📝 The workspace has an intake note with unanswered questions.
- 📊 The tracker and similar-role files are generated from structured workspace data.
- ✅ `npm run check:privacy` passes before you share anything.

## 🧰 If you do not use an agent

You can still use the CLI yourself, but it is more hands-on. Start with [CLI workflow](cli-workflow.md) if you prefer to run commands and make resume strategy decisions manually.

## 📚 Related pages

- [Playbooks](playbooks/) — packaged agent instructions for intake, validation, and tailoring.
- [Agent workflow](agent-workflow.md)
- [CLI workflow](cli-workflow.md)
- [Candidate workspace](candidate-workspace.md)
- [ADR 0001: Agent-operated CLI](../decisions/0001-agent-operated-cli.md)
