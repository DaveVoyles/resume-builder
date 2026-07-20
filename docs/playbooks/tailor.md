# Tailor playbook

**Tailor** is the headline workflow: point your agent at a job posting and get a tailored, evidence-backed resume plus a tracker row, in one pass. You draft a schema-conformant resume config for the role, then hand it to the `tailor` CLI command, which validates it, audits every claim against the evidence ledger, renders the DOCX, and registers the tracked role — landing it un-applied so a human reviews the resume before anything is sent.

Before you start:

- The candidate should have completed intake (grill playbook) with `profile.json` and `evidence.jsonl` populated.
- You'll draft a resume config under `candidate/resume-configs/<role-slug>.json` (see [Candidate workspace schemas](../workspace-schemas.md#resume-render-config-render-resume)).
- You'll run the `tailor` command to validate, render, and track the role in one pass.
- After tailoring, the candidate reviews the DOCX before applying.

---

## Start the tailor workflow

**Propose a recommended approach:**

"I'll read the job posting and your profile/evidence, draft a resume config that emphasizes what actually matches this role, and then run `tailor` to validate every claim against your evidence, render the DOCX, and add this role to your tracker — landing it as 'interested' (not applied) so you can review the resume first."

**Confirm you're ready:**

- [ ] You have the job posting URL (and, ideally, its text — paste it or fetch it).
- [ ] The candidate's `profile.json` and `evidence.jsonl` are populated.
- [ ] You have write access to `candidate/resume-configs/`.

---

## Section 1: Read the job posting

### Step 1.1: Gather the posting

Read the job posting at the given URL (or the pasted text). Extract:

- **Company** and **role title**.
- **Required and preferred skills**, technologies, and experience.
- **Responsibilities** — what the role actually does day to day.
- **Seniority signals** — years of experience, scope of ownership, team size language.
- **Location, work mode, and compensation**, if listed.

### Step 1.2: Map the posting to the candidate's evidence

Compare what the posting asks for against `profile.json` and `evidence.jsonl`:

- Which of the candidate's experience entries and evidence directly support what this posting wants?
- Which skills does the candidate have strong evidence for vs. only a passing mention?
- Are there gaps — things the posting wants that the candidate's evidence doesn't clearly support? Note them; do not paper over them with an unsupported claim.

**If the candidate's evidence ledger is thin** (fewer than a handful of source-backed entries), say so before drafting — `validate`/`tailor` will only warn, not block, on a thin ledger, but a resume built on thin evidence is a weaker resume. Suggest ingesting more source material first if time allows.

---

## Section 2: Select relevant experience and draft the resume config

### Step 2.0: Select roles by relevance to the job description

Before drafting the resume config, you'll trim your experience to what actually matches this role. This semantic compression keeps your resume focused on what the posting asks for, rather than listing everything you've done.

**The decision:**

Look at `profile.json` and identify all experience entries (jobs, projects, roles, or teaching/speaking engagements — whatever's listed). For each one, ask: "Is this relevant to this specific job posting?" If yes, select it and write a **one-line justification** stating why it matches. If no, skip it.

**Example (fictional candidate tailoring for a fintech SRE role):**

```
Profile has 7 roles:
1. Senior Backend Engineer at Acme (2023–2025) — SELECTED: "Directly matches 'production infrastructure' and 'Kubernetes' from posting; same fintech domain."
2. SRE at Stripe (2021–2023) — SELECTED: "Exact role match; evidence covers all required technologies."
3. Barista at Cafe X (2015–2016) — SKIPPED: "No technical relevance to SRE role; too junior to strengthen claim."
4. Python tutor at CodeBridge (2020–2021) — SKIPPED: "Teaching credential doesn't strengthen a production-infrastructure narrative."
5. Open-source contributions (kubernetes-client library) — SELECTED: "Directly cited in Kubernetes requirements; real evidence of production exposure."
6. Degree in Computer Science — SKIPPED: "Credential is expected for this role; not a differentiator."
7. Conference talk on observability — SELECTED: "Matches 'observability tooling' from posting; shows expertise."
```

**Why this matters:**

A tailored resume emphasizes what's relevant to this role, not a dump of your entire career history. It's shorter, more focused, and easier to defend in an interview: "I selected the three parts of my background that directly match what you posted — here's why each one is relevant."

Once you've identified your selected experiences, proceed to drafting the config.

### Step 2.1: Write the config

Draft `candidate/resume-configs/<company-slug>-<role-slug>.json` per the [resume render config schema](../workspace-schemas.md#resume-render-config-render-resume): `company`, `candidate` (name + contact), `summary`, `experienceSections` (with per-job `bullets`), `skills`, and any optional `education`/`publications`/`speaking` sections.

**Every claim needs a source.** Do not invent metrics, dates, or scope. See [Accuracy and claims](../accuracy-and-claims.md) for the full rules. A useful check while drafting: for every number in a bullet (a percentage, a dollar amount, a count, a team size, years of experience), can you point to the exact `evidence.jsonl` entry that states it? If not, either find the evidence or rephrase without the number — `tailor`'s claim audit will block on it either way (see Section 3).

**Emphasize what maps to the posting.** Reorder and select bullets, skills, and `summary.fitOverride` to lead with what Section 1.2 identified as the strongest matches — without fabricating anything new. This is where the tailoring happens: the same evidence, positioned for this specific role.

### Step 2.2: Sanity-check the draft

Before running `tailor`, re-read the draft against the job posting:

- Does the summary speak to what this role actually needs?
- Are the strongest, most relevant achievements in the first bullets of each job, not buried?
- Is every number traceable to evidence?
- Is anything phrased more confidently than the evidence supports (see "Safer wording patterns" in [Accuracy and claims](../accuracy-and-claims.md))?

---

## Section 3: Run tailor

### Step 3.1: Run the command

```bash
npm run workspace:tailor -- --workspace candidate \
  --config candidate/resume-configs/<company-slug>-<role-slug>.json \
  --url "<job-posting-url>" \
  --title "<Role Title>"
```

`--company` is optional — it defaults to the resume config's own `company` field. Pass `--applyUrl`, `--location`, `--compensation`, `--fit`, or `--notes` the same way you would with `add-role` if you want them captured on the tracked role right away.

**This command, in one pass:**

1. Validates the config against the resume-config schema (rejects it, with an itemized error, if malformed).
2. Audits every claim in the config against `evidence.jsonl` — the same evidence-backed claim audit `validate` runs — and blocks with a per-claim error if anything is unsupported.
3. Renders the DOCX to `outputs/resumes/<Company>/<file>.docx`.
4. Registers the role in `roles.tracked.json`, linked to the exact resume config and DOCX it just produced.
5. Sets the role's application status to **`interested`** — not-yet-applied — and rebuilds the tracker (md + html).

**Example output:**

```
Rendered resume for Fabrikam AI: candidate/outputs/resumes/Fabrikam AI/alex-rivera-fabrikam-ai.docx
Added tracked role: Fabrikam AI — Developer platform product manager
Run build-tracker to refresh outputs/tracker.md.
Built tracker for 1 tracked role(s): candidate/outputs/tracker.md
Built html tracker for 1 tracked role(s): candidate/outputs/tracker.html
Updated Fabrikam AI — Developer platform product manager to status: interested (2026-07-20)
Tailored resume for Fabrikam AI — Developer platform product manager: candidate/outputs/resumes/Fabrikam AI/alex-rivera-fabrikam-ai.docx
```

### Step 3.2: If the claim audit blocks

`tailor` fails loud, before writing anything, when a claim in the config has no supporting evidence entry:

```
Resume config failed the evidence-backed claim audit:
  - Unsupported claim at experienceSections[0].jobs[0].bullets[0] (Senior Platform Program Manager — Contoso Labs): "500%" in "Increased platform adoption by 500% in one quarter." — no evidence.jsonl entry (fact/snippet/quote, excluding metadata-only entries) supports this percentage. Add a source-backed evidence entry confirming this figure, or rephrase the claim without an unverified number.
```

Fix the config — either add the missing evidence (if the candidate can confirm it) or rephrase the bullet without the unverified figure — and re-run `tailor`.

### Step 3.2a: Address style-lint findings (de-AI rewrite step)

After running `tailor`, the command prints any style-lint advisory warnings to the console. These warnings detect common AI-generated writing patterns (buzzwords, overly uniform sentence lengths, and repetition) that can hurt your credibility in a resume.

**Read the warnings and rewrite the flagged text.** This step takes 10–15 minutes and is optional but strongly recommended — resumes that sound natural and specific outperform generic, buzzword-heavy versions in real review.

**What the warnings look like:**

```
⚠ AI-style buzzwords detected: "results-driven", "passionate", "leverage", "cutting-edge"
⚠ Sentences are suspiciously uniform in length (12–15 words, avg 13 words)
⚠ Repeated words: "platform", "solution", "deliver" (and 2 more)
```

**How to rewrite:**

- **Buzzwords:** Replace vague, AI-generic words with specific, concrete ones from your actual experience.
  - Before: "Results-driven engineer passionate about leveraging cutting-edge technologies to deliver innovative solutions."
  - After: "Backend engineer who's deployed three production Kubernetes clusters and shipped two data-pipeline migrations for fintech clients."

- **Sentence-uniformity:** Vary sentence length and structure. Mix short, punchy sentences ("I shipped it.") with longer, complex ones. Read aloud — if it sounds robotic, it probably is.
  - Before: "I led the team. We designed the system. I shipped the code. We launched it successfully."
  - After: "I led a five-person team through a full redesign — spec to launch in six weeks. The new system cut query latency by 40%."

- **Repetition:** Replace repeated words and phrases with synonyms or restructure to avoid the repeat.
  - Before: "...delivered platform features. The platform scales. Our platform..."
  - After: "...delivered features that scale to 10K+ requests per second. The infrastructure handles..."

Edit your resume config to address the flagged sections, then save and re-run `tailor`:

```bash
npm run workspace:tailor -- --workspace candidate \
  --config candidate/resume-configs/<company-slug>-<role-slug>.json \
  --url "<job-posting-url>" \
  --title "<Role Title>"
```

The rerun produces a fresh DOCX with the rewritten text. If lint warnings remain, repeat the cycle until none appear (or until you're satisfied the resume reads naturally).

### Step 3.3: Re-running tailor for the same role

`tailor` is safe to re-run (e.g. after editing the config in response to feedback): it won't create a duplicate tracked role, and if the role's application status has already moved past "interested" (the candidate applied, got an interview, etc.), re-running `tailor` refreshes the resume link without silently reverting that progress back to "interested."

---

## Section 4: Candidate review

**Before the candidate applies:**

- [ ] Open the rendered DOCX and proofread it.
- [ ] Confirm every claim still reads as accurate and comfortable to defend in an interview.
- [ ] Check the tracker row (`outputs/tracker.md` or `.html`) shows the role with status "interested" and the resume linked.

### Optional: Analyze keyword gaps

If you want to understand what this job posting is asking for that the resume doesn't yet emphasize, you can run a gap analysis:

1. Extract or collect the job posting's required and preferred keywords.
2. Follow the [gap-analysis playbook](gap-analysis.md) to classify each missing keyword (PresentationGap, WeakEvidence, AdjacentSkill, or TrueGap).
3. Run `gap-report` to render an actionable report of what the candidate could address.

This gives the candidate a roadmap for the next resume revision without waiting for interview feedback. See [gap-analysis playbook](gap-analysis.md) for the full workflow.

**Once the candidate is ready to apply**, use the `set-status` command to move the role forward:

```bash
npm run workspace:set-status -- --workspace candidate --id <role-id> --status applied
```

---

## Example: Sample-candidate walkthrough

Using the fictional `examples/sample-candidate/` workspace, tailoring the existing `Fabrikam AI` seed role (`roles.seed.json`) into a tracked role:

1. Draft `resume-configs/fabrikam-ai-developer-platform-pm.json`, emphasizing the sample candidate's developer-platform and AI-workflow evidence (`ev-001`, `ev-002`) for Fabrikam AI's developer-platform product manager posting.
2. Run:
   ```bash
   npm run workspace:tailor -- --workspace examples/sample-candidate \
     --config examples/sample-candidate/resume-configs/fabrikam-ai-developer-platform-pm.json \
     --url "https://jobs.example.invalid/fabrikam/developer-platform-product-manager" \
     --title "Developer platform product manager"
   ```
3. `tailor` validates the config, confirms both bullets are backed by `ev-001`/`ev-002`, renders `outputs/resumes/Fabrikam AI/alex-rivera-fabrikam-ai.docx`, and adds a "Fabrikam AI — Developer platform product manager" row to the tracker with status "interested."

(Do not commit generated DOCX files or a real tracked-role entry for the sample candidate — the sample workspace's committed data stays limited to the fixtures already checked in.)

---

## Schema reference

- `resume-configs/<role-slug>.json`: schema-validated resume render config (see [Candidate workspace schemas](../workspace-schemas.md#resume-render-config-render-resume)).
- `roles.tracked.json`: `role.status` is list membership (`tracked`); `role.application.status` is the enum progress field `tailor` sets to `interested`; `role.resume.configPath`/`role.resume.outputPath` link the role to the exact config and DOCX `tailor` produced.
- `evidence.jsonl`: the source of truth `tailor`'s claim audit checks every metric claim against.

For full details, see [Candidate workspace schemas](../workspace-schemas.md) and [Accuracy and claims](../accuracy-and-claims.md).
