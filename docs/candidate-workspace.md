# Candidate workspace

Try this:

```text
Create one workspace per candidate.
Keep private inputs and generated outputs ignored unless the candidate explicitly opts in.
```

Use a candidate workspace to keep one person's source material, evidence, target roles, generated files, and follow-up questions separate from the reusable resume engine.

---

## Workspace layout

The workspace layout uses this shape:

```text
candidate/
  inputs/
    resumes/
    notes/
    links.md
  profile.json
  preferences.json
  evidence.jsonl
  roles.seed.json
  roles.tracked.json
  claim-policy.json
  outputs/
    resumes/
    tracker.md
    similar-roles.md
    follow-up-questions.md
```

The v1 CLI creates the core JSON files, `inputs/`, `outputs/`, `outputs/tracker.md`, and `outputs/similar-roles.md`. The `outputs/follow-up-questions.md` file is an optional handoff file for unresolved candidate questions.

## What each area stores

| Path | Purpose | Track by default |
| --- | --- | --- |
| `candidate/inputs/resumes/` | Source resumes from the candidate. | No |
| `candidate/inputs/notes/` | Freeform candidate notes, preferences, and constraints. | No |
| `candidate/inputs/links.md` | Public source links, such as GitHub, portfolio, writing, or talks. | No |
| `candidate/profile.json` | Normalized candidate facts extracted from inputs. | No |
| `candidate/preferences.json` | Location, compensation, role, industry, and work-style preferences. | No |
| `candidate/evidence.jsonl` | Claim-level evidence with source references and confidence. | No |
| `candidate/roles.seed.json` | Seed roles the candidate provides. | No |
| `candidate/roles.tracked.json` | Accepted roles and application status. | No |
| `candidate/claim-policy.json` | Candidate-specific wording rules and claims to avoid. | No |
| `candidate/outputs/resumes/` | Planned tailored DOCX resumes. | No |
| `candidate/outputs/tracker.md` | Generated application tracker. | No |
| `candidate/outputs/similar-roles.md` | Recommended similar roles for review. | No |
| `candidate/outputs/follow-up-questions.md` | Questions the candidate needs to answer. | No |

## Privacy defaults

The root `.gitignore` keeps real candidate workspace data out of Git by default:

- Raw candidate source files under `candidate/inputs/`.
- Normalized candidate files, including profile, preferences, evidence, seed roles, tracked roles, and claim policy files.
- Generated modular workflow outputs under `candidate/outputs/` for the default workspace and root-level `outputs/` for alternate layouts.

Commit reusable files instead: source code, scripts, docs, schemas, templates, and fictional sample data. If a candidate wants to share a public link list, a seed role list, or an output artifact, create a sanitized copy and review it before staging.

Run the privacy check before you commit or share the repo:

```bash
npm run check:privacy
```

The check fails when private candidate workspace paths or modular outputs are staged or already tracked. If it fails, unstage the path with `git restore --staged <path>` or remove a tracked private path with `git rm --cached <path>` after confirming the file should stay local.

## Intake checklist

Collect the following inputs before generation:

- Current resumes, ideally the most complete and recent versions.
- GitHub username or profile URL, if public work supports the target roles.
- Additional notes about preferred roles, locations, industries, compensation, work authorization, availability, and deal breakers.
- Seed role URLs that show the kinds of roles the candidate wants.
- Claims to avoid, sensitive topics to omit, and facts that need cautious wording.

## Collaborative intake

Treat intake as a conversation with the candidate. The agent should ask concise clarifying questions when it needs facts, preferences, or approval to write a stronger resume. The candidate should answer with specific source material when possible, such as dates, titles, links, project names, metrics, repositories, publications, talks, or documents.

Ask about:

- **Work history:** official titles, team names, dates, responsibilities, leadership scope, business outcomes, and measurable impact.
- **Projects:** what the candidate personally built, which technologies were used, whether the work reached production, and who used it.
- **Education and credentials:** degrees, schools, dates, certifications, coursework, bootcamps, internal training, or teaching experience.
- **Evidence:** links, files, screenshots, repositories, demos, talks, or writing that support high-value claims.
- **Preferences:** target roles, industries, seniority, location, work mode, compensation, deal breakers, and companies to prioritize or avoid.
- **Claim boundaries:** topics to omit, claims to soften, metrics that need confirmation, and confidential work that cannot be described directly.

If the candidate is unavailable, do not block the whole workflow. Use the evidence that exists, avoid unsupported claims, and record questions in notes, tracker notes, or `outputs/follow-up-questions.md` for later review.

## Evidence rules

Use the evidence ledger as the source of truth for generated claims. Each evidence item should include:

- A concise fact.
- The source file, URL, or note that supports it.
- A confidence level.
- A claim category, such as employment, project, skill, metric, leadership, or education.
- Any restriction, such as "do not quantify" or "candidate must confirm."

Do not turn low-confidence facts into final resume bullets without candidate review.

## Role tracking rules

Seed roles start as research inputs. A role becomes tracked only after duplicate checks, evidence mapping, and candidate review.

The tracker should be generated from structured role data. Do not manually edit generated tracker rows unless the workflow explicitly marks the file as user-editable.

## Similar-role recommendations

Use seed roles to derive title patterns, seniority level, domain keywords, company patterns, compensation signals, and location preferences. Keep recommendations separate from tracked roles until the candidate accepts them.

Run the bounded discovery helper after seed roles and preferences exist:

```bash
npm run workspace:similar -- --workspace <workspace>
```

The command writes `outputs/similar-roles.md` with search briefs that you can copy into job boards. It does not scrape external job boards. If you manually collect candidate roles from job boards or referrals, save them in a local JSON array and score them with:

```bash
npm run workspace:similar -- --workspace <workspace> --candidates <candidate-roles.json>
```

Each recommendation should include:

- Role title and company.
- Source link.
- Fit rationale.
- Missing evidence or claim risk.
- Suggested resume strategy.

Review-before-tracking rule: do not add a similar role to `roles.tracked.json` until the candidate reviews the source posting, duplicate check, fit rationale, evidence gaps, compensation, location, work mode, and resume strategy. Accepted roles can be promoted with `npm run workspace:add-role -- --workspace <workspace> --url <url> --tracked`, then regenerated with `npm run workspace:tracker -- --workspace <workspace>`.

Use the fit score as a triage aid, not as an automatic decision. A strong score means the role resembles the seed roles and preferences; it does not prove that the candidate should apply.

## Follow-up questions

Ask questions when evidence is missing, claims need confirmation, or role decisions need candidate judgment. Keep questions specific and actionable.

Examples:

- "Can you confirm whether this project used Kubernetes in production?"
- "Which of these three seed roles best represents your target direction?"
- "Should the generated resume include this public GitHub project?"
- "What degree, certification, or education history should appear for this role?"
- "Can you share a metric for the adoption, reliability, revenue, cost, or productivity impact?"

Use the answers to update source notes, `profile.json`, `preferences.json`, `evidence.jsonl`, or role records before regenerating outputs. Keep unanswered questions visible in the handoff.

## Related pages

- [Modular architecture](modular-architecture.md)
- [Agent runbook](agent-runbook.md)
- [Accuracy and claims](accuracy-and-claims.md)
- [Role intake template](role-intake-template.md)
