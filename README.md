# 📄 Resume builder

Evidence-backed resume workspace tooling for targeted job searches.

Try this:

```bash
npm install
npm run sample:quickstart
```

## 👋 Overview

Resume Builder helps a candidate and an AI agent collaborate on targeted job applications without mixing unsupported claims into resumes or trackers. The tool creates a private candidate workspace, ingests resumes and notes into an evidence ledger, tracks seed and accepted roles, renders a markdown application tracker, and produces similar-role review output.

This repo contains the reusable modular project. Keep personal resume portfolios, generated resumes, and private candidate workspaces outside the public repository unless they use fictional sample data.

The current modular workflow does not yet generate DOCX resumes. It prepares the structured workspace, evidence ledger, tracker, and similar-role review that the planned DOCX generator can consume.

---

## ✨ Why use this tool

Use this project when you want to:

- 🧾 Turn one or more existing resumes into structured source evidence.
- 🔎 Capture GitHub, project, education, and work-history details that support resume claims.
- 📌 Track seed roles, accepted roles, application links, compensation, and status.
- 📊 Generate a readable markdown tracker for the current search.
- 🧭 Produce search briefs and score manually researched similar roles before deciding what to apply to.
- 🔒 Keep raw candidate inputs and generated outputs out of Git by default.

## ✅ Requirements

You do not need the GitHub Copilot CLI or a Copilot subscription to run the workspace CLI. The deterministic commands in this repo run locally with Node.js.

| Requirement | Needed for | Notes |
| --- | --- | --- |
| Node.js 16+ and npm | Running all `npm run ...` commands | Node 18+ is recommended. |
| Git | Cloning the repo and running privacy checks | `npm run check:privacy` uses Git to detect staged or tracked private files. |
| `unzip` | Ingesting `.docx` resumes | macOS and most Linux systems include it. Windows users can use WSL, Git Bash, or another `unzip` provider. |
| Internet access | Optional GitHub metadata ingestion | Only needed when using `--github <user>`. |
| AI assistant or Copilot CLI | Optional collaboration layer | Helpful for interviewing the candidate, tailoring strategy, and finding roles. Not required by the CLI itself. |

No OpenAI, Anthropic, or GitHub Copilot API key is required by the current code.

## 🤖 With an agent vs. without an agent

The **CLI is the product foundation**. It creates the workspace, stores evidence, renders trackers, and validates privacy boundaries. An AI agent is optional, but it makes the workflow much more useful because resume targeting requires judgment, follow-up questions, and writing support.

### 🧰 Without an agent: local CLI workflow

Use this mode when you want a structured, local job-search workspace but plan to do the thinking and writing yourself.

The CLI can:

- 🗂️ Initialize a private candidate workspace.
- 📥 Ingest resumes, notes, text files, and optional public GitHub metadata.
- 🧾 Store source-backed facts in `evidence.jsonl`.
- 📌 Create seed roles and tracked application records.
- 📊 Render a markdown application tracker.
- 🧭 Generate similar-role search briefs.
- ⚖️ Score manually collected candidate roles against seed-role patterns.
- 🔒 Validate workspace files, tracker freshness, and privacy boundaries.

The CLI does **not** currently:

- Write finished DOCX resumes.
- Automatically scrape job boards.
- Automatically decide which jobs you should apply to.
- Interview the candidate for missing details.
- Rewrite resume bullets or application answers on its own.

### 🧠 With an agent: collaborative resume strategy workflow

Use this mode when you want the tool to feel like a resume strategist plus researcher working from the structured CLI files.

An agent can:

- 🙋 Interview the candidate about missing work history, education, metrics, projects, and preferences.
- 🔍 Map candidate evidence to job requirements.
- ✍️ Draft resume strategy notes, application answers, and follow-up questions.
- ⚠️ Identify unsupported, risky, inflated, or vague claims.
- 🧭 Research similar roles manually and explain fit.
- ✅ Recommend which roles should be promoted from review to tracked status.
- 🧑‍💼 Help the candidate decide what to emphasize for each role.

Think of the CLI as the **filing system and validation layer**. Think of the agent as the **resume strategist and researcher** that uses those files safely.

## 🧭 What the workflow looks like

### Path A: CLI-only

```bash
npm run workspace:init -- --workspace candidate
npm run workspace:ingest -- --workspace candidate --resume ./my-resume.docx --notes ./notes.md
npm run workspace:add-role -- --workspace candidate --url https://example.com/job
npm run workspace:similar -- --workspace candidate
npm run workspace:tracker -- --workspace candidate
npm run workspace:validate -- --workspace candidate
```

Then you manually review:

- 📄 `candidate/profile.json`
- 🧾 `candidate/evidence.jsonl`
- 📌 `candidate/roles.seed.json`
- 📊 `candidate/outputs/tracker.md`
- 🧭 `candidate/outputs/similar-roles.md`

This is structured and private, but it is more hands-on. You provide the judgment, rewrite the content, and decide which roles to pursue.

### Path B: agent-assisted

1. 🧰 Run the same CLI commands to create and validate the workspace.
2. 🤖 Ask an agent to review the workspace files and role links.
3. 🙋 Let the agent ask clarifying questions about work history, education, projects, metrics, and preferences.
4. ✍️ Have the agent draft role positioning, resume strategy notes, and application answers from evidence.
5. ⚠️ Review the agent's unsupported-claim warnings and follow-up questions.
6. 📌 Promote only candidate-approved roles to tracked status.
7. ✅ Run `npm run workspace:validate -- --workspace candidate` before using outputs.

This is the recommended experience if you have access to a capable coding agent.

## 🧑‍🚀 Which agent should I use?

You can use this project with any AI assistant that can read files and help you edit a workspace. The best experience comes from an agent that can work directly in the repository.

### Recommended: GitHub Copilot CLI

GitHub Copilot CLI is a good fit because it can operate in the terminal, read and edit local files, run validation commands, and use repository instructions.

Helpful Copilot CLI commands include:

- `/login` — sign in to GitHub Copilot.
- `/agent` — browse and select available agents.
- `/model` — choose the model to use.
- `/plan` — plan a larger migration or resume workflow before editing.
- `/review` — review code changes.
- `/fleet` — use parallel subagents for larger work, such as research plus docs plus validation.

You need GitHub Copilot access to use GitHub Copilot CLI. You do **not** need Copilot to run this repo's local CLI commands.

### Other workable options

You can also use:

- ChatGPT, Claude, Gemini, or another assistant by copying relevant files and outputs into the chat.
- A local model or local agent if it can read the workspace files.
- A human-only workflow, using the CLI outputs as structured notes.

### Copilot plans and cost

GitHub's current Copilot plan documentation lists:

- 🆓 **Copilot Free** — limited access for individual developers.
- 🎓 **Copilot Student** — free for verified students.
- 💼 **Copilot Pro** — listed at **$10 USD/month**.
- ⚡ **Copilot Pro+** — listed at **$39 USD/month**.
- 🚀 **Copilot Max** — listed at **$100 USD/month**.
- 🏢 **Copilot Business** — listed at **$19 USD per granted seat/month**.
- 🏛️ **Copilot Enterprise** — listed at **$39 USD per granted seat/month**.

See GitHub's current plan page before choosing a plan because availability and pricing can change: `https://docs.github.com/en/copilot/get-started/plans`.

> ℹ️ GitHub's plan documentation may include temporary sign-up restrictions or plan availability notes. Check the official page for the latest details.

## 🗂️ Repository layout

| Path | Purpose |
| --- | --- |
| `src/cli/` | Workspace CLI commands for initialization, ingestion, role intake, tracker rendering, similar-role review, and validation. |
| `src/core/` | Workspace I/O, schemas, evidence, profile, IDs, and similar-role scoring. |
| `src/adapters/` | Source adapters for local notes/resumes, public GitHub metadata, and role records. |
| `src/renderers/` | Markdown renderers for trackers and similar-role review output. |
| `docs/modular-architecture.md` | Reusable architecture for friend or multi-candidate workflows. |
| `docs/candidate-workspace.md` | Candidate workspace layout, collaboration flow, and privacy defaults. |
| `docs/workspace-schemas.md` | JSON and JSONL schema contracts for workspace files. |
| `docs/generator-refactor-plan.md` | Planned DOCX generator architecture. |
| `examples/sample-candidate/` | Fictional privacy-safe sample workspace. |
| `scripts/check-privacy.js` | Blocks private candidate workspace files or modular outputs from being staged or tracked. |
| `scripts/check-workspace.js` | Validates workspace schema and tracker freshness. |

## 🚀 Common workflows

### 1. Install dependencies

Run this once after cloning or after dependency changes:

```bash
npm install
```

### 2. Try the sample workspace

Run the fictional sample workspace before you create a real candidate workspace:

```bash
npm run sample:quickstart
```

The command renders the sample tracker, builds the sample similar-role review, and validates the sample workspace. The sample uses fictional data and `.invalid` links so it is safe to inspect and share.

### 3. Create a private candidate workspace

Use this sequence for a new candidate:

```bash
npm run workspace:init -- --workspace candidate
npm run workspace:ingest -- --workspace candidate --resume path/to/resume.docx --notes path/to/notes.md --github githubUser
npm run workspace:add-role -- --workspace candidate --url https://example.com/job
npm run workspace:similar -- --workspace candidate
npm run workspace:tracker -- --workspace candidate
npm run workspace:validate -- --workspace candidate
```

Read these guides before using the workflow with real candidate data:

- `docs/modular-architecture.md`
- `docs/candidate-workspace.md`
- `docs/workspace-schemas.md`
- `examples/sample-candidate/README.md`

### 4. Use the workspace CLI

| Workflow | Command |
| --- | --- |
| Initialize a candidate workspace | `npm run workspace:init -- --workspace <dir>` |
| Ingest resumes, notes, text, or public GitHub metadata | `npm run workspace:ingest -- --workspace <dir> --resume <file> --notes <file> --github <user>` |
| Add a seed or tracked role | `npm run workspace:add-role -- --workspace <dir> --url <url>` or add `--tracked` |
| Build similar-role review output | `npm run workspace:similar -- --workspace <dir> [--candidates <file>]` |
| Render the application tracker | `npm run workspace:tracker -- --workspace <dir>` |
| Validate workspace files and tracker freshness | `npm run workspace:validate -- --workspace <dir>` |
| Run the fictional sample workflow | `npm run sample:quickstart` |

`find-similar` is a bounded discovery helper, not a job-board scraper. It derives search briefs from seed roles and preferences, scores optional manually researched candidate roles from a local JSON file, and writes `<workspace>/outputs/similar-roles.md` for review. Promote only candidate-approved roles with `add-role --tracked`, update application state in `roles.tracked.json`, then run `workspace:tracker` and `workspace:validate`.

## 🤝 Collaborate with the candidate

The agent should treat resume generation as a collaborative interview, not a one-shot file conversion. Ask clarifying questions before making claims that are missing, vague, or high impact. If the candidate is unavailable, continue with supported evidence and record follow-up questions in workspace notes, tracker notes, or a local `<workspace>/outputs/follow-up-questions.md` handoff file.

Good clarifying questions ask for specific evidence:

- "Which roles, teams, and dates should this work-history entry use?"
- "What measurable outcome can you share for this project?"
- "Was this technology used in production, a prototype, or a side project?"
- "Which education, certifications, or training should appear on the resume?"
- "Which claims should the resume avoid or phrase cautiously?"
- "Which seed role best represents the kind of job you want next?"

The candidate should review generated positioning, similar-role recommendations, unsupported claims, compensation and location assumptions, and any role marked ready to apply. Do not promote a similar role to tracked status or add a low-confidence claim without candidate review.

## 🔒 Privacy boundaries

Keep real candidate inputs and generated modular outputs local by default. The root `.gitignore` excludes `candidate/inputs/`, candidate profile and role data files, candidate claim policies, `candidate/outputs/`, and root-level `outputs/`.

Run this before sharing a branch or giving the repo to a friend:

```bash
npm run check:privacy
```

The privacy check fails if private workspace paths are staged or already tracked. Commit reusable code, docs, scripts, templates, schemas, and fictional examples instead.

## 🧪 Validation

Run the modular validation gate before pushing reusable changes:

```bash
npm run validate
```

This command renders and validates the sample candidate workspace, then runs the privacy check.
