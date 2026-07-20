# Gap-analysis playbook

**Gap-analysis** is a workflow for understanding keyword mismatches between a job posting and a candidate's resume. You run `score-keywords` to measure coverage, then analyze each missing keyword to decide what kind of gap it represents and what the candidate should do about it. This feeds into the `gap-report` command, which renders a markdown report organizing gaps by type and recommended action.

Before you start:

- The candidate should have completed intake (grill playbook) with `profile.json`, `preferences.json`, and `evidence.jsonl` populated.
- You'll have a job posting with a keyword list, or access to extract keywords from the posting.
- You'll run `score-keywords` to identify missing keywords.
- You'll draft a gap-classification JSON array classifying each missing keyword into one of four types.
- You'll run `gap-report` to render the markdown report.
- After completing the report, the candidate reviews gaps and decides what to address before the next revision.

---

## Start the gap-analysis workflow

**Propose a recommended approach:**

"I'll score your resume against the job posting's keywords, then analyze each missing keyword to tell you what kind of gap it is — a skill you have but haven't surfaced in your resume, evidence that's thin but present, a related skill that transfers, or a genuine gap. For each one, I'll suggest what you can do about it. Then I'll render a gap report so you can decide what to fix before we tailor your resume."

**Confirm you're ready:**

- [ ] You have a job posting and either an extracted keyword list or access to read the posting to extract keywords.
- [ ] The candidate has a resume config in `candidate/resume-configs/` (from the tailor playbook, or a prior saved config).
- [ ] The candidate's `profile.json` and `evidence.jsonl` are populated.
- [ ] You have write access to create or edit JSON files in the workspace.

---

## Section 1: Extract keywords and score coverage

### Step 1.1: Get the keyword list

**If you have a keyword list from the job posting:**

Extract or ask the posting source — most job boards show required/preferred skills, or recruiters provide a keyword list. A typical keyword list is a JSON array of strings:

```json
[
  "Python",
  "Kubernetes",
  "AWS",
  "Product management",
  "Cross-functional leadership",
  "A/B testing",
  "Agile",
  "SQL"
]
```

**If you're extracting keywords yourself:**

Read the job posting and pull out:
- Required technologies (languages, frameworks, tools, platforms).
- Required soft skills and experience (leadership, communication, process familiarity).
- Preferred or "nice-to-have" skills if listed separately.
- Industry-specific jargon (e.g., "SaaS," "B2B," "e-commerce").

Save the keyword list to a temp file, e.g., `candidate/keywords.json`.

### Step 1.2: Run score-keywords

Run the `score-keywords` command to measure how well the resume covers the posting's keywords:

```bash
npm run workspace:score-keywords -- \
  --workspace candidate \
  --config candidate/resume-configs/<role-slug>.json \
  --keywords candidate/keywords.json \
  --json
```

**Example output:**

```json
{
  "present": [
    "Python",
    "AWS",
    "Product management",
    "Agile"
  ],
  "missing": [
    "Kubernetes",
    "Cross-functional leadership",
    "A/B testing",
    "SQL"
  ],
  "percent": 50
}
```

### Step 1.3: Note the gaps

Capture the missing keywords — these are what you'll analyze next. In this example: `Kubernetes`, `Cross-functional leadership`, `A/B testing`, `SQL`.

---

## Section 2: Classify each gap

For each missing keyword, decide which of four gap types it is. Each type has a different recommended action.

### Understanding the four gap types

**PresentationGap**
- **What it is:** The skill or experience exists in the candidate's resume and evidence, but isn't phrased or positioned to match the posting's keyword.
- **Example:** The candidate led a product roadmap planning process (evidence), but the resume uses "strategic planning" instead of "product roadmap" — so "product roadmap" is missing, even though the skill is there.
- **Recommended action:** Rephrase or emphasize the skill in the next resume revision. No need to gain new experience.

**WeakEvidence**
- **What it is:** The skill is mentioned in the resume or evidence, but only lightly — one brief mention, no details, no depth.
- **Example:** The candidate took an AWS certification course (evidence), but never used AWS in a real project. The resume mentions it in passing.
- **Recommended action:** Either deepen the evidence (use AWS in a side project or learning exercise) or remove the skill from the resume to avoid follow-up questions you can't defend.

**AdjacentSkill**
- **What it is:** The candidate has a related or transferable skill, but not the exact keyword. The gap is more about naming/positioning than a true gap.
- **Example:** The posting asks for "Kubernetes"; the candidate has deep experience with Docker and container orchestration concepts, but has never deployed to Kubernetes specifically. The skills transfer.
- **Recommended action:** Highlight the related skill in the resume and prepare to explain the transfer (e.g., "I've done container orchestration with Docker; I can ramp on Kubernetes quickly").

**TrueGap**
- **What it is:** The skill is genuinely absent. The candidate has no related experience, no evidence, nothing to build on.
- **Example:** The posting asks for "SQL"; the candidate has never written SQL or database queries.
- **Recommended action:** Either learn the skill before applying (if it's a blocker for the role), or skip the role entirely if the gap is too large.

### Step 2.1: For each missing keyword, run through the decision tree

For each keyword in the `missing` list from Section 1:

1. **Check the resume config and evidence:**
   - Search the resume config (check summary, bullets, skills section) for any mention of the keyword or close synonyms.
   - Search `evidence.jsonl` for any facts or snippets related to the keyword.

2. **Classify the gap:**
   - If the skill is in the resume but phrased differently → **PresentationGap**
   - If the skill is mentioned once or lightly in resume/evidence → **WeakEvidence**
   - If a related/transferable skill is present but not the exact keyword → **AdjacentSkill**
   - If there's no mention and no related skill → **TrueGap**

3. **Write a one-line rationale:**
   - Be specific. Refer to evidence IDs or resume sections where relevant.
   - Example: "Resume mentions 'container orchestration' but not Kubernetes specifically (ev-002)."

4. **Recommend an action:**
   - For PresentationGap: "Rephrase as 'Kubernetes' in next revision."
   - For WeakEvidence: "Deepen with a real project or remove from resume."
   - For AdjacentSkill: "Mention Docker expertise; prepare to explain transfer."
   - For TrueGap: "Consider learning before applying, or skip this role if it's a blocker."

### Step 2.2: Example classifications

Using the example from Section 1.2:

| Keyword | Gap Type | Rationale | Recommended Action |
| --- | --- | --- | --- |
| Kubernetes | AdjacentSkill | Candidate has deep Docker and container orchestration experience (ev-002) but has never used Kubernetes specifically. Skills transfer. | Highlight Docker expertise in resume; prepare to explain the learning curve for Kubernetes. |
| Cross-functional leadership | PresentationGap | Resume describes "Led roadmap planning with product and engineering teams" (ev-001), which is cross-functional leadership, but uses different wording. | Rephrase bullet to use "cross-functional leadership" explicitly in the next resume revision. |
| A/B testing | WeakEvidence | Evidence mentions A/B testing once in a product launch context (ev-003), but no detail or depth. | Decide: if the candidate did more A/B testing, deepen the evidence. Otherwise, remove from resume to avoid follow-up questions. |
| SQL | TrueGap | No mention in resume or evidence. Candidate has only used ORMs and query builders, not SQL directly. | If SQL is a blocker for this role, consider a short learning project before applying. Otherwise, skip this role. |

---

## Section 3: Build the gap-classification JSON

Assemble your gap classifications into a JSON array file, e.g., `candidate/gaps.json`. This file is the input to the `gap-report` command.

### Step 3.1: Format the JSON array

Each gap is an object with four fields:

```json
[
  {
    "keyword": "Kubernetes",
    "type": "AdjacentSkill",
    "rationale": "Candidate has deep Docker and container orchestration experience (ev-002) but has never used Kubernetes specifically. Skills transfer.",
    "recommendedAction": "Highlight Docker expertise in resume; prepare to explain the learning curve for Kubernetes."
  },
  {
    "keyword": "Cross-functional leadership",
    "type": "PresentationGap",
    "rationale": "Resume describes 'Led roadmap planning with product and engineering teams' (ev-001), which is cross-functional leadership, but uses different wording.",
    "recommendedAction": "Rephrase bullet to use 'cross-functional leadership' explicitly in the next resume revision."
  },
  {
    "keyword": "A/B testing",
    "type": "WeakEvidence",
    "rationale": "Evidence mentions A/B testing once in a product launch context (ev-003), but no detail or depth.",
    "recommendedAction": "Decide: if the candidate did more A/B testing, deepen the evidence. Otherwise, remove from resume to avoid follow-up questions."
  },
  {
    "keyword": "SQL",
    "type": "TrueGap",
    "rationale": "No mention in resume or evidence. Candidate has only used ORMs and query builders, not SQL directly.",
    "recommendedAction": "If SQL is a blocker for this role, consider a short learning project before applying. Otherwise, skip this role."
  }
]
```

**Fields:**
- `keyword` (string): The missing keyword from the job posting.
- `type` (string, required): One of `PresentationGap`, `WeakEvidence`, `AdjacentSkill`, `TrueGap`.
- `rationale` (string): A one-line explanation of why this keyword is classified this way. Reference evidence IDs or resume sections.
- `recommendedAction` (string): What the candidate should do about this gap.

### Step 3.2: Validate the JSON

Before running `gap-report`, check that:
- The file is valid JSON (parseable).
- Every gap has all four fields filled in.
- Every `type` is one of the four allowed values.
- `keyword`, `rationale`, and `recommendedAction` are non-empty strings.

You can use a JSON validator online or let `gap-report` catch format errors.

---

## Section 4: Run gap-report

### Step 4.1: Run the command

```bash
npm run workspace:gap-report -- \
  --workspace candidate \
  --input candidate/gaps.json \
  --roleTitle "Senior Product Manager"
```

**Optional flags:**
- `--roleId <role-id>`: If this gap analysis is for a tracked role, pass the role ID. The report will be written to `outputs/roles/<role-id>/gap-report.md`.
- `--roleTitle <title>`: The job title for the report header (default: "Target Role").

**Example output:**

```
Gap report written to candidate/outputs/gap-report/gap-report.md
```

Or, if you specified `--roleId`:

```
Gap report written to candidate/outputs/roles/role-001/gap-report.md
```

### Step 4.2: Review the gap report

Open the rendered markdown report and verify:

1. **The report is well-formatted.** Gaps are organized by type with clear headings.
2. **Each gap's rationale and recommended action are accurate.** Refine if needed.
3. **The tone is actionable, not discouraging.** PresentationGaps should sound easy; TrueGaps should be honest about what's needed.

---

## Section 5: Candidate review and next steps

**After you hand the candidate the gap report:**

1. **Candidate reads and understands each gap.** You can help explain what each type means.
2. **Candidate prioritizes gaps by effort and impact.** PresentationGaps and AdjacentSkills are often quicker wins.
3. **Candidate decides what to act on:**
   - For **PresentationGaps**, update the resume in the next revision.
   - For **WeakEvidence**, either deepen the evidence with a small project or remove the skill from the resume.
   - For **AdjacentSkills**, add a note to the candidate's interview prep (study guide) to explain the transfer.
   - For **TrueGaps**, decide whether to apply anyway (with an honest gap explanation) or skip the role.

4. **Next step:** Either tailor a new resume incorporating the candidate's decisions (see [tailor playbook](tailor.md)), or move on to the next role.

---

## Tips for strong gap analysis

- **Be specific in rationales.** "Candidate has Docker experience" is weaker than "Led containerization of three microservices with Docker (ev-002), but has never used Kubernetes."
- **Match the gap type to the evidence.** Don't mark something as WeakEvidence if it's clearly in the resume; mark it as PresentationGap instead.
- **Be honest about TrueGaps.** If the skill is genuinely missing, say so. The candidate needs to know.
- **Actionable recommended actions.** "Learn it" is vague; "Take the Linux Foundation Kubernetes course and deploy a test cluster to your portfolio" is actionable.
- **Reference evidence.** Every time you mention an achievement or skill, cite the evidence ID (e.g., "ev-001").

---

## Related pages

- [Tailor playbook](tailor.md) — after gap analysis, tailor a new resume.
- [Workspace schemas](../workspace-schemas.md#gap-classification-input-gap-report) — gap-classification JSON schema reference.
- [CLI workflow](../cli-workflow.md) — raw command reference.
