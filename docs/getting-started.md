# Getting started

Try this with a terminal agent:

```text
Download https://github.com/DaveVoyles/resume-builder and help me get started. Run the sample workflow first, then help me create a private workspace for my resume, notes, and job links. Ask clarifying questions before making resume claims.
```

Resume Builder helps you organize a targeted job search around source-backed evidence. Start with the fictional sample, then create a private workspace for real candidate data.

---

## Start in one of two ways

### Recommended: use an agent

Use this path if terminal commands are new to you. Ask a terminal agent to download the repo, run the sample, create your workspace, and ask follow-up questions before drafting anything.

An agent can help you:

- Run the setup commands.
- Explain generated files.
- Ask about missing work history, education, projects, metrics, and preferences.
- Avoid unsupported resume claims.
- Turn workspace evidence into resume strategy notes and application answers.

### Do it yourself

Run:

```bash
npm install
npm start
```

`npm start` runs the fictional sample workflow. You should see generated sample outputs under `examples/sample-candidate/outputs/`.

## Create your private workspace

When you are ready to use real data, run:

```bash
npm run setup
```

This creates a local `candidate/` workspace with:

- `inputs/resumes/` for source resumes.
- `inputs/notes/intake.md` for background notes and follow-up answers.
- `profile.json` for structured candidate facts.
- `evidence.jsonl` for source-backed facts.
- `roles.seed.json` and `roles.tracked.json` for job search tracking.
- `outputs/` for generated local outputs.

## Before you begin

Gather:

- Your current resume, ideally as `.docx`, `.md`, or `.txt`.
- Older resumes with projects or accomplishments you may want to reuse.
- LinkedIn, portfolio, personal site, or GitHub links.
- Notes about projects, metrics, launches, teams, publications, or speaking work.
- Three job links that represent roles you believe are a good fit.
- Constraints, such as location, compensation, industries to avoid, or claims to avoid.

## What good looks like

After setup, you should be able to say:

- The sample workflow runs successfully.
- Real candidate files are in `candidate/`, not committed to Git.
- The workspace has an intake note with unanswered questions.
- The tracker and similar-role files are generated from structured workspace data.
- `npm run check:privacy` passes before you share anything.

## Related pages

- [Agent workflow](agent-workflow.md)
- [CLI workflow](cli-workflow.md)
- [Candidate workspace](candidate-workspace.md)
