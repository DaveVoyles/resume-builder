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

Read the job posting at the given URL (or the pasted text). **Save the posting with the role** (`--jd-file <file>` or `--jd-text` on `tailor`, see Step 3.1) so later steps do not have to read the URL again. Extract:

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

### Step 1.3: Run `tailor-plan`

Once the posting is saved with the role (`add-role --tracked --jd-file <posting.md>`), rank the candidate's evidence against its stored keywords. This is deterministic (no LLM, no network):

```bash
npm run workspace:tailor-plan -- --workspace candidate --company "<Company>" --title "<Role Title>"
```

It writes `outputs/tailor-plans/<role-id>.json` and prints a short summary. The plan lists:

- `jobs`: experience entries ranked by weighted keyword overlap (required 2, preferred 1, same matcher as the coverage score), each with `include`, `maxBullets` (6 for the first job, 4 for later ones, from `src/core/resume-config.js`), and its bullets ranked with `recommended` and `evidenceIds`.
- `skills`: profile skills ordered by overlap, plus `suggestAdd` (keywords the evidence supports but the profile skills do not list).
- `keywords.supported`: keywords with supporting `evidenceIds`, ready for `evidenceIds` / `bulletEvidenceIds` in the config.
- `keywords.possibleMatches`: keywords the ledger does not state in so many words but whose related words appear in an evidence line (a small map in `src/core/data/related-terms.json`, plus whole-word overlap). Each has up to three `matches` with `evidenceId` and a `quote`. These are suggestions only: ask the person, and never put one on the resume until they say yes (Step 3.2c).
- `keywords.doNotClaim`: keywords with no evidence at all and no suggestion, plus any the person said they have not done (`declined: true`). Do not add them to the resume; ask the candidate first.

The plan only orders and cites what the candidate already has. You still write the wording, and `tailor` still audits every claim. The workflow is: save posting, `tailor-plan`, write the config (optionally with `"extends"`, below), `tailor`.

**Base config with `extends`.** A resume config may start with `"extends": "base.json"` (a relative path from that file's folder, usually another file in `resume-configs/`). The child's top-level sections replace the base's whole; sections it leaves out come from the base (`outputFileName` is not inherited, so two roles never render to one file). Cycles, a missing base, an absolute path, or a chain longer than 5 are errors. `render-resume`, `tailor`, `validate`, and `study-guide-bundle` all resolve it. The base must be a complete, valid config on its own.

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

**Tie numbers to the entry that proves them.** For each job with a metric, add `evidenceIds` (ids from `evidence.jsonl`, for example the bullet entry `ingest` made from the candidate's resume) on the job, or `bulletEvidenceIds` for one bullet. The audit then checks the number against only those entries and blocks if they do not state it. Without ids the audit still matches against the whole ledger but prints a "Not tied to specific evidence" warning; clear it by adding the id. See [workspace schemas](../workspace-schemas.md#resume-render-config-render-resume).

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

`--company` is optional — it defaults to the resume config's own `company` field. Pass `--applyUrl`, `--location`, `--compensation`, `--fit`, or `--notes` the same way you would with `add-role` if you want them captured on the tracked role right away. Save the posting with the role by adding `--jd-file <posting.md>` (or `--jd-text "<text>"`): the text goes to `postings/<role-id>.md` and its keywords (required and preferred) are stored on the role. When you do not pass `--keywords`, the coverage advisory uses those stored keywords. Add `--keywords <keywords.json>` (or a comma list) to override them with your own list for a keyword-coverage advisory (see Step 3.1a below) or `--cover-letter <config.json>` to draft a cover letter alongside the resume (see [`cover-letter.md`](cover-letter.md)).

**This command, in one pass:**

1. Validates the config against the resume-config schema (rejects it, with an itemized error, if malformed).
2. Audits every claim in the config against `evidence.jsonl` — the same evidence-backed claim audit `validate` runs — and blocks with a per-claim error if anything is unsupported. It also runs the fact-consistency audit against `profile.json` and the evidence: employer, title, dates, education, and scope verbs ("led", "owned", "founded", and so on) block; tools not found in the candidate's record only warn (see Step 3.2).
3. If `--keywords` was passed: prints a keyword-coverage advisory (never blocks — see Step 3.1a).
4. Runs the [de-AI style lint](../style-lint.md) against the resume text — advisory only, never blocks.
5. Renders the DOCX to `outputs/resumes/<Company>/<candidate>-<company>-<role-title>.docx` (the role title keeps two roles at one company from overwriting each other), then converts it to PDF in a temp folder with LibreOffice and counts pages. One page prints "Resume is 1 page." More than the config's `pageLimit` (default 1) prints a warning that names the longest section: trim it, or ask the candidate whether that length is OK. It never blocks. Without LibreOffice it prints "Page count not checked (LibreOffice not installed)." Pass `--no-page-check` to skip. The result is saved on the role as `resume.pageCount`.
6. If `--cover-letter` was passed: validates, audits, lints, and renders the cover letter the same way, and links it on the tracked role.
7. Registers the role in `roles.tracked.json`, linked to the exact resume config and DOCX it just produced.
8. Writes a plain-language report for the role to `outputs/tailor-reports/<role-id>.html` (readable page) and `<role-id>.md` (for you), records the `.html` on the role (`resume.reportPath`), scores the person's general resume against the same keywords (`resume.baselineCoverage`), and prints `Report ready: ...`. The tracker row links the `.html`, which shows before/after wording and the keyword coverage lift. If the audit blocks in step 2, the report is still written with status "Blocked" and explains each problem.
9. Sets the role's application status to **`interested`** — not-yet-applied — and rebuilds the tracker (md + html).

**Example output:**

```
Rendered resume for Fabrikam AI: candidate/outputs/resumes/Fabrikam AI/alex-rivera-fabrikam-ai-developer-platform-product-manager.docx
Resume is 1 page.
Added tracked role: Fabrikam AI — Developer platform product manager
Run build-tracker to refresh outputs/tracker.md.
Built tracker for 1 tracked role(s): candidate/outputs/tracker.md
Built html tracker for 1 tracked role(s): candidate/outputs/tracker.html
Updated Fabrikam AI — Developer platform product manager to status: interested (2026-07-20)
Tailored resume for Fabrikam AI — Developer platform product manager: candidate/outputs/resumes/Fabrikam AI/alex-rivera-fabrikam-ai-developer-platform-product-manager.docx
```

### Step 3.1a: Keyword-coverage advisory (`--keywords`)

Pass `--keywords <keywords.json>` — a plain JSON array of keyword strings **you extract from the
job posting yourself** (see [Keyword list input](../workspace-schemas.md#keyword-list-input-score-keywords)
for the exact shape) — and `tailor` prints how much of that list the resume config actually
covers, without blocking the render either way:

```
Keyword coverage: 75% (3/4)
Present: Python, AWS, Product management
Missing: Kubernetes
```

With the role's stored posting keywords (no `--keywords`) the report also shows a weighted score (required keywords count 2, preferred 1) next to the plain percent, and each missing keyword gets a note:

```
Keyword coverage: 71% (5/7), weighted 78% (stored posting keywords)
Missing: Kubernetes, roadmap
  - Kubernetes: no evidence of this in the ledger — ask the candidate before adding
  - roadmap: appears in your evidence — could be added where it is true for this role
```

Matching uses word boundaries and an alias map (`src/core/data/keyword-aliases.json`: K8s/Kubernetes, JS/JavaScript, Postgres/PostgreSQL, CI/CD, ML/machine learning, PM/product management, and others, both ways), so "Java" does not match "JavaScript" and "C++" and "Node.js" match as written. It does not stem words ("schedule" does not match "scheduling"), so check a miss by eye before calling it a gap. The result is saved on the role as `resume.keywordCoverage` and shows in the tracker's Resume column. `score-keywords --workspace <dir> --company ... --title ... --config ...` refreshes it without re-rendering.

**The CLI never fetches a job posting** — it has no scraper. With `--jd-file` / `--jd-text` it stores
the text you give it and extracts keywords with a simple deterministic rule set, which can miss
things or catch noise. Reading the posting and judging the required/preferred skills is still agent work,
exactly like Section 1's posting-to-evidence mapping above; `--keywords` (and the standalone
`score-keywords` command it shares logic with) only *scores* a list you already extracted. If you
want to act on the `Missing` list — decide what kind of gap each one represents and get a
recommended action — that's the [gap-analysis playbook](gap-analysis.md)'s job, one level up from
this advisory.

### Step 3.2: If the claim audit blocks

`tailor` fails loud, before writing anything, when a claim in the config has no supporting evidence entry:

```
Resume config failed the evidence-backed claim audit:
  - Unsupported claim at experienceSections[0].jobs[0].bullets[0] (Senior Platform Program Manager — Contoso Labs): "500%" in "Increased platform adoption by 500% in one quarter." — no evidence.jsonl entry (fact/snippet/quote, excluding metadata-only entries) supports this percentage. Add a source-backed evidence entry confirming this figure, or rephrase the claim without an unverified number.
```

Fix the config — either add the missing evidence (if the candidate can confirm it) or rephrase the bullet without the unverified figure — and re-run `tailor`.

The same step also blocks on facts that are not numbers (see [Accuracy and claims](../accuracy-and-claims.md#fact-consistency-audit-employers-titles-dates-scope-tools)):

- **Employer, title, or dates that disagree with `profile.json`.** Use the profile's wording. If the candidate really held another title, add it to that profile entry's `titleAliases`.
- **A scope verb with no support** ("led", "owned", "managed a team", "founded", "director", "head of", "architected", "built from scratch", "sole"). Ask the candidate whether they did it. If yes, record it in `evidence.jsonl` (and tie the bullet to it with `bulletEvidenceIds`). If not, soften to "contributed to" or "supported".
- **A tool or technology the profile and evidence never mention** is only a warning. Confirm with the candidate before sending, or drop it.

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

### Step 3.2b: Open the report with the person

Open `candidate/outputs/tailor-reports/<role-id>.md` with them. Its status is **Ready to review**, **Draft made; job match not checked yet** (no posting text was given), **Needs your confirmation**, or **Blocked**. Start from "What changed for this job" and "Not done yet" (if present): the latter says what to ask them for. Each item under "Needs your confirmation" is a question. Ask them one at a time, in the report's words. Do not paste the report or its file names at them.

- **Answer is yes (they did it, the number is right):** record it in `evidence.jsonl` as a source-backed entry in their words, tie the line to it with `evidenceIds` or `bulletEvidenceIds`, then re-run `tailor`.
- **Answer is no, or they are unsure:** reword or remove the line, then re-run `tailor`.
- **Missing keywords:** "you have the experience" ones can be added, with evidence. "No proof" ones are never added without a yes and a recorded source. Ones under "Possible matches in your record. You decide." are questions with the evidence line quoted; follow Step 3.2c.
- After the config changes without a re-render (for example, after a page count or keyword step), regenerate the report with `npm run workspace:tailor-report -- --workspace candidate --id <role-id>`.

Say it as the sentences in [`what-to-say.md`](../first-run/what-to-say.md) allow: no command names, real paths from the repo root.

### Step 3.2c: Record the person's yes/no answers, then re-ingest and re-tailor

The keyword matcher is literal, so a resume can show the work without using the posting's words. For each keyword that is missing, has no literal match in the evidence, and has related words in an evidence line, the report shows a **possible match**: `Does this show release management? "Led Fast Game Package Publishing..." (evidence ev_...)`. The same lines are listed in their own section, "Possible matches in your record. You decide.", and are stored on the role as `resume.keywordCoverage.possibleMatches`. A possible match is never counted as covered and never added to a resume by the tool.

Ask the person one keyword at a time, in the report's words. Their answer decides:

1. Write the answer to a **notes file the person approved** in `candidate/inputs/notes/` (copy it from `my-documents` if they gave you one). Use a new file for each round of answers, for example `answers-2026-10-08.md`; ingest keys a notes file by its path, so editing a file that was already ingested changes nothing. One line per keyword, in their words:

   ```
   Confirmed (2026-10-08): release management. Resume line: "Led Fast Game Package Publishing inside Partner Center"
   Not done (2026-10-08): RAID, agile
   ```

   For a yes, quote the resume line (or lines, each in quotes) the person pointed at. Add no fact beyond what those lines say. For a no, list the keywords after `Not done`. Quote the person's own sentence above the lines if they said one. Do not paraphrase a "no" into a "yes".
2. Run `npm run workspace:ingest -- --workspace candidate`. Ingest stores the answers on that note's evidence entry (`metadata.confirmations`). The answer lines are not read as the person's skills.
3. Re-run `tailor` for the role. A confirmed keyword is now supported evidence with the note as the source: it moves to "could add (you confirmed this)" and its question disappears. Reword the bullet that already says the thing so it uses the posting's word, and cite both ids: the resume line in `bulletEvidenceIds` and the note id next to it (`summary.evidenceIds` for the summary). A keyword the person declined stays on the do-not-claim list ("you told me you have not done it"), is not asked about again, and must not appear anywhere on the resume. The tool enforces this: `tailor` refuses to render a config whose summary, headline, a bullet or a skills row says a declined keyword (or one of its aliases), writes the blocked report, and tracks nothing; `validate` fails on the same text in any file under `resume-configs/`. There is no override flag. If the person later says it is true, record a new, later-dated `Confirmed` line in a new notes file, ingest, and re-tailor: the later answer wins.
4. A "possible match" the person rejects needs no note: leave it off. Record a "no" only when you want the tool to stop asking.

The wording stays honest: reword what the resume already says; never add a number, employer or outcome the cited line does not state.

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
3. `tailor` validates the config, confirms both bullets are backed by `ev-001`/`ev-002`, renders `outputs/resumes/Fabrikam AI/alex-rivera-fabrikam-ai-developer-platform-product-manager.docx`, and adds a "Fabrikam AI — Developer platform product manager" row to the tracker with status "interested."

(Do not commit generated DOCX files or a real tracked-role entry for the sample candidate — the sample workspace's committed data stays limited to the fixtures already checked in.)

---

## Schema reference

- `resume-configs/<role-slug>.json`: schema-validated resume render config (see [Candidate workspace schemas](../workspace-schemas.md#resume-render-config-render-resume)).
- `roles.tracked.json`: `role.status` is list membership (`tracked`); `role.application.status` is the enum progress field `tailor` sets to `interested`; `role.resume.configPath`/`role.resume.outputPath` link the role to the exact config and DOCX `tailor` produced.
- `evidence.jsonl`: the source of truth `tailor`'s claim audit checks every metric claim against.

For full details, see [Candidate workspace schemas](../workspace-schemas.md) and [Accuracy and claims](../accuracy-and-claims.md).
