# Find-roles playbook

**Find-roles** is a search workflow that discovers prospective roles matching the candidate's profile, vets them against preferences, and maintains a `leads.json` file of promising opportunities.

A "lead" is a prospective role the candidate hasn't applied to yet: you search, vet, verify the posting is live, capture it in `leads.json`, then promote accepted leads into tracked roles via the existing `add-role` command.

Before you start:

- The candidate should have completed their intake (grill playbook) and filled in `profile.json`, `preferences.json`, and at least started `evidence.jsonl`.
- You'll search for roles matching the candidate's target titles, location, and industry preferences.
- You'll create or update `candidate/leads.json` to track prospective roles.
- After finding leads, run `npm run workspace:validate -- --workspace candidate` to ensure the workspace is valid.

---

## Start the search

**Propose a recommended approach:**

"I'll search for roles that match your target titles and preferences. For each posting I find, I'll check if it meets your criteria — location, work mode, compensation, and deal breakers. If it looks promising, I'll verify the job posting is real (link is live), then save it as a lead with fit notes. When you review a lead, you can accept it or skip it. Accepted leads move into your tracked roles."

**Confirm you're ready:**

- [ ] The candidate has completed the grill intake (profile and preferences exist).
- [ ] You have access to create or edit `candidate/leads.json`.
- [ ] You have internet access to verify job postings are live.

---

## Section 1: Search strategy

### Determine search terms

**Based on the candidate's preferences, extract:**

- **Target titles** from `preferences.json`'s `roleTargets[].titles`
- **Industries** from `preferences.json`'s `industries`
- **Locations** from `preferences.json`'s `locations.workModes` and preferred regions
- **Compensation range** from `preferences.json`'s `compensation`

**Recommend a search plan:**

"I'll search for roles matching: [Titles] in [Industries], [Work modes], [Regions]. I'll focus on postings in the [Compensation range] salary range. Sound good?"

### Search sources

Search publicly available job boards, company career pages, recruiter posts, and industry-specific listings. Recommended sources:

- LinkedIn (Jobs)
- Wellfound (for startups)
- Built In (for tech companies)
- AngelList (for early-stage roles)
- Company-specific career pages
- Referral networks and recruiter outreach

---

## Section 2: Vet each posting

For each role you find, vet it against the candidate's preferences **before** you save it as a lead.

### Question 2.1: Does it match the target titles and seniority?

**Check:** Does the posting's title or description match one of the target titles in `roleTargets[]`? Is the seniority level acceptable?

**If no → Skip this posting.**

**If yes → Continue.**

### Question 2.2: Does the location and work mode match?

**Check:**
- Is the work mode (remote, hybrid, on-site) in the candidate's `locations.workModes`?
- If on-site or hybrid, is the location in the `locations.preferredRegions`, or excluded from `locations.excludedRegions`?
- **Note the match strength, not just in/out.** `preferredRegions` is ordered by priority — the first entry is the candidate's most preferred region. A posting matching an earlier entry is a stronger location fit than one matching a later entry; reflect that in the lead's `fit.level` and `fit.rationale` (e.g., "matches top-priority region" vs. "matches a lower-priority but still acceptable region") rather than treating every in-list match the same.

**If no → Skip this posting.**

**If yes → Continue.**

### Question 2.3: Is the compensation acceptable?

**Check:**
- If the posting lists a salary or range, does it meet the `compensation.baseMinimum`?
- Is it below any hard-cap the candidate mentioned?

**If no → Skip this posting.**

**If yes → Continue.**

### Question 2.4: Do any deal breakers apply?

**Check:** Against each item in `dealBreakers[]`, does this posting violate the constraint?

Examples:
- "Requires relocation" — does the job require moving?
- "No international travel" — does the posting mention frequent travel?
- "No startup culture" — is this a very early-stage startup if the candidate prefers enterprise?

**If yes, deal-breaker triggered → Skip this posting.**

**If no → This is a lead. Proceed to verification.**

---

## Section 3: Verify the posting is real

**Before saving a lead, verify the job posting actually exists and is current:**

### Verification steps

1. **Visit the job posting URL directly.** Does it load without 404 or "posting has closed" messages?
2. **Check the posting date.** Is it recent (posted within the last 30 days, ideally)?
3. **Scan for red flags:**
   - Is the company name spelled consistently in the posting?
   - Does the posting mention how to apply?
   - Are there obvious AI-generated or placeholder text patterns?

**If verification fails (404, closed, stale, suspicious) → Skip this posting.**

**If verification passes → Save as a lead.**

---

## Section 4: Create or update the leads.json file

**When you've found a vetted, verified posting, save it to `candidate/leads.json`:**

**Structure:**

```json
{
  "schemaVersion": "1.0",
  "leads": [
    {
      "id": "lead-001",
      "company": "Acme Corp",
      "title": "Senior Software Engineer",
      "url": "https://jobs.example.com/acme/senior-engineer",
      "source": "LinkedIn",
      "discoveredAt": "2026-07-19",
      "fit": {
        "level": "strong",
        "rationale": "Matches target seniority, remote work, and developer tools focus."
      },
      "notes": "Contact: recruiting@acme.com. Active project: AI debugging tools."
    }
  ]
}
```

**For each lead:**

- `id`: Unique identifier, format `lead-NNN` (increment with each new lead)
- `company`: Company name from the posting
- `title`: Job title from the posting
- `url`: Direct link to the posting
- `source`: Where you found it (LinkedIn, Wellfound, company career page, etc.)
- `discoveredAt`: ISO 8601 date (e.g., `2026-07-19`)
- `fit.level`: One of `strong`, `moderate`, `stretch` (how well it matches preferences)
- `fit.rationale`: 1-2 sentence explanation of the fit
- `notes` (optional): Any details the candidate should review (recruiter contact, tech stack, unique selling points)

---

## Section 5: Candidate review and promotion

**Once you've saved leads, present them to the candidate for review:**

**Summarize what you found:**

"I found [N] leads that match your criteria. Here's the list:

1. [Company]: [Title] — [Fit rationale]
2. [Company]: [Title] — [Fit rationale]
..."

**Ask the candidate:**

"For each lead, do you want to accept it and move it into your tracked roles, or skip it?"

### Accepting a lead

**When the candidate accepts a lead, promote it using the `add-role` command:**

```bash
npm run workspace:add-role -- --workspace candidate --url <posting-url> --tracked
```

**This command:**
1. Adds the role to `roles.tracked.json` (not `roles.seed.json`)
2. Sets an initial status to `interested`
3. Prepares it for resume tailoring or status updates

**Example:**

```bash
npm run workspace:add-role -- --workspace candidate --url "https://jobs.example.com/acme/senior-engineer" --tracked
```

**After promotion:**
- Remove the lead from `leads.json` or mark it as `promoted` (optional — you can also leave historical leads for reference).
- The role now appears in `roles.tracked.json` and will show up in the tracker and future workflows.

### Skipping a lead

If the candidate declines a lead, simply remove it from `leads.json` or keep it as `rejected` for future reference.

---

## Section 6: Validate and continue

**After accepting and promoting leads, validate the workspace:**

```bash
npm run workspace:validate -- --workspace candidate
```

**If validation passes:**

"Your leads are saved and promoted roles are in your tracker. Next steps: tailor resumes, update application status, or generate study guides as you interview."

**If validation fails:**

Address the specific errors (missing fields, invalid URLs, malformed JSON) and re-run validation.

---

## Tips for search and vetting

- **Search 5–10 roles at once.** Batch your searches by title or company to stay efficient.
- **Be strict about preferences.** If a posting doesn't clearly meet the location, compensation, or seniority criteria, skip it. A perfect fit is rare; a good fit is your target.
- **Verify live links.** A posting that looked great but is now closed wastes candidate time on a follow-up that can't happen.
- **Capture rationale.** When you note why a lead fits (or doesn't), the candidate can learn what to look for in their own searches later.
- **Ask clarifying questions.** If you're unsure whether a posting meets a preference (e.g., "is remote OK for this role?"), ask the candidate before saving it.
- **Keep notes brief.** The notes field is for quick reference — recruiter names, standout projects, application deadlines — not a full posting summary.

---

## Schema reference

- `leads.json`: Agent-maintained plain workspace file of prospective roles (see [Candidate workspace schemas](../workspace-schemas.md)).
- `roles.tracked.json`: Promoted leads live here after acceptance (managed by `add-role --tracked`).
- `preferences.json`: The source of truth for vetting criteria (location, compensation, deal breakers).

For full details, see [Candidate workspace schemas](../workspace-schemas.md).
