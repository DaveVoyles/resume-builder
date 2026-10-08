# Accuracy and claims

Use these rules when you write resume strategy notes, tracker entries, application answers, cover letters, or agent handoffs. The goal is strong positioning without unsupported claims.

---

## Core claim-safety rules

- Tie every claim to source evidence, such as a resume bullet, shipped project, public artifact, or confirmed note.
- Keep scope accurate. Distinguish between leading, contributing, prototyping, evaluating, and learning.
- Use exact company, product, education, and technology names only when the source confirms them.
- Do not invent metrics, dates, customers, revenue impact, adoption, performance gains, or security outcomes.
- Prefer clear, factual language over hype.

## Evidence-ledger checks

Run workspace validation before generating output. The evidence ledger must connect each source-backed fact to a source descriptor and a supporting `snippet` or `quote`.

Treat `metadata-only` evidence as a source inventory record, not as claim support. If a metadata-only entry states a fact that differs from its ingestion summary, the validator flags it as unsupported so you can capture source text or ask the candidate for confirmation before output.

## Evidence-backed claim audit (blocking)

`validate` enforces the evidence-backed promise mechanically, not just as writing guidance. If a workspace has a `resume-configs/` directory (see [Candidate workspace schemas](workspace-schemas.md#resume-render-config-render-resume)), `validate` scans every resume config's `summary.text`, job `bullets`, and `skills` values for metric claims — percentages, multipliers ("3x"), money amounts, scaled counts ("50 million users"), plain counts with a resume-typical noun ("200 customers"), team sizes ("team of 12"), and years of experience ("8+ years") — and cross-checks each one against the workspace's `evidence.jsonl` ledger (`src/core/claim-audit.js`).

- **Unsupported claim → blocking failure.** If no evidence entry's `fact`, `snippet`, or `quote` states the same figure (in the same category — a `40%` claim is never satisfied by an unrelated `40 employees` entry), `validate` fails with a per-claim error naming the exact field (e.g. `experienceSections[0].jobs[0].bullets[1]`), the claim text, and the surrounding snippet, so an agent can fix the config without guessing which claim is unsupported. As with the ledger checks above, `metadata-only` evidence never counts as support.
- **Bound claims are checked against the entries they name.** `ingest` writes one evidence entry per resume job header, bullet, or paragraph. A job (`evidenceIds`), a single bullet (`bulletEvidenceIds`), or the summary (`summary.evidenceIds`) can list the entry ids that prove its numbers. When it does, a number that those entries do not state is a blocking failure, even if another entry in the ledger has it. The message names the entries that do state it, if any. An id that is not in `evidence.jsonl` also blocks.
- **Unbound claims → non-blocking warning.** Without ids the number is still matched against the whole ledger, and `validate`/`tailor` warn "Not tied to specific evidence". Add the id to clear it.
- **Thin ledger → non-blocking warning.** Even when every claim currently checks out, `validate` prints a warning (not a failure) when a resume config's workspace has fewer than three source-backed evidence entries — a nudge to ingest more source material before treating the config's claims as fully vetted, since a thin ledger makes it easy for a later edit to introduce an unsupported figure unnoticed.
- A workspace without a `resume-configs/` directory validates exactly as before; the claim audit only runs against resume configs that exist.

**Cover letters get the same audit, at a different point in the pipeline.** Cover-letter body paragraphs are scanned by the identical claim-detection logic (`auditCoverLetterConfig`, same `CLAIM_PATTERNS`) — but this runs at render time (`render-cover-letter`, or `tailor --cover-letter`), not as part of `validate`'s workspace-wide sweep. An unsupported claim in a cover letter blocks the render exactly like an unsupported resume bullet blocks `render-resume`/`tailor`; there is currently no separate `validate`-time check for a `cover-letter-configs/` directory the way there is for `resume-configs/`. See [Cover letter render config](workspace-schemas.md#cover-letter-render-config-render-cover-letter) and the [cover-letter playbook](playbooks/cover-letter.md).

**Known limitation:** claim detection is regex-based against a closed set of metric patterns and a closed noun whitelist (`src/core/claim-audit.js`'s `CLAIM_PATTERNS`), by deliberate design — a narrow, deterministic pattern set avoids both false-positiving on incidental numbers in prose and needing an LLM in the loop (ADR 0001's agent-operated-CLI posture). A metric phrased with a noun outside the whitelist (e.g. "50 stakeholders") is not detected and so is not audited. This mechanical check is a backstop, not a substitute for the human/agent claim-safety judgment described in the rest of this page — apply both.

This closes the loop described by the core claim-safety rules above: "tie every claim to source evidence" is enforced by `validate`, not just requested in prose.

## Fact-consistency audit (employers, titles, dates, scope, tools)

The numeric audit above does not look at words. `src/core/fact-audit.js` (`auditFacts(config, profile, evidence)`) compares the non-numeric facts in a resume config with `profile.json` and `evidence.jsonl`. `validate` runs it on every file under `resume-configs/`, and `tailor` runs it on the config being tailored. Errors block; warnings do not.

Blocking:

- **Employer.** Every job's `company` must match a `profile.experience` entry. Case, punctuation, "&" versus "and", and endings such as Inc, LLC, Corp, and Ltd are ignored. An employer that is in neither `profile.experience` nor any evidence entry is an error.
- **Title.** The job title must equal the profile title, or one must contain the other. Adding a seniority word the profile does not have (Senior, Lead, Principal, Staff, Head of, Director, VP, Chief, Founder) is an error. If the candidate really held another title, record it in the profile entry's `titleAliases` array and the audit accepts it.
- **Dates.** The start and end in `dates` may not fall outside the profile entry's `startDate` and `endDate` by more than one month. A year-only date is read as the whole year. "Present" requires the profile entry to have an empty `endDate`.
- **Education.** Each `education` entry must match a `profile.education` institution (or appear in the evidence), and its degree must share a meaningful word with the profile degree when both are given.
- **Scope verbs.** A summary or bullet that says "led", "owned", "managed a team", "founded", "director", "head of", "architected", "built from scratch" or "sole" needs support. If the bullet lists evidence ids (`bulletEvidenceIds`, `evidenceIds`, `summary.evidenceIds`), those entries must use the same verb stem. If it lists none, any evidence entry for the same organization or any highlight in the matching profile entry may support it. A summary may be supported by any evidence or profile text. The fix is in the message: ask the candidate whether they led this and record it in evidence, or soften to "contributed to" (the safer patterns below).

Advisory (warning only):

- **Tools and technologies.** A capitalized or tool-shaped name (such as Terraform, Jira, AWS, Node.js) in a bullet or skills row that appears nowhere in `profile.json` or the evidence is flagged: "not found in the candidate's profile or evidence — confirm with the candidate". Lowercase tool names and very common words are not detected.

Known false-positive risks: "director" or "head of" in a sentence about someone else, "led" in a sentence about a team the candidate only supported, a school written as an abbreviation, a capitalized product or customer name that only appears on the resume, and a title that is a fair paraphrase but shares no words with the profile title. Fix by recording the fact in the profile or evidence, or by using the profile's own wording.

## Candidate confirmation rules

Ask the candidate before you use:

- Unconfirmed dates, titles, team names, education, certifications, or employment status.
- Metrics about revenue, adoption, performance, reliability, cost savings, or user counts.
- Claims about production ownership, security posture, compliance, scale, or customer impact.
- Confidential projects, internal platform names, or private customer details.
- Public links that might not represent the candidate's current work.

If the candidate is unavailable, use only supported claims and record the question for later review.

## Unconfirmed platform claims

When platform details are unconfirmed, use general wording:

- "Platform experience" instead of naming an unverified platform.
- "Developer tooling" instead of naming internal tools without evidence.
- "Automation workflows" instead of claiming production orchestration.
- "Cross-functional delivery" instead of naming teams or customers that the source does not confirm.

If a job description asks for a platform that the source does not verify, position adjacent experience as relevant experience, not direct ownership.

## Seniority positioning

Show senior-level or principal-level fit through verified examples of technical leadership, architecture, strategy, mentoring, cross-team influence, and durable delivery.

Avoid inflating titles or claiming broader scope than the evidence supports. Use phrasing such as "principal-level scope" only when evidence shows broad ownership, strategic decisions, or cross-organization influence.

## Placeholder avoidance

Do not leave placeholders in final documents. Replace bracketed text, generic examples, empty bullets, and notes such as `TODO`, `TBD`, or `Insert metric` before handoff.

If a placeholder needs missing information, mark the task blocked and explain what source fact you need.

## Safer wording patterns

Use these patterns when evidence supports relevance but not direct ownership:

- "Relevant experience includes..."
- "Built related workflows for..."
- "Contributed to..."
- "Supported..."
- "Explored..."
- "Applied similar patterns in..."

Avoid these patterns unless the source confirms them:

- "Owned end-to-end..."
- "Scaled to millions..."
- "Drove revenue..."
- "Led the platform..."
- "Guaranteed compliance..."
- "Launched company-wide..."
