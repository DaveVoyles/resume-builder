# Grill intake playbook

**Grill** is an intake interview that captures the candidate's work history, target role, location preferences, compensation, and constraints into structured workspace files.

This playbook guides you through a conversation with the candidate, one question at a time. The candidate answers with specific details, and you write their answers into `profile.json`, `preferences.json`, and `evidence.jsonl`.

Before you start:

- The candidate should have access to their resumes, portfolio links, and notes about their target roles.
- You'll create or update files in the candidate's workspace (`candidate/profile.json`, `candidate/preferences.json`, `candidate/evidence.jsonl`).
- After intake, run `npm run workspace:validate -- --workspace candidate` to ensure the workspace is valid.

---

## Start the intake conversation

**Propose a recommended approach:**

"I'll ask you about your work history, target roles, location preferences, and salary expectations. For each question, I'll propose a recommended answer based on what you tell me, and you can confirm, refine, or correct it. Let's start with your most recent role."

**Confirm the candidate is ready:**

- [ ] The candidate has resumes or notes available.
- [ ] The candidate can describe roles and responsibilities.
- [ ] You have access to create or edit `candidate/profile.json`, `candidate/preferences.json`, and `candidate/evidence.jsonl`.

---

## Section 1: Work history

### Question 1.1: Most recent role

**Ask:**

"Tell me about your most recent position. Include the company, your official title, dates you held the role, and your location or work mode (remote, hybrid, on-site)."

**Candidate answers with:** Company name, title, start/end dates (e.g., "2022-04" to "present"), location or work mode.

**Recommend:**

"Based on what you shared, I'm proposing your most recent role as: [Company] → [Title], [Start] to [End], [Location/Mode]. Does that look right?"

**Write to `candidate/profile.json`:**

- Add an entry to the `experience` array with:
  - `id`: `exp-001` (increment for each role)
  - `organization`: The company name
  - `title`: The official title
  - `startDate`: ISO 8601 format (e.g., `2022-04`)
  - `endDate`: ISO 8601 format or `null` if current
  - `location`: "Remote", "Hybrid", "On-site", or city/region

**Also create an evidence record** (optional but useful):

- Add to `candidate/evidence.jsonl`:
  - `id`: `ev-work-001`
  - `type`: "resume"
  - `fact`: "[Title] at [Company], [Start]–[End]"
  - `summary`: "Work history from candidate intake"
  - `source`: `{"kind": "intake", "note": "Candidate-provided during grill intake"}`
  - `snippet`: The candidate's own words about the role
  - `confidence`: "source-text"
  - `category`: "employment"

### Question 1.2: Responsibilities and impact

**Ask:**

"What were your main responsibilities in that role? What measurable outcomes or achievements are you proud of?"

**Candidate answers with:** Specific duties, metrics, business outcomes.

**Recommend:**

"Here's how I'd phrase the impact from your role: [Bullet-point summary]. Does this capture your contribution? Any changes?"

**Write to `candidate/profile.json`:**

- Add a `highlights` entry to the role's experience object:
  - `text`: The accomplishment as a resume bullet
  - `evidenceIds`: Reference evidence records you create

**Also create evidence:**

- Add to `candidate/evidence.jsonl` for each significant achievement:
  - `id`: `ev-impact-001`
  - `type`: "resume"
  - `fact`: The specific achievement or metric
  - `summary`: "Impact from intake discussion"
  - `source`: `{"kind": "intake", "note": "..."}`
  - `snippet`: The candidate's own description
  - `confidence`: "source-text"
  - `category`: "metric" or "project" as appropriate

### Repeat for other roles

**Ask:**

"Do you want to include your previous role? If yes, tell me about the company, title, dates, and location."

**Repeat questions 1.1 and 1.2** for each earlier role, working backward from most recent.

**Stop when:**

- The candidate says they've shared all relevant roles, or
- You've captured the most recent 5–10 years (adjust for the candidate's preferences).

---

## Section 2: Target role

### Question 2.1: Role titles and seniority

**Ask:**

"What job titles or roles are you targeting? What's your ideal seniority level (entry-level, mid-level, senior, staff engineer, manager, director, or flexible)?"

**Candidate answers with:** Preferred titles, seniority level.

**Recommend:**

"I'm proposing you target: [Titles]. Does that match your goals? Any titles to add or remove?"

**Write to `candidate/preferences.json`:**

- Add to the `roleTargets` array:
  - `titles`: Array of target titles (e.g., `["Senior Software Engineer", "Technical Lead"]`)
  - `seniority`: One of `intern`, `entry`, `mid`, `senior`, `staff`, `principal`, `manager`, `director`, `executive`, or `flexible`
  - `employmentTypes`: Array, e.g., `["full-time"]`
  - `priority`: `"must"` or `"should"`

### Question 2.2: Preferred industries or domains

**Ask:**

"Are there industries, domains, or types of companies you prefer or want to avoid? For example, fintech, developer tools, healthcare, startups, or Fortune 500s."

**Candidate answers with:** Industries, preferences, or avoidances.

**Recommend:**

"Based on what you shared, I'm noting your preferences as: [Summary]. Does that sound right?"

**Write to `candidate/preferences.json`:**

- Add to the `industries` array:
  - `name`: Industry or domain name
  - `priority`: `"must"`, `"should"`, `"could"`, or `"avoid"`

---

## Section 3: Location and work mode

### Question 3.1: Location and work mode

**Ask:**

"What's your preferred work mode? (Remote, hybrid, on-site.) Are there specific locations you prefer or want to avoid?"

**Candidate answers with:** Work mode preference, regions or cities.

**Recommend:**

"I'm proposing: [Work mode], [Regions]. Does that fit your situation?"

**Write to `candidate/preferences.json`:**

- Set the `locations` object:
  - `workModes`: Array, e.g., `["remote", "hybrid"]`
  - `preferredRegions`: Array of preferred locations (e.g., `["US West Coast", "Canada"]`), or `[]` if flexible
  - `excludedRegions`: Array of avoided locations, or `[]` if none
  - `priority`: `"must"`, `"should"`, or `"could"`

---

## Section 4: Salary and compensation

### Question 4.1: Compensation expectations

**Ask:**

"What salary or total compensation are you targeting? What's your acceptable range? (Feel free to share a range, total compensation target, or just a minimum.)"

**Candidate answers with:** Base salary or total compensation range.

**Recommend:**

"I'm proposing a target range of: [Range] [Currency]. Is that right? Should we adjust?"

**Write to `candidate/preferences.json`:**

- Set the `compensation` object:
  - `currency`: `"USD"` or other currency code
  - `baseMinimum`: Minimum acceptable base salary (number)
  - `totalTarget`: Target total compensation (number), or omit if not discussed
  - `publiclyShare`: `false` (default—candidate can opt in later)

---

## Section 5: Constraints and deal breakers

### Question 5.1: Deal breakers

**Ask:**

"Are there any conditions that would make a role unsuitable? For example, relocation requirements, travel expectations, or company stage preferences?"

**Candidate answers with:** Constraints, deal breakers, or non-negotiables.

**Recommend:**

"I'm noting these as must-avoid conditions: [List]. Anything else?"

**Write to `candidate/preferences.json`:**

- Add to the `dealBreakers` array:
  - `id`: `deal-001` (increment for each)
  - `text`: The deal breaker condition
  - `priority`: `"must"`

---

## Closing: Summary and next steps

**Summarize what you've collected:**

"Here's what we captured: [Work history], targeting [Roles] in [Locations] with [Compensation] range. I've written this into your workspace files. Let me validate everything now."

**Validate the workspace:**

```bash
npm run workspace:validate -- --workspace candidate
```

**If validation passes:**

"Your workspace is valid! Next steps: [Build profiles and evidence, find similar roles, tailor resumes, or track roles.]"

**If validation fails:**

Show the candidate the specific error, ask for clarification, and update the workspace files.

**Ask the candidate:**

"Do you have resumes, GitHub profiles, or portfolio links you'd like me to ingest? That will help me extract evidence to back up your resume claims."

---

## Tips for the interview

- **Ask one question at a time.** Pause for a complete answer before moving to the next question.
- **Probe for specifics.** Vague answers like "managed a team" are weaker than "led a team of 4 engineers through a Q3 migration."
- **Propose and confirm.** After each answer, restate what you understood and ask if it's accurate.
- **Record unanswered questions.** If the candidate isn't sure about a detail, make a note and move on; you can circle back or research later.
- **Link evidence.** When the candidate mentions a metric, achievement, or skill, ask for a source (resume, GitHub, portfolio, notes).
- **Respect privacy.** Don't ask the candidate to share anything they're uncomfortable recording in a workspace file.

---

## Schema reference

- `profile.json`: Stores normalized candidate facts (experience, skills, education, contact).
- `preferences.json`: Stores goals and constraints (role targets, location, compensation, deal breakers).
- `evidence.jsonl`: Stores claim-level evidence with source references (ledger format, one JSON object per line).

For full details, see [Candidate workspace schemas](../workspace-schemas.md).
