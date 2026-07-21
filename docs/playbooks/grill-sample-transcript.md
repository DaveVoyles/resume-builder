# Sample grill intake transcript

This is a fictional transcript of a complete grill intake interview. It demonstrates how the agent asks questions one at a time, proposes recommended answers, and writes data to the workspace files.

---

## Candidate: Jordan Park

**Scenario:** Jordan is a mid-level engineer transitioning into technical leadership, looking to target senior engineer or engineering manager roles.

---

## Start of interview

**Agent:** "I'll help you capture your basic info, work history, education, target roles, location and compensation preferences, and any constraints. We'll go through this conversation one question at a time, and I'll propose recommended answers based on what you tell me. Ready to start with the basics?"

**Jordan:** "Yes, let's do it."

---

## Section 1: Basic information

### Q1.1: Name, location, and work authorization

**Agent:** "What name would you like to appear on your resume? What's your current city and country? And what's your work authorization status?"

**Jordan:** "Jordan Park is fine. I'm in Seattle, Washington, US. I'm a US citizen, so no sponsorship needed."

**Agent:** "Got it — Jordan Park, based in Seattle, WA, US, work authorization: US citizen, no sponsorship required. Is that right?"

**Jordan:** "Yes, exactly."

**Agent writes to `candidate/profile.json`:**

```json
{
  "candidate": {
    "preferredName": "Jordan Park",
    "location": {
      "city": "Seattle",
      "region": "WA",
      "country": "US"
    }
  },
  "workAuthorization": {
    "countries": ["US"],
    "requiresSponsorship": false
  }
}
```

**Agent also writes to `candidate/evidence.jsonl`:**

```jsonl
{"id":"ev-basic-001","type":"resume","fact":"Jordan Park, based in Seattle, WA, US, work authorization: US citizen, no sponsorship required.","summary":"Basic information from candidate intake","source":{"kind":"intake","note":"Candidate-provided during grill intake"},"snippet":"Jordan Park is fine. I'm in Seattle, Washington, US. I'm a US citizen, so no sponsorship needed.","confidence":"source-text","category":"other","createdAt":"2026-07-19T12:00:00.000Z"}
```

---

## Section 2: Work history

**Agent:** "Section 2 of 7: Work history"

### Q2.1: Most recent role

**Agent:** "Tell me about your most recent position. Include the company, your official title, when you started and ended the role, and whether it was remote, hybrid, or on-site."

**Jordan:** "I'm currently at Contoso Labs as a senior engineer. I started in April 2022 and I'm still there. It's hybrid—we're in Seattle but I work from home 3 days a week."

**Agent:** "Got it. So you're a Senior Engineer at Contoso Labs, April 2022 to present, hybrid in Seattle. Is that right?"

**Jordan:** "Yes, exactly."

**Agent writes to `candidate/profile.json`:**

```json
{
  "experience": [
    {
      "id": "exp-001",
      "organization": "Contoso Labs",
      "title": "Senior Engineer",
      "startDate": "2022-04",
      "endDate": null,
      "location": "Seattle, WA (Hybrid)"
    }
  ]
}
```

**Agent also writes to `candidate/evidence.jsonl`:**

```jsonl
{"id":"ev-001","type":"resume","fact":"Senior Engineer at Contoso Labs, April 2022–present.","summary":"Work history from candidate intake","source":{"kind":"intake","note":"Candidate-provided during grill intake"},"snippet":"Senior Engineer at Contoso Labs, April 2022 to present, hybrid in Seattle.","confidence":"source-text","category":"employment","createdAt":"2026-07-19T12:00:00.000Z"}
```

### Q2.2: Responsibilities and impact

**Agent:** "What were your main responsibilities in that role? Can you share any measurable outcomes or achievements you're proud of?"

**Jordan:** "I lead a platform team focused on developer infrastructure. We built an internal SDK that reduced deployment times by 40% for the product teams. I also mentored three junior engineers who got promoted. Pretty happy about that."

**Agent:** "That's strong impact. Let me propose this: 'Led platform team that built an internal SDK, reducing deployment times by 40% across product teams. Mentored 3 engineers to promotion.' Does that capture it?"

**Jordan:** "Yeah, that's good. Maybe just say 'three junior engineers' instead of '3 engineers'?"

**Agent:** "Perfect. I've updated it to 'three junior engineers.'"

**Agent writes to `candidate/profile.json`:**

```json
{
  "experience": [
    {
      "id": "exp-001",
      "organization": "Contoso Labs",
      "title": "Senior Engineer",
      "startDate": "2022-04",
      "endDate": null,
      "location": "Seattle, WA (Hybrid)",
      "highlights": [
        {
          "text": "Led platform team that built an internal SDK, reducing deployment times by 40% across product teams.",
          "evidenceIds": ["ev-impact-001"]
        },
        {
          "text": "Mentored three junior engineers to promotion.",
          "evidenceIds": ["ev-impact-002"]
        }
      ]
    }
  ]
}
```

**Agent writes to `candidate/evidence.jsonl`:**

```jsonl
{"id":"ev-impact-001","type":"resume","fact":"Led platform team that built an internal SDK, reducing deployment times by 40%.","summary":"Impact from intake discussion","source":{"kind":"intake","note":"Candidate-provided during grill intake"},"snippet":"We built an internal SDK that reduced deployment times by 40% for the product teams.","confidence":"source-text","category":"metric","createdAt":"2026-07-19T12:00:00.000Z"}
{"id":"ev-impact-002","type":"resume","fact":"Mentored three junior engineers who got promoted.","summary":"Impact from intake discussion","source":{"kind":"intake","note":"Candidate-provided during grill intake"},"snippet":"I mentored three junior engineers who got promoted.","confidence":"source-text","category":"leadership","createdAt":"2026-07-19T12:00:00.000Z"}
```

### Q2.3: Previous role

**Agent:** "Do you want to include your previous role? If yes, tell me about the company, title, dates, and location."

**Jordan:** "Yes. Before that, I was a Software Engineer at Acme Corp for 4 years, from 2018 to April 2022. That was on-site in San Francisco."

**Agent:** "So you were a Software Engineer at Acme Corp, April 2018 to April 2022, on-site in San Francisco. Anything else?"

**Jordan:** "That's right. I worked on their data pipeline infrastructure."

**Agent writes to `candidate/profile.json`:**

```json
{
  "experience": [
    {
      "id": "exp-001",
      "organization": "Contoso Labs",
      "title": "Senior Engineer",
      "startDate": "2022-04",
      "endDate": null,
      "location": "Seattle, WA (Hybrid)"
    },
    {
      "id": "exp-002",
      "organization": "Acme Corp",
      "title": "Software Engineer",
      "startDate": "2018-04",
      "endDate": "2022-04",
      "location": "San Francisco, CA (On-site)"
    }
  ]
}
```

**Agent:** "Any other roles you'd like to include?"

**Jordan:** "No, those two cover the last 6 years. That's plenty."

---

## Section 3: Education

### Q3.1: Education

**Agent:** "What's your educational background? Include your degree(s), institution(s), and dates."

**Jordan:** "I got a BS in Computer Science from the University of Washington. I graduated in 2016."

**Agent:** "Got it — BS in Computer Science, University of Washington, graduating 2016. Do you know your start year, or should I just note the graduation year?"

**Jordan:** "Honestly I don't remember the exact start year off the top of my head. Just use 2016."

**Agent:** "No problem, I'll note 2016 as the graduation year rather than guessing a start date."

**Agent writes to `candidate/profile.json`:**

```json
{
  "education": [
    {
      "degree": "BS, Computer Science",
      "institution": "University of Washington",
      "dates": "2016"
    }
  ]
}
```

**Agent writes to `candidate/evidence.jsonl`:**

```jsonl
{"id":"ev-education-001","type":"resume","fact":"BS, Computer Science, University of Washington, 2016.","summary":"Education from candidate intake","source":{"kind":"intake","note":"Candidate-provided during grill intake"},"snippet":"I got a BS in Computer Science from the University of Washington. I graduated in 2016.","confidence":"source-text","category":"education","createdAt":"2026-07-19T12:00:00.000Z"}
```

---

## Section 4: Target role

### Q4.1: Role titles and seniority

**Agent:** "What job titles or roles are you targeting? And what's your ideal seniority level?"

**Jordan:** "I'm interested in senior engineer roles or engineering manager positions. I'd like to try management but I'm open to staying technical too. I think I'm targeting senior level at minimum, but manager roles are where I'm heading."

**Agent:** "So you're targeting Senior Engineer and Engineering Manager roles, senior to manager level. Should I mark both as equally important, or is one a priority?"

**Jordan:** "Manager is where I really want to go, but senior engineer is a fallback if the right technical opportunity comes up. So maybe manager is higher priority?"

**Agent:** "Got it. I'll mark Engineering Manager as your primary target and Senior Engineer as secondary. Does that work?"

**Jordan:** "Perfect."

**Agent writes to `candidate/preferences.json`:**

```json
{
  "roleTargets": [
    {
      "titles": ["Engineering Manager", "Engineering Lead"],
      "seniority": "manager",
      "employmentTypes": ["full-time"],
      "priority": "must"
    },
    {
      "titles": ["Senior Engineer", "Senior Software Engineer"],
      "seniority": "senior",
      "employmentTypes": ["full-time"],
      "priority": "should"
    }
  ]
}
```

### Q4.2: Industries

**Agent:** "Are there industries or types of companies you prefer or want to avoid?"

**Jordan:** "I'm most interested in developer tools and infrastructure. Those are the spaces where I've had the most impact. I'd avoid fintech—I just don't have passion for it."

**Agent:** "So developer tools and infrastructure are top priorities, and fintech is something to avoid. Any other industries on your radar?"

**Jordan:** "Maybe open-source tooling too. And I'm neutral on company size—startup or enterprise works for me."

**Agent:** "I'll note developer tools and infrastructure as must-have, open-source as should-have, and fintech as avoid. Sound right?"

**Jordan:** "Yes."

**Agent writes to `candidate/preferences.json`:**

```json
{
  "industries": [
    {
      "name": "Developer tools",
      "priority": "must"
    },
    {
      "name": "Infrastructure and DevOps",
      "priority": "must"
    },
    {
      "name": "Open-source tooling",
      "priority": "should"
    },
    {
      "name": "Fintech",
      "priority": "avoid"
    }
  ]
}
```

---

## Section 5: Location and work mode

### Q5.1: Location and work mode

**Agent:** "What's your preferred work mode? Remote, hybrid, or on-site? Any location preferences or constraints?"

**Jordan:** "I'd prefer remote or hybrid. I like Seattle, but I'm open to other places as long as I can be remote at least 2–3 days a week. I wouldn't relocate to a high cost-of-living city though—San Francisco is too expensive."

**Agent:** "So you prefer remote or hybrid work, you're happy staying in Seattle, open to other West Coast locations, but would avoid high-cost cities like San Francisco. Is that right?"

**Jordan:** "Yes, that's it."

**Agent writes to `candidate/preferences.json`:**

```json
{
  "locations": {
    "workModes": ["remote", "hybrid"],
    "preferredRegions": ["Seattle, WA", "US West Coast"],
    "excludedRegions": ["San Francisco Bay Area", "New York City"],
    "priority": "must"
  }
}
```

---

## Section 6: Compensation

### Q6.1: Salary expectations

**Agent:** "What's your target salary or total compensation? Feel free to share a range or a minimum."

**Jordan:** "I'm making about $200k total now (salary plus stock). For a senior engineer role, I'd want to stay around that range, maybe $190–210k. For a manager role, I'd want to go higher—closer to $220–250k with a bonus."

**Agent:** "Got it. For senior engineer roles, you're targeting $190–210k total, and for manager roles, $220–250k total. Is that USD?"

**Jordan:** "Yes, all USD."

**Agent:** "Should I note this as your minimum being $190k and target being $230k as a middle ground?"

**Jordan:** "Sure, that works."

**Agent writes to `candidate/preferences.json`:**

```json
{
  "compensation": {
    "currency": "USD",
    "baseMinimum": 190000,
    "totalTarget": 230000,
    "publiclyShare": false
  }
}
```

---

## Section 7: Deal breakers and constraints

### Q7.1: Deal breakers

**Agent:** "Are there any conditions that would make a role unsuitable? Things like relocation, travel requirements, or types of companies?"

**Jordan:** "I don't want to relocate. I also can't travel more than 10% of the time—I have family commitments. And I'm not interested in companies doing anything unethical, especially in surveillance or weapons."

**Agent:** "So you're adding three constraints: no relocation required, travel limited to 10%, and no surveillance or weapons companies. Anything else?"

**Jordan:** "That covers it."

**Agent writes to `candidate/preferences.json`:**

```json
{
  "dealBreakers": [
    {
      "id": "deal-001",
      "text": "Role requires relocation outside the Seattle area.",
      "priority": "must"
    },
    {
      "id": "deal-002",
      "text": "Travel requirements exceed 10% of time.",
      "priority": "must"
    },
    {
      "id": "deal-003",
      "text": "Company operates in surveillance, weapons, or other ethically questionable domains.",
      "priority": "must"
    }
  ]
}
```

---

## Closing and validation

**Agent:** "Great! Let me summarize: You're Jordan Park, based in Seattle, WA, US citizen, a Senior Engineer at Contoso Labs with 6 years of experience and a BS in Computer Science from the University of Washington, targeting Engineering Manager or Senior Engineer roles in developer tools and infrastructure. You prefer remote or hybrid work in the Seattle area, you're targeting $190–250k total compensation depending on the role, and you have three deal breakers around relocation, travel, and company ethics. I've written all of this into your workspace files. Let me validate to make sure everything is correct."

**Agent runs:**

```bash
npm run workspace:validate -- --workspace candidate
```

**Output:**

```
✅ Workspace validation passed for candidate/
  - profile.json: valid
  - preferences.json: valid
  - evidence.jsonl: valid (5 entries)
```

**Agent:** "Perfect! Your workspace is valid. Next steps: Do you have resumes, GitHub profiles, or portfolio links you'd like me to ingest? That will help me extract evidence to back up your resume claims when we tailor roles."

**Jordan:** "I have my current resume and a GitHub profile. Let me send those to you."

---

## Files written

After this intake, the candidate's workspace contains:

- **`candidate/profile.json`** — Basic info (preferred name, location, work authorization), 2 experiences (Contoso Labs, Acme Corp) with highlights and evidence links, and 1 education entry (University of Washington)
- **`candidate/preferences.json`** — Role targets (Engineering Manager, Senior Engineer), industries (developer tools, infrastructure, open-source), locations (remote/hybrid, Seattle), compensation ($190–230k), and deal breakers (no relocation, travel, ethics)
- **`candidate/evidence.jsonl`** — 5 evidence entries (basic info, employment, SDK impact, mentoring impact, education)

The candidate is ready for the next phase: ingesting resumes and external sources to build a comprehensive evidence ledger.

---

## Key takeaways

- **One question at a time.** The agent asked one focused question and waited for a complete answer.
- **Propose and confirm.** After each answer, the agent restated what they heard and asked for confirmation.
- **Link evidence.** The agent created evidence records and linked them to profile facts.
- **Specific details.** Jordan shared concrete numbers (40% deployment time reduction, 3 engineers mentored, salary ranges) rather than vague answers.
- **Trade-offs.** Jordan expressed flexibility in some areas (manager vs. senior engineer) and hard constraints in others (no relocation).
- **Validate early.** After collecting all data, the agent validated the workspace to catch any errors.

---

See [grill.md](grill.md) for the full playbook.
