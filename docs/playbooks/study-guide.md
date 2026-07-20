# Study-guide playbook

**Study-guide** is a workflow that prepares interview-preparation materials for a candidate pursuing a tracked role. You gather everything relevant to the role — candidate profile, evidence, the tailored resume config, and the job posting — into a single context bundle, then synthesize an interview study guide.

Before you start:

- The candidate should have at least one tracked role in `roles.tracked.json` with a corresponding resume config.
- You'll run the `study-guide-bundle` command to gather the context into `outputs/study-guide-bundles/<role-id>.json`.
- You'll read the bundle and write the interview study guide to `outputs/study-guides/<company>/study-guide.md`.
- After completing the guide, commit it to the candidate's workspace.

---

## Start the study guide workflow

**Propose a recommended approach:**

"I'll gather everything relevant to this role into a single context bundle — your profile, evidence, the tailored resume config, and the job posting details. Then I'll write an interview study guide that connects your experience to what the role needs, highlights your strongest points, and prepares you for likely questions."

**Confirm you're ready:**

- [ ] The candidate has a tracked role in `roles.tracked.json`.
- [ ] A resume config exists for the role in `candidate/resume-configs/`.
- [ ] The job posting URL is saved in the tracked role's `urls.job`.
- [ ] You have internet access to verify or read the job posting.

---

## Section 1: Create the context bundle

### Step 1.1: Run the bundle command

Run the `study-guide-bundle` command to gather all relevant data:

```bash
npm run workspace:bundle -- --workspace candidate --id <role-id>
# OR
npm run workspace:bundle -- --workspace candidate --company "Company Name" --title "Role Title"
```

This command:
1. Finds the tracked role by ID or company+title.
2. Reads the candidate's profile and evidence ledger.
3. Loads the role's tailored resume config.
4. Captures the job posting URL.
5. Writes everything to `outputs/study-guide-bundles/<role-id>.json`.

**Example output:**
```
Created study guide bundle for Northwind Tools — Senior Product Manager, AI Developer Workflows: outputs/study-guide-bundles/role-tracked-001.json
```

### Step 1.2: Verify the bundle

Check that the bundle file exists and contains all required sections:

- `role` — the tracked role entry
- `profile` — candidate background, skills, experience
- `evidence` — all evidence from the ledger
- `resumeConfig` — the tailored resume configuration for this role
- `jobPosting` — URLs to the job posting and application link

Read the bundle and verify:
- The company and role title are correct.
- The resume emphasizes the right skills for this specific role.
- Key evidence entries are present (check `evidenceIds` in profile and resume config).

---

## Section 2: Write the study guide

### Step 2.1: Read the context bundle

Open the bundle and review:
1. **The candidate's background** — key projects, achievements, and skills from the profile.
2. **The job posting** — re-read the actual posting at the URL in the bundle (check `jobPosting.url`). Note the specific skills, responsibilities, and implicit priorities.
3. **The tailored resume** — see how the config positioned the candidate for this role (check `resumeConfig.summary.fitOverride` and `resume.emphasis`).
4. **Evidence connections** — review which evidence entries support the key claims in the resume (stored in `evidence[]`).

### Step 2.2: Organize the study guide by interview stage

Write the study guide to `outputs/study-guides/<company>/study-guide.md`. Structure it around the likely interview stages (recruiter screen → team interviews → executive round):

**Study guide sections:**

1. **Role Overview**
   - Job title, company, key responsibilities (from the posting).
   - Your fit assessment: what makes you a good match for this role?
   - Link to the job posting.

2. **Your Strongest Assets**
   - List 3-5 of your most relevant achievements from the evidence that directly support the role's stated needs.
   - For each achievement, include: the accomplishment, the business impact, and why it's relevant to *this specific role*.
   - Use exact quotes from your evidence and resume config where appropriate.

3. **Likely Interview Questions**
   - Brainstorm 8-12 questions a hiring manager for this role would likely ask.
   - Group by interview stage if relevant (e.g., recruiter screen, technical round, culture fit).
   - For each question, draft a short talking point (1-2 sentences) grounded in your evidence and experience.

4. **Addressing Gaps**
   - If the posting lists skills or experience you haven't explicitly mentioned in your evidence, call them out.
   - For each gap, assess: is this a blocker, a "nice to have," or something you can learn on the job?
   - Prepare a short, honest response for if the question comes up.

5. **Your Questions for the Team**
   - Prepare 5-7 thoughtful questions to ask the hiring team.
   - Focus on culture, role clarity, technical challenges, team dynamics, and growth opportunities — not compensation (save that for the offer stage).
   - Questions should show you've read the posting and understand what success in this role looks like.

6. **Day-of Checklist**
   - Confirm the date/time and format of each interview.
   - Link to the team members you'll meet (LinkedIn or company bio, if available).
   - Note any technical setup needed (video call tools, coding environment, whiteboard).
   - Reminder: bring a physical copy of your tailored resume (the one in `outputs/resumes/`).

### Step 2.3: Ground everything in evidence

Before you finalize the guide:
- Every achievement or claim should reference the `evidence.jsonl` entry ID (e.g., "ev-001").
- Check that the evidence supports what you've written (no over-claiming).
- If an important skill is in the resume but missing from evidence, flag it — the candidate may need to review or add a note.

### Step 2.4: Finalize and commit

1. Save the guide to `outputs/study-guides/<company>/study-guide.md`.
2. Verify the file is readable and well-formatted.
3. Commit it to the workspace:
   ```bash
   git add outputs/study-guides/<company>/study-guide.md
   git commit -m "docs(study-guide): prepare for <company> — <role-title>"
   ```

---

## Example: Study guide structure

Here's a sample opening section to illustrate the style:

```markdown
# Interview Study Guide: Northwind Tools — Senior Product Manager, AI Developer Workflows

**Prepared:** 2026-07-20  
**Role:** Senior Product Manager, AI Developer Workflows  
**Company:** Northwind Tools  
**Posting:** https://jobs.example.invalid/northwind/ai-developer-workflows

## Role Overview

Northwind Tools is building AI-assisted developer workflows. This senior PM role owns the strategy, adoption, and launch readiness for a new AI workflow platform targeting enterprise development teams.

**Why you're a strong fit:**
- You've led launch coordination for internal developer platforms (ev-001).
- You have hands-on experience with AI-assisted developer tooling (ev-002).
- Your background in developer experience aligns with the role's focus on adoption and developer satisfaction.

---

## Your Strongest Assets

### 1. Launch Coordination for Developer Platforms (ev-001)

**What you did:** Led cross-functional launch coordination for an internal developer platform used by multiple product teams.

**Why it matters:** This role needs someone who can move a platform from launch readiness to adoption at scale. You've done this.

**Connection to the posting:** The job posting emphasizes "launch readiness" and "cross-functional coordination" — this is your bread and butter.

### 2. AI Workflow Demonstrations (ev-002)

**What you did:** Created a demo project for documenting AI-assisted developer workflow experiments.

**Why it matters:** You've worked hands-on with AI developer tooling, not just managed others building it.

**Connection to the posting:** The posting says "hands-on understanding of developer workflows." You bring both strategy and practical experience.

---

## Likely Interview Questions

### Recruiter Screen

1. **Tell me about your background in developer tools.** (Mention ev-001, ev-002. Focus on launch + adoption.)
2. **Why are you interested in this role specifically?** (Show you've read the posting. Name the AI workflow + developer experience focus.)

### Team Interview

3. **Walk us through your most complex platform launch.** (ev-001. Emphasize cross-functional coordination and results.)
4. **How do you approach measuring developer satisfaction or adoption?** (Open-ended. Ground in your evidence if you have metrics.)
5. **Tell us about a time you had to learn a new technology quickly.** (Check your evidence for examples. AI workflows, new tools, etc.)

### Executive Round

6. **What does success look like for a developer platform in year one?** (Tie to the job posting's focus on adoption.)
7. **How would you balance feature velocity with platform stability?** (Platform PM classic question. Your experience says something about this.)

---

## Addressing Gaps

Review the posting for required skills or experience you haven't explicitly mentioned in your evidence. For example:

- **Go programming (posting says "preferred"):** You haven't worked with Go. Honest response: "I haven't worked with Go, but I've learned new languages quickly (ev-003). Happy to invest here if the team values someone strong in platform design who can ramp on the stack."
- **B2B SaaS (posting says "experience a plus"):** Your background is internal platforms. Response: "My experience is internal platforms, where adoption dynamics and cross-functional buy-in are even more critical than in B2B SaaS. That rigor translates well."
```

---

## Tips for a strong study guide

- **Be specific.** "I led a launch" is less convincing than "I coordinated launch sequencing across 5 teams, delivered on-time, and saw 80% adoption in month one (ev-001)."
- **Link to evidence.** Every claim in your guide should have an evidence ID. If it doesn't, either add evidence or soften the claim.
- **Anticipate red flags.** If your background doesn't perfectly match the posting, address it proactively in the "Addressing Gaps" section. Honesty and a growth mindset go a long way.
- **Make it actionable.** The study guide is for you to use before and during interviews. Include exact talking points, not just background info.
- **Update as you learn.** If the candidate or hiring team shares new info (technical stack details, team challenges), update the guide to stay fresh.

---

## After the interviews

Once interviews are done:
1. Update the tracked role's `nextAction` and notes in `roles.tracked.json`.
2. Update the role's application status via `set-status` (e.g., `--status interview`).
3. Archive or keep the study guide in `outputs/study-guides/` as a historical record.
