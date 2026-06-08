# 🤖 Agent workflow

Try this:

```text
Help me use this resume-builder repo for a targeted job search. Start by running the sample workflow so I understand the output. Then help me create a private candidate workspace, ingest my resume and notes, review three job links I provide, and ask clarifying questions about my work history, education, metrics, projects, and preferences. Do not invent claims. If a fact is missing or unsupported, add it to follow-up questions instead of putting it in a resume or application answer.
```

Use this project with an agent first. The CLI keeps files structured and validates privacy boundaries; the agent turns those files into a guided resume strategy workflow.

---

## ✨ What an agent can do

An agent can:

- 🙋 Interview the candidate about missing work history, education, metrics, projects, and preferences.
- 🔍 Map candidate evidence to job requirements.
- ✍️ Draft resume strategy notes, application answers, and follow-up questions.
- ⚠️ Identify unsupported, risky, inflated, or vague claims.
- 🧭 Research similar roles manually and explain fit.
- ✅ Recommend which roles should be promoted from review to tracked status.
- 🧑‍💼 Help the candidate decide what to emphasize for each role.

Think of the CLI as the **filing system and validation layer**. Think of the agent as the **resume strategist and researcher** that uses those files safely.

## 🧑‍🚀 Which agent should I use?

You can use this project with any AI assistant that can read files and help you edit a workspace. The best experience comes from an agent that can work directly in the repository.

GitHub Copilot CLI is a good fit because it can operate in the terminal, read and edit local files, run validation commands, and use repository instructions.

Helpful Copilot CLI commands include:

- 🔐 `/login` — sign in to GitHub Copilot.
- 🤖 `/agent` — browse and select available agents.
- 🧠 `/model` — choose the model to use.
- 🗺️ `/plan` — plan a larger migration or resume workflow before editing.
- 🔎 `/review` — review code changes.
- 🚀 `/fleet` — use parallel subagents for larger work, such as research plus docs plus validation.

You need GitHub Copilot access to use GitHub Copilot CLI. You do not need Copilot to run this repo's local CLI commands.

You can also use ChatGPT, Claude, Gemini, or another assistant by copying relevant files and outputs into the chat. A local model or local agent also works if it can read the workspace files.

## 💳 Copilot plans and cost

GitHub's current Copilot plan documentation lists free, student, individual, business, and enterprise options. See GitHub's current plan page before choosing a plan because availability and pricing can change: `https://docs.github.com/en/copilot/get-started/plans`.

## 🤝 Collaboration rules

The agent should treat resume generation as a collaborative interview, not a one-shot file conversion. Ask clarifying questions before making claims that are missing, vague, or high impact.

Good clarifying questions ask for specific evidence:

- 📅 "Which roles, teams, and dates should this work-history entry use?"
- 📈 "What measurable outcome can you share for this project?"
- 🛠️ "Was this technology used in production, a prototype, or a side project?"
- 🎓 "Which education, certifications, or training should appear on the resume?"
- ⚠️ "Which claims should the resume avoid or phrase cautiously?"
- 🎯 "Which seed role best represents the kind of job you want next?"

If the candidate is unavailable, continue with supported evidence and record follow-up questions in workspace notes, tracker notes, or `<workspace>/outputs/follow-up-questions.md`.

## 📚 Related pages

- [Getting started](getting-started.md)
- [Candidate workspace](candidate-workspace.md)
- [Accuracy and claims](accuracy-and-claims.md)
