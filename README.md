# 📄 Resume builder

Evidence-backed resume workspace tooling for AI-assisted job searches.

This project is designed to be used with a **terminal agent** such as GitHub Copilot CLI, Claude, ChatGPT, or another assistant that can work in your repo. You can run the local CLI without an agent, and it is still useful for organizing resumes, roles, evidence, and trackers. The real value comes from the agent interaction: it runs the workflow with you, asks clarifying questions, helps connect your experience to roles, and does most of the writing and research work from evidence-backed files.

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
- A markdown application tracker.
- Similar-role search briefs and scoring notes.
- Follow-up questions and strategy notes when you use an agent.

The current modular workflow does not yet generate finished DOCX resumes. It prepares the structured workspace, evidence ledger, tracker, and similar-role review that an agent or future generator can use.

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
