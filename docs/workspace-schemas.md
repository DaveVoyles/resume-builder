# Candidate workspace schemas

Try this:

```text
Use these v1 schemas when you create or validate a candidate workspace.
Keep all examples fictional and keep private candidate data out of committed files.
```

These schemas define the pragmatic v1 shape for friend-facing candidate workspaces. They keep the current validator contract intact while giving the CLI enough structure to ingest evidence, match roles, generate resumes, and build trackers.

---

## Shared conventions

Use these conventions across all workspace files:

- Use `schemaVersion: "1.0"` in every JSON file.
- Use stable lowercase IDs with a type prefix, such as `ev-001`, `role-001`, or `policy-001`.
- Use ISO 8601 dates for date fields, such as `2026-06-08`.
- Omit unknown optional fields instead of adding placeholder values.
- Use `null` only when the difference between "unknown" and "intentionally empty" matters.
- Store private source files under the candidate workspace and commit only sanitized examples.
- Reference evidence by ID from profile facts, role fit notes, and claim policy exceptions.

## `profile.json`

`profile.json` stores normalized candidate facts that can support generated resumes and role matching. Treat it as private candidate data by default.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | string | Must be `"1.0"`. |
| `candidate` | object | Candidate identity fields used for generated materials. |
| `experience` | array | Work history entries, ordered newest first when possible. |
| `skills` | array | Normalized skill groups or individual skills. |

### Required `candidate` fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Stable workspace-local candidate ID. |
| `preferredName` | string | Name to use in generated documents. |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `candidate.pronouns` | string | Candidate-provided pronouns. |
| `candidate.location` | object | City, region, country, and time zone. |
| `contact` | object | Email, phone, and candidate-approved links. |
| `summary` | string | Candidate-approved summary paragraph. |
| `workAuthorization` | object | Countries and sponsorship requirements. |
| `education` | array | Education entries. |
| `certifications` | array | Certification entries. |
| `projects` | array | Portfolio or public-work entries. |
| `languages` | array | Spoken or written languages. |
| `updatedAt` | string | Last update date. |

### Example

```json
{
  "schemaVersion": "1.0",
  "candidate": {
    "id": "sample-candidate",
    "preferredName": "Alex Rivera",
    "pronouns": "they/them",
    "location": {
      "city": "Raleigh",
      "region": "NC",
      "country": "US",
      "timeZone": "America/New_York"
    }
  },
  "contact": {
    "email": "alex.rivera@example.invalid",
    "links": [
      {
        "type": "portfolio",
        "url": "https://portfolio.example.invalid/alex"
      }
    ]
  },
  "summary": "Product-minded engineering leader focused on developer platforms and AI-assisted workflows.",
  "workAuthorization": {
    "countries": ["US"],
    "requiresSponsorship": false
  },
  "experience": [
    {
      "id": "exp-001",
      "organization": "Contoso Labs",
      "title": "Senior platform program manager",
      "startDate": "2022-04",
      "endDate": null,
      "location": "Remote",
      "highlights": [
        {
          "text": "Led a cross-functional launch process for internal developer tools.",
          "evidenceIds": ["ev-001"]
        }
      ]
    }
  ],
  "skills": [
    {
      "name": "Developer platforms",
      "level": "advanced",
      "evidenceIds": ["ev-001", "ev-002"]
    }
  ],
  "updatedAt": "2026-06-08"
}
```

## `preferences.json`

`preferences.json` stores candidate goals and constraints. Use it to rank roles, decide what to exclude, and ask targeted follow-up questions.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | string | Must be `"1.0"`. |
| `roleTargets` | array | Desired titles, seniority, and employment types. |
| `locations` | object | Location and work-mode preferences. |
| `dealBreakers` | array | Conditions that should exclude a role. |

### Useful enum values

| Field | Values |
| --- | --- |
| `roleTargets[].seniority` | `intern`, `entry`, `mid`, `senior`, `staff`, `principal`, `manager`, `director`, `executive`, `flexible` |
| `roleTargets[].employmentTypes[]` | `full-time`, `contract`, `part-time`, `internship`, `fractional` |
| `locations.workModes[]` | `remote`, `hybrid`, `on-site`, `flexible` |
| `travel` | `none`, `limited`, `moderate`, `frequent` |
| `priority` | `must`, `should`, `could`, `avoid` |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `industries` | array | Preferred, neutral, or avoided industries. |
| `companyStages` | array | Startup, growth, enterprise, nonprofit, or public-sector preferences. |
| `technologies` | array | Technologies to highlight or avoid. |
| `compensation` | object | Candidate-provided range and currency. |
| `availability` | object | Start date, notice period, and interview windows. |
| `resumeStyle` | object | Tone, length, and emphasis preferences. |
| `notes` | string | Candidate-approved notes for agents. |

### Example

```json
{
  "schemaVersion": "1.0",
  "roleTargets": [
    {
      "titles": ["Developer platform program manager", "AI tools product manager"],
      "seniority": "senior",
      "employmentTypes": ["full-time"],
      "priority": "must"
    }
  ],
  "locations": {
    "workModes": ["remote", "hybrid"],
    "preferredRegions": ["US East Coast"],
    "excludedRegions": [],
    "priority": "should"
  },
  "industries": [
    {
      "name": "Developer tools",
      "priority": "must"
    },
    {
      "name": "Ad tech",
      "priority": "avoid"
    }
  ],
  "compensation": {
    "currency": "USD",
    "baseMinimum": 160000,
    "totalTarget": 220000,
    "publiclyShare": false
  },
  "travel": "limited",
  "dealBreakers": [
    {
      "id": "deal-001",
      "text": "Requires relocation outside the United States.",
      "priority": "must"
    }
  ]
}
```

## `evidence.jsonl`

`evidence.jsonl` is a JSON Lines ledger. Each non-empty line must be a standalone JSON object. The current CLI writes `id`, `type`, `fact`, `summary`, `source`, `snippet`, `confidence`, `metadata`, and `createdAt`. The validator treats entries without source text as metadata-only records so unsupported facts fail before a generator uses them.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique evidence ID. |
| `type` | string | Ingestion type, such as `resume`, `notes`, `source`, or `github_profile`. |
| `fact` | string | Concise fact that can support a claim. |
| `summary` | string | Human-readable ingestion summary. |
| `source` | object | Source descriptor. It must include `kind` and either `path` or `url`. |
| `snippet` | string | Supporting source text. Leave empty only for `metadata-only` evidence. |
| `confidence` | string | Source confidence or review confidence. |
| `metadata` | object | Adapter metadata such as SHA-256, byte count, extraction mode, or API counts. |
| `createdAt` | string | Creation timestamp. |

### Useful enum values

| Field | Values |
| --- | --- |
| `confidence` | `source-text`, `metadata-only`, `high`, `medium`, `low` |
| `category` | `employment`, `project`, `skill`, `metric`, `leadership`, `education`, `certification`, `public-work`, `preference`, `other` |
| `sourceType` | `resume`, `note`, `github`, `portfolio`, `job-posting`, `candidate-confirmation`, `other` |
| `status` | `verified`, `needs-confirmation`, `rejected`, `superseded` |
| `restrictions[].type` | `do-not-quantify`, `candidate-review`, `avoid-public-use`, `outdated`, `sensitive`, `other` |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `sourceType` | string | Source category. |
| `quote` | string | Short supporting excerpt when safe to store. |
| `category` | string | Claim category. |
| `dateRange` | object | Start and end dates connected to the fact. |
| `relatedProfilePath` | string | JSON pointer to the related `profile.json` field. |
| `restrictions` | array | Claim-use restrictions. |
| `tags` | array | Search and matching tags. |
| `updatedAt` | string | Update date. |

### Example

```jsonl
{"id":"ev-001","type":"resume","fact":"Led launch coordination for an internal developer platform used by multiple product teams.","summary":"resume source ingested from inputs/resumes/alex-platform-summary.md","source":{"kind":"resume","path":"inputs/resumes/alex-platform-summary.md","ingestedAt":"2026-06-08T12:00:00.000Z"},"snippet":"Led launch coordination for an internal developer platform used by multiple product teams.","confidence":"source-text","metadata":{"sha256":"example","extractionMode":"utf8"},"category":"leadership","status":"verified","tags":["developer-platforms","launch"],"createdAt":"2026-06-08T12:00:00.000Z"}
{"id":"ev-002","type":"notes","fact":"notes source ingested from inputs/notes/project-notes.md","summary":"notes source ingested from inputs/notes/project-notes.md","source":{"kind":"notes","path":"inputs/notes/project-notes.md","ingestedAt":"2026-06-08T12:00:00.000Z"},"snippet":"","confidence":"metadata-only","metadata":{"sha256":"example","extractionMode":"metadata-only"},"status":"needs-confirmation","restrictions":[{"type":"candidate-review","note":"Capture source text before using this as a resume claim."}],"createdAt":"2026-06-08T12:00:00.000Z"}
```

### Validation rules

The validator flags evidence before output when:

- The entry is not an object.
- Any required field is missing or blank.
- A duplicate `id` appears.
- `source.kind` is missing.
- `source` has neither `path` nor `url`.
- Source-backed evidence has no `snippet` or `quote`.
- `metadata-only` evidence tries to state a separate fact instead of matching `summary`.

## `roles.seed.json`

`roles.seed.json` stores roles the candidate provides as examples or possible targets. The current CLI expects an array where every role has non-empty `id`, `company`, `title`, and `status` strings plus a `urls` object.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique role ID. |
| `company` | string | Company or organization name. |
| `title` | string | Role title. |
| `status` | string | Seed role status. |
| `urls` | object | Source URLs, currently `job` and `apply`. Use empty strings for manually entered role descriptions. |

### Useful enum values

| Field | Values |
| --- | --- |
| `status` | `seeded`, `researching`, `accepted`, `rejected`, `archived` |
| `seniority` | `intern`, `entry`, `mid`, `senior`, `staff`, `principal`, `manager`, `director`, `executive`, `unknown` |
| `employmentType` | `full-time`, `contract`, `part-time`, `internship`, `fractional`, `unknown` |
| `workMode` | `remote`, `hybrid`, `on-site`, `unknown` |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `source` | string | `candidate`, `agent-research`, `referral`, or `manual`. |
| `location` | string | Role location text from the posting. |
| `compensation` | object | Published compensation range. |
| `seniority` | string | Normalized seniority. |
| `employmentType` | string | Normalized employment type. |
| `workMode` | string | Normalized work mode. |
| `rationale` | string | Why the seed role matters. |
| `keywords` | array | Extracted keywords. |
| `evidenceNeeded` | array | Missing evidence or follow-up needs. |
| `createdAt` | string | Creation date. |

### Example

```json
[
  {
    "id": "role-seed-001",
    "company": "Fabrikam AI",
    "title": "Senior product manager, developer experience",
    "status": "seed",
    "urls": {
      "job": "https://jobs.example.invalid/fabrikam/devex-pm",
      "apply": ""
    },
    "source": "candidate",
    "location": "Remote, United States",
    "seniority": "senior",
    "employmentType": "full-time",
    "workMode": "remote",
    "rationale": "Matches the candidate's developer platform and AI workflow interests.",
    "keywords": ["developer experience", "AI workflows", "platform strategy"],
    "evidenceNeeded": ["Confirm public examples of AI workflow demos."],
    "createdAt": "2026-06-08"
  }
]
```

## `roles.tracked.json`

`roles.tracked.json` stores accepted roles that drive resume generation, tracker rows, and follow-up actions. Keep it private by default because it can reveal active applications.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique tracked role ID. |
| `company` | string | Company or organization name. |
| `title` | string | Role title. |
| `status` | string | Application or tracking status. |
| `urls` | object | Posting and apply URLs, currently `job` and `apply`. |

### Useful enum values

| Field | Values |
| --- | --- |
| `status` | `interested`, `ready-to-apply`, `applied`, `interviewing`, `offer`, `rejected`, `declined`, `closed`, `archived` |
| `fit.level` | `strong`, `moderate`, `stretch`, `poor`, `unknown` |
| `resume.status` | `not-started`, `drafting`, `review-needed`, `ready`, `submitted`, `archived` |
| `nextAction.type` | `research`, `tailor-resume`, `candidate-review`, `apply`, `follow-up`, `close` |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `sourceSeedId` | string | Seed role ID that promoted this tracked role. |
| `posting` | object | Captured title, location, compensation, and posting date. |
| `application` | object | Applied date, referral contact label, and notes. |
| `fit` | object | Fit level, rationale, matched evidence, and gaps. |
| `resume` | object | Output path, status, and tailored emphasis. |
| `evidenceMap` | array | Role requirements mapped to evidence IDs. |
| `nextAction` | object | Next action type, owner, and due date. |
| `updatedAt` | string | Last update date. |

### Example

```json
[
  {
    "id": "role-tracked-001",
    "sourceSeedId": "role-seed-001",
    "company": "Fabrikam AI",
    "title": "Senior product manager, developer experience",
    "status": "tracked",
    "urls": {
      "job": "https://jobs.example.invalid/fabrikam/devex-pm",
      "apply": ""
    },
    "posting": {
      "location": "Remote, United States",
      "workMode": "remote",
      "compensation": {
        "currency": "USD",
        "minimum": 170000,
        "maximum": 220000
      }
    },
    "fit": {
      "level": "strong",
      "rationale": "The role emphasizes developer experience, platform strategy, and AI workflow adoption.",
      "matchedEvidenceIds": ["ev-001", "ev-002"],
      "gaps": ["Needs candidate confirmation for external AI demo usage."]
    },
    "resume": {
      "status": "review-needed",
      "outputPath": "outputs/resumes/alex-rivera-fabrikam-devex-pm.docx",
      "emphasis": ["developer platforms", "launch leadership", "AI workflow demos"]
    },
    "evidenceMap": [
      {
        "requirement": "Developer platform product experience",
        "evidenceIds": ["ev-001"],
        "coverage": "strong"
      }
    ],
    "nextAction": {
      "type": "candidate-review",
      "owner": "candidate",
      "dueDate": "2026-06-12"
    },
    "updatedAt": "2026-06-08"
  }
]
```

### Tracker generation

`outputs/tracker.md` is generated from `roles.tracked.json`; do not hand-edit tracker rows. Rebuild it with:

```bash
npm run workspace:tracker -- --workspace <workspace>
npm run workspace:validate -- --workspace <workspace>
```

An optional interactive HTML tracker (`outputs/tracker.html`) can be generated alongside the markdown tracker for a searchable, filterable view with summary stat cards. It reads from the same `roles.tracked.json` data and is safe to regenerate at any time; `validate` does not require it to exist.

```bash
npm run workspace:tracker -- --workspace <workspace> --format html
```

Pass `--title <text>` to override the page title, or `--output <file>` to change the destination path. By default the title uses `profile.json`'s `candidate.preferredName` (falling back to `candidate.name`) so the page is branded per-candidate without editing renderer code.

The tracker renderer reads the structured v1 fields first:

- `posting.location`
- `posting.compensation`
- `fit.level` and `fit.rationale`
- `application.appliedAt`, `application.appliedDate`, or `application.status`
- `resume.outputPath`
- `nextAction.type`, `nextAction.owner`, and `nextAction.dueDate`
- `notes[]` and `followUpQuestions[]`

The renderer also accepts the earlier flat fields (`location`, `compensation`, `fit`, `applied`, and `output.resume`) so existing tracked-role files can be regenerated without migration.

## `leads.json`

`leads.json` stores prospective roles discovered during search, before promotion to tracked roles. Leads are agent-maintained via the find-roles playbook and promote into `roles.tracked.json` via the `add-role --tracked` command.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | string | Must be `"1.0"`. |
| `leads` | array | Array of prospective role objects. |

### Per-lead required fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique lead ID, format `lead-NNN`. |
| `company` | string | Company or organization name. |
| `title` | string | Role title from the posting. |
| `url` | string | Direct link to the posting. |
| `source` | string | Where the lead was discovered (LinkedIn, Wellfound, company career page, etc.). |
| `discoveredAt` | string | ISO 8601 date when the lead was found. |

### Per-lead optional fields

| Field | Type | Description |
| --- | --- | --- |
| `fit` | object | Fit assessment with `level` and `rationale`. |
| `fit.level` | string | One of `strong`, `moderate`, or `stretch`. |
| `fit.rationale` | string | 1-2 sentence explanation of the fit. |
| `notes` | string | Agent notes for candidate review (recruiter contact, tech stack, standout projects, application deadlines). |
| `status` | string | Optional: `new`, `reviewed`, `accepted`, `rejected`, or `promoted`. |

### Example

```json
{
  "schemaVersion": "1.0",
  "leads": [
    {
      "id": "lead-001",
      "company": "Acme Corp",
      "title": "Senior Software Engineer",
      "url": "https://jobs.example.invalid/acme/senior-engineer",
      "source": "LinkedIn",
      "discoveredAt": "2026-07-19",
      "fit": {
        "level": "strong",
        "rationale": "Matches target seniority, remote work, and developer tools focus."
      },
      "notes": "Contact: recruiting@acme.com. Active project: AI debugging tools. Stack: Go, React, Kubernetes."
    },
    {
      "id": "lead-002",
      "company": "Northstar Tools",
      "title": "Product Manager, Developer Experience",
      "url": "https://jobs.example.invalid/northstar/pm-devex",
      "source": "Wellfound",
      "discoveredAt": "2026-07-19",
      "fit": {
        "level": "moderate",
        "rationale": "Good industry fit and fully remote, but early-stage startup vs. preferred growth-stage company."
      },
      "notes": "Series B funding. Open to contracting. Application deadline: 2026-08-02."
    }
  ]
}
```

### Promoting a lead to tracked role

Once the candidate reviews a lead and approves it, promote it using the `add-role` command with the `--tracked` flag:

```bash
npm run workspace:add-role -- --workspace <workspace> --url <posting-url> --tracked
```

This command:
1. Adds the role to `roles.tracked.json` with an initial `interested` status
2. Creates a corresponding entry in the tracker
3. Prepares the role for resume tailoring and application tracking

**Example:**

```bash
npm run workspace:add-role -- --workspace candidate --url "https://jobs.example.invalid/acme/senior-engineer" --tracked
```

After promotion, you can optionally remove or archive the lead from `leads.json`, or keep it as a historical record.

## Similar-role candidate files

Similar-role discovery can score an optional local JSON array of manually researched roles. This file is an input to `find-similar`; it is not tracked by default, and it is not added to `roles.tracked.json` automatically.

Run:

```bash
npm run workspace:similar -- --workspace <workspace> --candidates <candidate-roles.json>
```

### Candidate role fields

| Field | Type | Description |
| --- | --- | --- |
| `company` | string | Company or organization name. |
| `title` | string | Role title from the posting. |
| `urls.job` | string | Source posting URL. Required before tracking. |
| `location` | string | Posting location text. |
| `seniority` | string | Normalized seniority when known. |
| `employmentType` | string | Normalized employment type when known. |
| `workMode` | string | `remote`, `hybrid`, `on-site`, `flexible`, or `unknown`. |
| `description` | string | Short posting summary or safe extracted requirements. |
| `keywords` | array | Normalized keywords from the posting. |
| `compensation` | object | Published compensation range when available. |

### Example

```json
[
  {
    "company": "Northstar Tools",
    "title": "Senior product manager, AI developer workflows",
    "location": "Remote, United States",
    "seniority": "senior",
    "employmentType": "full-time",
    "workMode": "remote",
    "urls": {
      "job": "https://jobs.example.invalid/northstar/ai-dev-workflows"
    },
    "description": "Owns AI-assisted developer workflow strategy, platform adoption, and launch readiness.",
    "keywords": ["AI workflows", "developer experience", "platform strategy"],
    "compensation": {
      "currency": "USD",
      "minimum": 175000,
      "maximum": 225000
    }
  }
]
```

### Review-before-tracking rule

`outputs/similar-roles.md` is a review queue, not an application tracker. Do not promote a similar role until the candidate reviews:

- The source posting and duplicate check.
- The fit score, rationale, and risks.
- Evidence gaps and follow-up questions.
- Compensation, location, work mode, and deal breakers.
- The suggested resume strategy.

After approval, add the role to `roles.tracked.json` with `add-role --tracked` and rebuild `outputs/tracker.md`.

## `claim-policy.json`

`claim-policy.json` stores candidate-specific claim rules. Use it to block sensitive claims, require review for low-confidence claims, and control wording.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | string | Must be `"1.0"`. |
| `defaultMinimumConfidence` | string | Minimum evidence confidence for generated claims. |
| `rules` | array | Claim handling rules. |
| `reviewRequiredFor` | array | Conditions that require candidate review. |

### Useful enum values

| Field | Values |
| --- | --- |
| `defaultMinimumConfidence` | `high`, `medium`, `low` |
| `rules[].action` | `allow`, `caution`, `block`, `needs-review` |
| `rules[].appliesTo.category` | Evidence categories from `evidence.jsonl` |
| `reviewRequiredFor[]` | `low-confidence`, `metrics`, `employment-dates`, `compensation`, `work-authorization`, `security-clearance`, `sensitive-client`, `public-use` |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `style` | object | Voice, tense, metric, and wording preferences. |
| `blockedPhrases` | array | Exact phrases or patterns to avoid. |
| `approvedPhrases` | array | Candidate-approved wording. |
| `metricPolicy` | object | Rules for ranges, approximations, and unverified numbers. |
| `exceptions` | array | Evidence-specific overrides. |
| `updatedAt` | string | Last update date. |

### Example

```json
{
  "schemaVersion": "1.0",
  "defaultMinimumConfidence": "medium",
  "style": {
    "voice": "direct",
    "metricWording": "use-exact-only-when-evidenced",
    "avoidFirstPerson": true
  },
  "rules": [
    {
      "id": "policy-001",
      "action": "block",
      "appliesTo": {
        "category": "metric"
      },
      "reason": "Do not invent or estimate metrics without source evidence."
    },
    {
      "id": "policy-002",
      "action": "needs-review",
      "appliesTo": {
        "confidence": "low"
      },
      "reason": "Low-confidence claims need candidate confirmation before use."
    }
  ],
  "reviewRequiredFor": ["low-confidence", "metrics", "sensitive-client"],
  "blockedPhrases": [
    {
      "pattern": "managed a multimillion-dollar budget",
      "reason": "Candidate has not confirmed budget ownership."
    }
  ],
  "approvedPhrases": [
    {
      "text": "coordinated launch readiness across engineering, product, and customer-facing teams",
      "evidenceIds": ["ev-001"]
    }
  ],
  "metricPolicy": {
    "allowApproximateMetrics": false,
    "allowRanges": true,
    "requiresEvidenceCategory": "metric"
  },
  "updatedAt": "2026-06-08"
}
```

## Validator alignment

`scripts/check-workspace.js` currently validates the workspace files needed before generation:

- `profile.json` must exist and be a JSON object.
- `preferences.json` must exist and be a JSON object.
- `roles.seed.json` must exist and be a JSON array.
- `roles.tracked.json` must exist and be a JSON array.
- Each seed and tracked role must include non-empty `company`, `title` or `role`, and `status` strings.
- Each seed and tracked role must include `urls` as an object.
- `evidence.jsonl` is optional, but each non-empty line must pass the evidence validation rules above.
- If `outputs/tracker.md` exists, its role count must match `roles.tracked.json`.

The schemas above preserve those required fields. For the target layout in `docs/candidate-workspace.md`, run the validator against the directory that contains the JSON files:

```bash
node scripts/check-workspace.js --workspace path/to/candidate
```

## Proposed validator checks

The validator is intentionally lightweight today. These low-risk v1 checks would make it match the schemas without changing the file layout:

1. Require `claim-policy.json` and confirm it is a JSON object.
2. Require `schemaVersion: "1.0"` in every JSON file.
3. Validate enum values for evidence category, seed role status, tracked role status, work modes, employment types, and claim policy actions.
4. Require unique IDs in `roles.seed.json` and `roles.tracked.json`.
5. Confirm every role URL is a string and flag duplicate URLs across seed and tracked roles.
6. Confirm evidence references from profile, tracked roles, and claim policy exceptions point to existing evidence IDs.
7. Warn when examples under `examples/sample-candidate/` use non-fictional domains outside `example.invalid`, `example.com`, `example.org`, or `example.net`.

## Related pages

- [Candidate workspace](candidate-workspace.md)
- [Modular architecture](modular-architecture.md)
- [Accuracy and claims](accuracy-and-claims.md)
