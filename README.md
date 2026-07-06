# 📄 Resume builder

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node.js 16+](https://img.shields.io/badge/node-%3E%3D16-339933?logo=node.js&logoColor=white)
![No API key required](https://img.shields.io/badge/API%20key-not%20required-brightgreen)

Evidence-backed resume workspace tooling for AI-assisted job searches.

This project is designed to be used with a **terminal agent** such as GitHub Copilot CLI, Claude, ChatGPT, or another assistant that can work in your repo. You can run the local CLI without an agent, and it is still useful for organizing resumes, roles, evidence, and trackers. The real value comes from the agent interaction: it runs the workflow with you, asks clarifying questions, helps connect your experience to roles, and does most of the writing and research work from evidence-backed files.

## 🤔 Why use this

Job searches get messy fast: dozens of tabs, a resume that drifts further from the truth with every "polish" pass, and no record of *why* you claimed a skill or metric when an interviewer asks you to defend it. This project keeps the search structured and honest:

- **Claims stay backed by evidence.** Every resume-worthy fact is tied back to a source — your actual resume text, a note, a repo — in an evidence ledger, so you're never caught defending a bullet point you can't explain in an interview.
- **Nothing leaks by accident.** Real resumes, notes, and application data are private by default and gitignored; only reusable code, docs, and a fictional sample are ever committed.
- **You're not locked into one AI vendor.** It's a plain Node.js CLI that any terminal agent (GitHub Copilot CLI, Claude, ChatGPT, or none at all) can drive. No OpenAI/Anthropic/GitHub API key required.
- **Applications stay organized without a spreadsheet.** One command regenerates a markdown tracker and an interactive, searchable HTML tracker straight from structured JSON — so status, compensation, and links never drift out of sync with what you actually track.

## 👥 Who it's for

Anyone running a multi-application job search who wants their resume claims and tracker to hold up under scrutiny — especially candidates applying to several roles at once, working with an AI assistant, or anyone tired of maintaining tracker spreadsheets and resume versions by hand.

## 🚀 Start here

### Recommended: ask a terminal agent

If you already use GitHub Copilot CLI, Claude, ChatGPT, or another assistant from your terminal, paste this:

```text
Download https://github.com/DaveVoyles/resume-builder and help me get started. Run the sample workflow first, then help me create a private workspace for my resume, notes, and job links. Ask clarifying questions before making resume claims.
```

### Do it yourself

```bash
npm install
npm start
```

`npm start` runs the fictional sample workflow so you can see the tracker and similar-role review before adding real candidate data.

## 🧭 What happens next

1. 🧪 Try the fictional sample.
2. 🗂️ Create a private candidate workspace.
3. 📄 Add a resume, notes, links, and a few target jobs.
4. 🙋 Let an agent ask follow-up questions.
5. 📊 Review the tracker, similar-role notes, and unsupported-claim warnings.
6. ✅ Validate the workspace before using or sharing outputs.

## 🎁 What this creates

- A private candidate workspace.
- An evidence ledger that ties resume claims back to source material.
- A markdown application tracker **and** an optional interactive HTML tracker (searchable, filterable, with summary stat cards — see example below).
- Similar-role search briefs and scoring notes.
- Follow-up questions and strategy notes when you use an agent.

The current modular workflow does not yet generate finished DOCX resumes. It prepares the structured workspace, evidence ledger, tracker, and similar-role review that an agent or future generator can use.

### 👀 See it in action

Running `npm start` builds a tracker from the fictional sample workspace. The markdown version looks like this:

```markdown
# Application Tracker

| Company | Role | Location | Compensation | Fit | Applied | Job URL | Apply URL | Resume | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Northwind Tools | Senior product manager, AI developer workflows | Remote, United States | $170,000–$220,000 | strong: ... | interested | [Job](...) | [Apply](...) | outputs/resumes/... | ... |
```

Add `--format html` to get the same data as a self-contained, offline HTML page with stat cards (total roles, applied, not-applied, rejected, average compensation) plus a live search box and status filters — open it straight in a browser, no server required:

```bash
npm run workspace:tracker -- --workspace candidate --format html
```

## 🔒 Privacy promise

Real candidate inputs and generated outputs are ignored by default. The included sample candidate is fictional and safe to inspect.

Before sharing or pushing changes, run:

```bash
npm run check:privacy
```

## 📚 Learn more

| Need | Read |
| --- | --- |
| First-time setup | [Getting started](docs/getting-started.md) |
| Agent-assisted workflow | [Agent workflow](docs/agent-workflow.md) |
| CLI-only workflow | [CLI workflow](docs/cli-workflow.md) |
| Workspace files and privacy | [Candidate workspace](docs/candidate-workspace.md) |
| Schema details | [Workspace schemas](docs/workspace-schemas.md) |
| Claim safety | [Accuracy and claims](docs/accuracy-and-claims.md) |

## ✅ Requirements

- Node.js 16+ and npm. Node 18+ is recommended.
- Git for cloning the repo and running privacy checks.
- An AI assistant is optional, but recommended for non-technical users.

No OpenAI, Anthropic, or GitHub Copilot API key is required by the local CLI.
