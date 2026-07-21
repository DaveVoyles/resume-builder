# Grill intake playbook

**Grill** is an intake interview that captures the candidate's basic information, work history, education, target role, location preferences, compensation, and constraints into structured workspace files.

This playbook guides you through a conversation with the candidate, one question at a time. The candidate answers with specific details, and you write their answers into `profile.json`, `preferences.json`, and `evidence.jsonl`.

Before you start:

- The candidate should have access to their resumes, portfolio links, and notes about their target roles.
- You'll create or update files in the candidate's workspace (`candidate/profile.json`, `candidate/preferences.json`, `candidate/evidence.jsonl`).
- After intake, run `npm run workspace:validate -- --workspace candidate` to ensure the workspace is valid.

---

## Start the intake conversation

**Propose a recommended approach:**

"I'll ask you about your basic info, work history, education, target roles, location preferences, and salary expectations. For each question, I'll propose a recommended answer based on what you tell me, and you can confirm, refine, or correct it. Let's start with the basics."

**Confirm the candidate is ready:**

- [ ] The candidate has resumes or notes available.
- [ ] The candidate can describe roles and responsibilities.
- [ ] You have access to create or edit `candidate/profile.json`, `candidate/preferences.json`, and `candidate/evidence.jsonl`.

**Check ingested evidence before asking — for every question, not just Section 2 (Work history):**

If the candidate reached this playbook via onboarding's State 3 handoff, they've already ingested resumes, notes, or links — the raw material is sitting in the workspace even though `profile.json`'s `experience[]` is still empty. Before posing each question's "Ask" step, check whether the answer is already evident from what's been ingested:

- Read `candidate/profile.json` — a prior session or partial import may have already populated fields relevant to the question.
- Read `candidate/evidence.jsonl` and scan its `fact` and `snippet` values for anything relevant.
- If an evidence record's `snippet` is empty (`confidence: "metadata-only"`), don't treat that as "nothing there" — follow the record's `source.path` and skim the raw file directly under `candidate/inputs/resumes/` or `candidate/inputs/notes/`.

When ingested material already answers the question, skip the blind "Ask" and go straight to a **Recommend**-style proposal built from that evidence — for example, "Your resume shows you started at Xbox Commerce in 2020, and it's still listed as your current role — is that still accurate?" rather than "What are your dates at Xbox Commerce?" Only fall back to asking from scratch when ingested material doesn't cover the field. Either way, still confirm with the candidate before writing to the workspace files — proposing from evidence shortcuts the ask, not the confirmation.

---

## Section 1: Basic information

Mirrors [`intake.md`](../../templates/candidate-intake.md)'s "👤 Basic information" section — if the candidate already filled that template in, confirm those answers here rather than asking blind (see "Check ingested evidence before asking," above).

### Question 1.1: Name, location, and work authorization

**Before asking:** check `candidate/profile.json`, `candidate/intake.md` (if present), and `candidate/evidence.jsonl` for a name, location, or work-authorization status already captured. A resume's header usually states the candidate's name and sometimes their location; work authorization is rarely stated in a resume and usually needs a direct question.

**Ask:**

"What name would you like to appear on your resume? What's your current city and country? And what's your work authorization status — for example, citizen, permanent resident, or do you need visa sponsorship — for the country or countries you're targeting?"

**Candidate answers with:** Preferred name, current location (city/region/country), work authorization status and sponsorship needs.

**Recommend:**

"I'm proposing: [Name], based in [Location], work authorization: [Status]. Does that look right?"

**Write to `candidate/profile.json`:**

- Set `candidate.preferredName`: the name to use in generated documents.
- Set `candidate.location`: object with `city`, `region`, `country` (and `timeZone` if known).
- Set `workAuthorization`: object with `countries` (array of countries the candidate is authorized to work in) and `requiresSponsorship` (boolean).

**Also create an evidence record** (optional but useful):

- Add to `candidate/evidence.jsonl`:
  - `id`: `ev-basic-001`
  - `type`: "resume"
  - `fact`: "[Name], based in [Location], work authorization: [Status]"
  - `summary`: "Basic information from candidate intake"
  - `source`: `{"kind": "intake", "note": "Candidate-provided during grill intake"}`
  - `snippet`: The candidate's own words
  - `confidence`: "source-text"
  - `category`: "other"

---

## Section 2: Work history

**Narrate to the candidate:** "Section 1 of 5: Work history"

### Question 2.1: Most recent role

**Before asking:** check `candidate/profile.json` and `candidate/evidence.jsonl` (and the raw resume/notes text if a record is `metadata-only`) for a company, title, dates, or location that's already ingested. Role history is usually the most complete part of a resume, so this is where you're most likely to find an answer already sitting in the workspace.

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

### Question 2.2: Responsibilities and impact

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

**Repeat questions 2.1 and 2.2** for each earlier role, working backward from most recent.

**Stop when:**

- The candidate says they've shared all relevant roles, or
- You've captured the most recent 5–10 years (adjust for the candidate's preferences).

---

## Section 3: Education

### Question 3.1: Education

**Before asking:** check `candidate/profile.json` and `candidate/evidence.jsonl` (and the raw resume/notes text if a record is `metadata-only`) for degree, institution, and date information already ingested — a resume's Education section usually states this, often near the bottom. **Only use what the source text actually states.** If a resume gives just a graduation year (e.g. "2009") rather than a full date range, propose that graduation year — don't invent a plausible-looking start date (e.g. don't turn "2009" into "2005 - 2009") to fill in a range the candidate never confirmed.

**Ask:**

"What's your educational background? Include your degree(s), institution(s), and dates. If you're not sure of the exact start date, just share what you do know — for example, a graduation year is fine."

**Candidate answers with:** Degree, institution, dates (or a single graduation year), honors or activities if relevant.

**Recommend:**

"I'm proposing: [Degree], [Institution], [Dates]. Does that look right?"

**Write to `candidate/profile.json`:**

- Add an entry to the `education` array with:
  - `degree`: The degree or credential earned
  - `institution`: The school or program name
  - `dates`: The date range or single year exactly as stated by the candidate or source text — never expand a partial date into a full range without the candidate explicitly confirming the start date
  - `details`: Honors, activities, or relevant coursework (optional)

**Also create an evidence record** (optional but useful):

- Add to `candidate/evidence.jsonl`:
  - `id`: `ev-education-001`
  - `type`: "resume"
  - `fact`: "[Degree], [Institution], [Dates]"
  - `summary`: "Education from candidate intake"
  - `source`: `{"kind": "intake", "note": "Candidate-provided during grill intake"}`
  - `snippet`: The candidate's own words, or the exact source-text excerpt if backfilled from an ingested resume
  - `confidence`: "source-text"
  - `category`: "education"

**Repeat** for each additional degree or credential the candidate wants included.

---

## Section 4: Target role

**Narrate to the candidate:** "Section 2 of 5: Target role"

### Question 4.1: Role titles and seniority

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

### Question 4.2: Preferred industries or domains

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

## Section 5: Location and work mode

**Narrate to the candidate:** "Section 3 of 5: Location and work mode"

### Question 5.1: Location and work mode

**Ask:**

"What's your preferred work mode? (Remote, hybrid, on-site.) Are there specific locations you prefer or want to avoid? If you prefer more than one region, which one is most desirable?"

**Candidate answers with:** Work mode preference, regions or cities — if they mention more than one preferred region, note which one they'd rank higher.

**Recommend:**

"I'm proposing: [Work mode], [Regions, most preferred first]. Does that fit your situation?"

**Write to `candidate/preferences.json`:**

- Set the `locations` object:
  - `workModes`: Array, e.g., `["remote", "hybrid"]`
  - `preferredRegions`: Array of preferred locations, ordered by priority — the first entry is the candidate's most preferred region, with each later entry progressively less preferred. For example, if the candidate says "Philadelphia is ideal for hybrid; New York works, but is less desirable," write `["Philadelphia", "New York"]`. Use `[]` if flexible.
  - `excludedRegions`: Array of avoided locations, or `[]` if none — this is a flat set with no ranking, since exclusions don't need a "how much I don't want it" order
  - `priority`: `"must"`, `"should"`, or `"could"`

---

## Section 6: Salary and compensation

**Narrate to the candidate:** "Section 4 of 5: Salary and compensation"

### Question 6.1: Compensation expectations

**Ask:**

"What salary or total compensation are you targeting? What's your acceptable range? (Feel free to share a range, total compensation target, or just a minimum.)"

**Candidate answers with:** Base salary or total compensation range.

**Note which frame the candidate is using.** Some candidates answer in base-salary terms ("I need at least $X base"); others answer entirely in total-comp terms ("any mix of base/bonus/equity is fine, but I need $X total"). Don't force a total-comp answer into `baseMinimum` — that field is a base-salary-only floor. If the candidate's floor is a total-comp number, capture it as `totalMinimum` instead (or in addition, if they gave both).

**Recommend:**

"I'm proposing a target range of: [Range] [Currency]. Is that right? Should we adjust?"

**Write to `candidate/preferences.json`:**

- Set the `compensation` object:
  - `currency`: `"USD"` or other currency code
  - `baseMinimum`: Minimum acceptable base salary (number), if the candidate gave a base-only floor
  - `totalMinimum`: Minimum acceptable total compensation — base + bonus + equity (number), if the candidate gave a total-comp floor
  - `totalTarget`: Target total compensation (number), or omit if not discussed
  - `publiclyShare`: `false` (default—candidate can opt in later)

**Example:** If the candidate says "$300k total is my ideal, and I'm flexible on how base, bonus, and equity mix — but I wouldn't go below $250k total," that's a total-comp floor, not a base floor. Write `totalTarget: 300000` and `totalMinimum: 250000`, and omit `baseMinimum` rather than repurposing it to hold the $250k figure.

---

## Section 7: Constraints and deal breakers

**Narrate to the candidate:** "Section 5 of 5: Constraints and deal breakers"

### Question 7.1: Deal breakers

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

"Here's what we captured: [Basic info], [Work history], [Education], targeting [Roles] in [Locations] with [Compensation] range. I've written this into your workspace files. Let me validate everything now."

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
