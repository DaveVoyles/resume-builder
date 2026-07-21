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
- **Thin ledger → non-blocking warning.** Even when every claim currently checks out, `validate` prints a warning (not a failure) when a resume config's workspace has fewer than three source-backed evidence entries — a nudge to ingest more source material before treating the config's claims as fully vetted, since a thin ledger makes it easy for a later edit to introduce an unsupported figure unnoticed.
- A workspace without a `resume-configs/` directory validates exactly as before; the claim audit only runs against resume configs that exist.

**Cover letters get the same audit, at a different point in the pipeline.** Cover-letter body paragraphs are scanned by the identical claim-detection logic (`auditCoverLetterConfig`, same `CLAIM_PATTERNS`) — but this runs at render time (`render-cover-letter`, or `tailor --cover-letter`), not as part of `validate`'s workspace-wide sweep. An unsupported claim in a cover letter blocks the render exactly like an unsupported resume bullet blocks `render-resume`/`tailor`; there is currently no separate `validate`-time check for a `cover-letter-configs/` directory the way there is for `resume-configs/`. See [Cover letter render config](workspace-schemas.md#cover-letter-render-config-render-cover-letter) and the [cover-letter playbook](playbooks/cover-letter.md).

**Known limitation:** claim detection is regex-based against a closed set of metric patterns and a closed noun whitelist (`src/core/claim-audit.js`'s `CLAIM_PATTERNS`), by deliberate design — a narrow, deterministic pattern set avoids both false-positiving on incidental numbers in prose and needing an LLM in the loop (ADR 0001's agent-operated-CLI posture). A metric phrased with a noun outside the whitelist (e.g. "50 stakeholders") is not detected and so is not audited. This mechanical check is a backstop, not a substitute for the human/agent claim-safety judgment described in the rest of this page — apply both.

This closes the loop described by the core claim-safety rules above: "tie every claim to source evidence" is enforced by `validate`, not just requested in prose.

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
