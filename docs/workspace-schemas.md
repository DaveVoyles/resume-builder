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

### `locations` fields

| Field | Type | Description |
| --- | --- | --- |
| `workModes` | array | Acceptable work modes — see enum values above. |
| `preferredRegions` | array | Preferred locations, ordered by priority: the first entry is the most preferred region, and each later entry is progressively less preferred. Use `[]` if flexible. |
| `excludedRegions` | array | Locations to exclude. A flat set with no ranking — every entry is an equal deal-breaker, so order doesn't matter. Use `[]` if none. |
| `priority` | string | How strongly `locations` overall should weigh in role fit — one of `must`, `should`, `could` (see enum values above). |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `industries` | array | Preferred, neutral, or avoided industries. |
| `companyStages` | array | Startup, growth, enterprise, nonprofit, or public-sector preferences. |
| `technologies` | array | Technologies to highlight or avoid. |
| `compensation` | object | Candidate-provided range and currency — see [`compensation` fields](#compensation-fields) below. |
| `availability` | object | Start date, notice period, and interview windows. |
| `resumeStyle` | object | Tone, length, and emphasis preferences. |
| `stalenessThresholds` | object | Overrides the tracker's per-status-bucket stale-flag day thresholds (see [Staleness computation](#staleness-computation) under `roles.tracked.json`). Any subset of `not-applied`, `applied`, `interview`, `offer`, `other`; omitted keys keep the built-in default. |
| `notes` | string | Candidate-approved notes for agents. |

### `compensation` fields

| Field | Type | Description |
| --- | --- | --- |
| `currency` | string | Currency code, e.g. `"USD"`. |
| `baseMinimum` | number | Minimum acceptable **base salary**, excluding bonus and equity. |
| `totalMinimum` | number | Minimum acceptable **total compensation** (base + bonus + equity). Use this instead of `baseMinimum` when the candidate frames their floor in total-comp terms rather than base-only terms — don't misuse `baseMinimum` as a stand-in for a total-comp floor. |
| `totalTarget` | number | Target total compensation, or omit if not discussed. |
| `publiclyShare` | boolean | Whether the candidate allows this range to be shared publicly. |

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
    "totalMinimum": 190000,
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
| `type` | string | Ingestion type, such as `resume`, `notes`, `links`, `source`, or `github_profile`. |
| `fact` | string | Concise fact that can support a claim. |
| `summary` | string | Human-readable ingestion summary. |
| `source` | object | Source descriptor. It must include `kind` and either `path` or `url` — except `kind: "intake"`, which is exempt from the `path`/`url` requirement (see below). |
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
- `source` has neither `path` nor `url` — unless `source.kind` is `"intake"` (a candidate's own conversational statement during grill intake has no file or URL to point to; see [`grill.md`](playbooks/grill.md)'s evidence-source example).
- Source-backed evidence has no `snippet` or `quote`.
- `metadata-only` evidence tries to state a separate fact instead of matching `summary`.

## `.onboarding-state.json`

`.onboarding-state.json` tracks onboarding progress as an explicit marker file (design plan 0006 D1) rather than inferring it from `profile.json`/`preferences.json`'s own shape — `compensation` is an optional `preferences.json` field, and an empty `dealBreakers` array is a valid *complete* answer ("no deal breakers"), not "not asked yet," so data shape alone can't tell those apart. `npm run setup` creates it with every step pending except `setupComplete`; [`grill.md`](playbooks/grill.md) flips each `sections.<name>` key as its section is confirmed; `ingest` flips `materialIngested`; `tailor` flips `firstRoleAdded` once the first role is tracked. `build-tracker`/`init` pass it to the HTML tracker renderer (design plan 0006 D5), which shows it as a visual checklist in place of the roles table while onboarding is incomplete, collapsing to a small completion pill once it's done. It's optional — a workspace created before this feature existed validates fine without it.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | string | Must be `"1.0"`. |
| `setupComplete` | boolean | Always `true` from the moment `npm run setup` creates the file. |
| `materialIngested` | boolean | Set once `ingest` runs with at least one real source. |
| `sections` | object | One boolean per `grill.md` section — see below. |
| `firstRoleAdded` | boolean | Set once the first role lands in `roles.tracked.json`. |

### `sections` fields

| Field | Type | Description |
| --- | --- | --- |
| `basicInfo` | boolean | grill.md Section 1: Basic information. |
| `workHistory` | boolean | grill.md Section 2: Work history. |
| `education` | boolean | grill.md Section 3: Education. |
| `targetRole` | boolean | grill.md Section 4: Target role. |
| `location` | boolean | grill.md Section 5: Location and work mode. |
| `compensation` | boolean | grill.md Section 6: Salary and compensation. |
| `dealBreakers` | boolean | grill.md Section 7: Constraints and deal breakers. |

### Example

```json
{
  "schemaVersion": "1.0",
  "setupComplete": true,
  "materialIngested": true,
  "sections": {
    "basicInfo": true,
    "workHistory": true,
    "education": false,
    "targetRole": false,
    "location": false,
    "compensation": false,
    "dealBreakers": false
  },
  "firstRoleAdded": false
}
```

### Validation rules

The validator flags the onboarding state, when present, before output when:

- The entry is not an object.
- `setupComplete`, `materialIngested`, or `firstRoleAdded` is missing or not a boolean.
- `sections` is missing, not an object, or any of its 7 keys is missing or not a boolean.

## `feedback.jsonl`

`feedback.jsonl` is a JSON Lines ledger. Each non-empty line must be a standalone JSON object. The debrief playbook writes `schemaVersion`, `id`, `context`, `question`, `answer`, `sentiment`, `sentimentNote`, `proposedAnswer`, and `createdAt`. This ledger is private by default and stays separate from the evidence ledger.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | string | Must be `"1.0"`. |
| `id` | string | Unique feedback ID. |
| `context` | string | Where this Q&A occurred: `grill`, `interview`, `study-guide`, or `tailor`. |
| `question` | string | The question asked, exact or reconstructed. |
| `answer` | string | The answer given, exact or reconstructed. |
| `sentiment` | string | How the candidate felt about the answer. |
| `proposedAnswer` | string | An improved answer for next time. |
| `createdAt` | string | Creation timestamp. |

### Useful enum values

| Field | Values |
| --- | --- |
| `context` | `grill`, `interview`, `study-guide`, `tailor` |
| `sentiment` | `confident`, `neutral`, `unsure`, `poor` |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `relatedRoleId` | string | Links to a `roles.tracked.json` role id for context. |
| `sentimentNote` | string | Free-text note about why the candidate felt a certain way. |

### Example

```jsonl
{"schemaVersion":"1.0","id":"fb-001","context":"interview","relatedRoleId":"role-tracked-001","question":"Tell me about your experience with system design.","answer":"I talked about a project I led, but I didn't go deep enough into trade-offs.","sentiment":"neutral","sentimentNote":"Felt rushed. Interviewer seemed interested but I cut it short.","proposedAnswer":"I would start by asking clarifying questions about scale and constraints, then walk through the architecture decisions I'd make, explicitly naming trade-offs at each step.","createdAt":"2026-07-20T14:30:00.000Z"}
```

### Validation rules

The validator flags feedback before output when:

- The entry is not an object.
- Any required field is missing or blank.
- A duplicate `id` appears.
- `context` is not one of the allowed enum values.
- `sentiment` is not one of the allowed enum values.

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
| `status` | string | List membership: `seed` or `tracked` (set by `add-role`; not an application-progress field — see `application.status` below). |
| `urls` | object | Posting and apply URLs, currently `job` and `apply`. |

### Useful enum values

| Field | Values |
| --- | --- |
| `status` | `seed`, `tracked` |
| `application.status` | `interested`, `applied`, `interview`, `offer`, `rejected`, `withdrawn`, `ghosted` (set via the `set-status` CLI command; deterministic, replaces free-text status strings). `ghosted` is a terminal status for a role whose employer went silent — set manually only; staleness detection (below) may suggest it, but no code path auto-transitions to it. |
| `fit.level` | `strong`, `moderate`, `stretch`, `poor`, `unknown` |
| `resume.status` | `not-started`, `drafting`, `review-needed`, `ready`, `submitted`, `archived` |
| `nextAction.type` | `research`, `tailor-resume`, `candidate-review`, `apply`, `follow-up`, `close` |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `sourceSeedId` | string | Seed role ID that promoted this tracked role. |
| `posting` | object | Captured title, location, compensation, and posting date. |
| `application` | object | `status` (enum above, set by `set-status`), `appliedAt` (date the candidate applied — preserved across later status transitions unless explicitly overridden), referral contact label, and notes. |
| `fit` | object | Fit level, rationale, matched evidence, and gaps. |
| `resume` | object | `outputPath` (rendered DOCX path), `configPath` (the resume-config JSON this role was tailored from, set by `tailor` — see below), `status`, and tailored emphasis. |
| `coverLetter` | object | `configPath` (the cover-letter-config JSON, relative to the workspace), `outputPath` (rendered DOCX path), and `status` — set by `tailor --cover-letter` or standalone `render-cover-letter` (see [Cover letter render config](#cover-letter-render-config-render-cover-letter)). Absent when no cover letter has been generated for this role. |
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

### Auto-generating `nextAction` on status transitions

The `set-status` CLI command automatically sets `nextAction` when a role's application status transitions, following this rule table:

| New `application.status` | `nextAction.type` | `nextAction.dueDate` | `notes` entry appended |
|---|---|---|---|
| `applied` | `follow-up` | Due in 7 days (from the status transition date) | "check in if no response" |
| `interview` | `follow-up` | Due in 1 day | "send thank-you" |
| `offer` | `follow-up` | Due in 2 days | "respond to offer" |
| `rejected` | `close` | — (no dueDate for close) | — (no note) |
| `withdrawn` | `close` | — (no dueDate for close) | — (no note) |
| `ghosted` | `close` | — (no dueDate for close) | "follow up or consider moving on" |
| `interested` | (unchanged) | — (leave `nextAction` untouched) | — (no note) |

### Staleness computation

Rendering the tracker (`build-tracker`, either format) computes a **stale flag** for every
tracked role, purely at render time — nothing is written back to `roles.tracked.json` or any
other state file. A role is stale when its last-touch date (`application.appliedAt`, or
`updatedAt` if more recent) is at or past its status bucket's day threshold. Terminal statuses
(`rejected`, `withdrawn`, `ghosted`) are always exempt — they're already closed out, so staleness
has nothing left to flag.

Default thresholds (days since last touch), defined in `src/core/staleness.js`:

| Status bucket | Default threshold | Suggested action when stale |
| --- | --- | --- |
| `not-applied` | 30 days | Consider applying if interested |
| `applied` | 14 days | Follow up on application status |
| `interview` | 7 days | Follow up on interview process |
| `offer` | 3 days | Respond to offer or clarify timeline |
| `other` | 21 days | Follow up or clarify next steps |

Override any threshold via an optional `stalenessThresholds` object in `preferences.json` (see
below) — only the keys you set are overridden, the rest fall back to the defaults above.

Each stale role's computed data (`isStale`, `daysSinceTouch`, `suggestedNextAction`) appears in
both tracker renderers: a "Stale" column in the markdown tracker, and a sortable/filterable
"Stale" badge column plus a pipeline funnel section (counts per active stage and terminal
outcome, including `ghosted`) in the HTML tracker.

Each status transition always **overwrites** any existing `nextAction` (except when transitioning to `interested`, which leaves `nextAction` completely untouched). The `dueDate` is computed as an ISO 8601 date relative to the date the status was set (using the `--date` override if provided, or today's date otherwise). The `owner` is always set to `"candidate"` for auto-generated follow-ups.

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

## `contacts.json`

`contacts.json` stores the candidate's professional network — referrals, former colleagues, recruiters, and informational-interview contacts — tracked independently of any specific role. A contact can exist before, during, or after a role's lifecycle; it's optionally linked to one or more tracked roles, never owned by one. See the [contacts playbook](playbooks/contacts.md) for the full agent workflow (`add-contact` → `set-contact-status` → `build-contacts-tracker`).

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Unique contact ID. |
| `name` | string | Contact's full name. |
| `relationship` | string | Enum — see below. |
| `linkedRoleIds` | array | Tracked-role IDs this contact relates to. Empty array allowed — a contact isn't required to link to a role. |
| `status` | string | Enum — see below. |
| `notes` | array | Free-text notes, non-empty strings. Empty array allowed. |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `company` | string | Contact's company or organization. |
| `contactMethod` | string | How to reach them (email, LinkedIn, etc.). |
| `nextAction` | object | Auto-generated by `set-contact-status` — see below. Absent for a freshly-added contact (`identified` status). |

### Useful enum values

| Field | Values |
| --- | --- |
| `relationship` | `referral`, `former-colleague`, `recruiter`, `informational-interview`, `other` |
| `status` | `identified`, `reached-out`, `responded`, `meeting-scheduled`, `met`, `referred`, `no-response`, `dormant` (set via `set-contact-status`) |
| `nextAction.type` | `follow-up`, `close` |

### Example

```json
[
  {
    "id": "contact-001",
    "name": "Jordan Kim",
    "company": "Northwind Tools",
    "relationship": "referral",
    "contactMethod": "LinkedIn",
    "linkedRoleIds": ["role-tracked-001"],
    "status": "responded",
    "notes": ["Former teammate from Contoso Labs; offered to refer for the DevEx PM role."],
    "nextAction": {
      "type": "follow-up",
      "dueDate": "2026-06-11"
    }
  }
]
```

### Auto-generating `nextAction` on status transitions

The `set-contact-status` CLI command automatically sets `nextAction` when a contact's status transitions, mirroring [`roles.tracked.json`'s nextAction rule table](#auto-generating-nextaction-on-status-transitions) above — same mechanism (`src/core/role-view.js`'s pattern), reused verbatim for contacts rather than reinvented:

| New `status` | `nextAction.type` | `nextAction.dueDate` | `notes` entry appended |
|---|---|---|---|
| `reached-out` | `follow-up` | Due in 7 days | "check in if no response" |
| `responded` | `follow-up` | Due in 3 days | "schedule a call or meeting" |
| `meeting-scheduled` | `follow-up` | Due in 1 day | "send thank-you" |
| `met` | `follow-up` | Due in 2 days | "send thank-you and follow up on next steps" |
| `referred` | `follow-up` | Due in 3 days | "check in on referral outcome" |
| `no-response` | `close` | — (no dueDate for close) | — (no note) |
| `dormant` | `close` | — (no dueDate for close) | — (no note) |
| `identified` | (unchanged) | — (leave `nextAction` untouched) | — (no note) |

### Contacts tracker

`build-contacts-tracker --workspace <workspace> [--format md|html]` renders `outputs/contacts.md` (default) or `outputs/contacts.html` from `contacts.json`, sorted by `nextAction.dueDate` ascending — contacts with no pending follow-up sort last. A separate view from the role tracker (`build-tracker`); a contact isn't a role.

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

## Resume render config (`render-resume`)

A resume render config is a schema-validated JSON file an agent (or human) authors per role and passes to `render-resume`. It is fully self-contained — candidate name, contact, education, publications, and speaking are all config fields, not engine constants — so the DOCX rendering engine (`src/renderers/docx-resume.js`, `src/renderers/docx-helpers.js`) carries no candidate-specific data of its own. Validated by `src/core/resume-config.js`.

Store per-role render configs under `<workspace>/resume-configs/<role-slug>.json`. Keep real candidate render configs private by default (see Privacy defaults in [candidate workspace](candidate-workspace.md)); only fictional sample configs are committed.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | string | Must be `"1.0"`. |
| `company` | string | Company or organization name. Becomes the literal directory name under `outputs/resumes/<Company>/`. |
| `candidate` | object | Candidate identity used for the rendered header. |
| `candidate.name` | string | Full name printed at the top of the résumé. |
| `candidate.contact` | array | Non-empty array of `{ text, link? }` entries rendered as the contact line. |
| `summary` | object | `{ text: string, fitOverride?: string\|null }`. |
| `experienceSections` | array | Non-empty array of `{ heading, jobs }`; each job requires non-empty `title`, `company`, `dates`, and a non-empty `bullets` array of strings. `subHeader` is optional. |
| `skills` | array | Non-empty array of `[label, value]` string pairs. |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `outputFileName` | string | File name written under `outputs/resumes/<Company>/`. Defaults to `<slug(candidate.name)>-<slug(company)>.docx`. |
| `summary.fitOverride` | string\|null | Replaces the summary's trailing "Strong/Exceptional fit for..." sentence with role-specific wording, or appends it if none is found. |
| `education` | array | `{ degree, institution, dates, details? }` entries. Only rendered when `includeEducation` is not `false` and this array is non-empty. |
| `publications` | array | `{ title, publisher, dates, details? }` entries. |
| `speaking` | array | `{ heading, organizations, dates, details? }` entries. |
| `includeEducation` | boolean | Default `true`. |
| `includePublicationsSpeaking` | boolean | Default `true`. |
| `publicationsSpeakingLayout` | string | `combined` (default), `speaking-then-publications`, `combined-speaking-only`, or `publications-only` — mirrors the ported engine's layout options for the "Publications & Speaking" heading when both arrays are present. |

### Example (fictional)

```json
{
  "schemaVersion": "1.0",
  "company": "Northwind Tools",
  "outputFileName": "alex-rivera-northwind-ai-workflows.docx",
  "candidate": {
    "name": "Alex Rivera",
    "contact": [
      { "text": "Raleigh, NC" },
      { "text": "alex.rivera@example.invalid", "link": "mailto:alex.rivera@example.invalid" }
    ]
  },
  "summary": {
    "text": "Fictional product and program leader focused on developer platforms and AI-assisted workflows.",
    "fitOverride": "Exceptional fit for Northwind Tools' developer-experience roadmap."
  },
  "experienceSections": [
    {
      "heading": "Experience",
      "jobs": [
        {
          "title": "Senior Platform Program Manager",
          "company": "Contoso Labs",
          "dates": "2022 - Present",
          "bullets": ["Led launch coordination for an internal developer platform used by multiple product teams."]
        }
      ]
    }
  ],
  "skills": [["Developer platforms", "Platform strategy, internal tooling, developer experience"]],
  "includePublicationsSpeaking": false
}
```

Render it with:

```bash
npm run workspace:render -- --workspace <workspace> --config <workspace>/resume-configs/<role-slug>.json
```

This writes `outputs/resumes/<Company>/<file>.docx` and throws a validation error (no file written) if the config fails schema validation. The full fictional sample lives at `examples/sample-candidate/resume-configs/northwind-tools-senior-pm.json` and renders as part of `npm run sample:quickstart`.

`render-resume` only checks schema validity. Before treating a config as ready to send, run `validate` (`npm run workspace:validate -- --workspace <workspace>`) — it additionally runs the evidence-backed claim audit against every config under `resume-configs/`, blocking on any metric claim (a percentage, dollar amount, count, team size, or years of experience) with no supporting `evidence.jsonl` entry. See [Accuracy and claims](accuracy-and-claims.md#evidence-backed-claim-audit-blocking).

## Cover letter render config (`render-cover-letter`)

A cover-letter render config is a schema-validated JSON file, structurally simpler than a resume config since it's just company/candidate identity plus salutation, body paragraphs, and a closing. Validated by `src/core/cover-letter-config.js`; rendered by `src/renderers/docx-cover-letter.js`.

Store per-role cover-letter configs under `<workspace>/cover-letter-configs/<role-slug>.json`. Keep real candidate configs private by default, same as resume configs.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `company` | string | Company or organization name. Becomes the literal directory name under `outputs/cover-letters/<Company>/`. |
| `candidate` | object | Candidate identity used for the letterhead. |
| `candidate.name` | string | Full name. |
| `candidate.contact` | array | Non-empty array of `{ text, link? }` entries, same shape as the resume config's contact line. |
| `salutation` | string | e.g. `"Dear Hiring Manager,"`. |
| `bodyParagraphs` | array | Non-empty array of non-empty paragraph strings. |
| `closing` | string | e.g. `"Sincerely,"`. |

### Optional fields

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | string | Must be `"1.0"` when present. |
| `outputFileName` | string | File name written under `outputs/cover-letters/<Company>/`. Defaults to `<slug(candidate.name)>-<slug(company)>-cover-letter.docx`. |

### Example (fictional)

```json
{
  "schemaVersion": "1.0",
  "company": "Northwind Tools",
  "candidate": {
    "name": "Alex Rivera",
    "contact": [
      { "text": "Raleigh, NC" },
      { "text": "alex.rivera@example.invalid", "link": "mailto:alex.rivera@example.invalid" }
    ]
  },
  "salutation": "Dear Hiring Manager,",
  "bodyParagraphs": [
    "I'm writing to express my interest in the Senior Product Manager role at Northwind Tools. Your focus on AI-assisted developer workflows aligns closely with the platform work I've led over the past three years.",
    "At Contoso Labs, I led launch coordination for an internal developer platform used across multiple product teams — the kind of cross-functional, high-stakes rollout your posting describes.",
    "I'd welcome the chance to talk through how that experience translates to Northwind Tools' roadmap."
  ],
  "closing": "Sincerely,"
}
```

Render it on its own with:

```bash
npm run workspace:render-cover-letter -- --workspace <workspace> --config <workspace>/cover-letter-configs/<role-slug>.json
```

...or together with a resume in one pass via `tailor --cover-letter <config>` — see [`cover-letter.md`](playbooks/cover-letter.md). Either path writes `outputs/cover-letters/<Company>/<file>.docx` and runs the same evidence-backed claim audit as the resume path (`auditCoverLetterConfig` in `src/core/claim-audit.js`), blocking on any unsupported metric claim in the body paragraphs. Unlike the resume path, this audit is enforced only at render time (`render-cover-letter`/`tailor --cover-letter`) — the standalone `validate` command's claim-audit sweep currently scans `resume-configs/` only, not `cover-letter-configs/`. See [Accuracy and claims](accuracy-and-claims.md#evidence-backed-claim-audit-blocking).

## Tailor workflow (`tailor`)

`tailor` (design plan 0001, D4) composes `render-resume`'s schema validation, the evidence-backed claim audit (D3), DOCX rendering (D2), and `add-role`/`set-status` (D6/D7) into one command: point it at a drafted resume config and job-posting details, and it validates, audits, renders, and registers a tracked role in a single pass. See [`docs/playbooks/tailor.md`](playbooks/tailor.md) for the full agent workflow.

```bash
npm run workspace:tailor -- --workspace <workspace> \
  --config <workspace>/resume-configs/<role-slug>.json \
  --url <job-posting-url> \
  --title <role-title>
```

`--company` is optional and defaults to the resume config's own `company` field (an explicit `--company` that disagrees with the config's `company` is a hard error, not a silent mismatch). `--applyUrl`, `--location`, `--compensation`, `--fit`, and `--notes` behave the same as they do for `add-role`. `--cover-letter <cover-letter-config.json>` is optional — see [`cover-letter.md`](playbooks/cover-letter.md).

`tailor` always:

1. Validates the config against the resume-config schema above (`src/core/resume-config.js`) — blocking, with an itemized error.
2. Runs the evidence-backed claim audit (`src/core/claim-audit.js`) against the config and `evidence.jsonl` — blocking on any unsupported claim, non-blocking-warns on a thin ledger.
3. Runs the [de-AI style lint](style-lint.md) against the resume text — advisory only, never blocks.
4. Renders the DOCX via `render-resume`'s own command.
5. If `--cover-letter` was passed: validates and audits the cover-letter config the same way (blocking on an unsupported claim), lints its text, renders its DOCX, and sets `role.coverLetter.configPath`/`outputPath`/`status` (`review-needed`) on the tracked role.
6. Registers (or finds the existing) tracked role via `add-role`'s own command, then sets `resume.configPath` and `resume.outputPath` on it (relative to the workspace root) so the role carries an explicit link back to the exact config and DOCX it was tailored from — this is also what `study-guide-bundle` (D8) now prefers over its content-matching fallback, when the link is present.
7. Sets `application.status` to `interested` — the D7 enum's not-yet-applied value (buckets to `not-applied` in the tracker) — via `set-status`, unless the role already has a real `application.status` (a re-run never reverts genuine progress), and rebuilds the tracker.

## Study guide bundle (`study-guide-bundle`)

`study-guide-bundle` gathers everything relevant to a tracked role into one context file so an agent can write an interview study guide from it, without re-reading four separate workspace files. See [`docs/playbooks/study-guide.md`](playbooks/study-guide.md) for the full agent workflow.

```bash
npm run workspace:bundle -- --workspace <workspace> --company "<name>" --title "<title>"
# or: npm run workspace:bundle -- --workspace <workspace> --id <role-id>
```

It writes `outputs/study-guide-bundles/<role-id>.json` (`src/cli/commands/study-guide-bundle.js`) with this shape:

| Field | Type | Description |
| --- | --- | --- |
| `role` | object | The full matched entry from `roles.tracked.json`. |
| `profile` | object | The candidate's `profile.json`, verbatim. |
| `evidence` | array | Every entry from `evidence.jsonl`, verbatim. |
| `resumeConfig` | object | The resume render config tailored for this role — resolved via the role's `resume.configPath` link when `tailor` set one, falling back to a company-name content match against `resume-configs/` otherwise. |
| `jobPosting` | object | `{ url, applyUrl }`, read from the role's `urls.job` / `urls.apply` (either may be `null`). |
| `generatedAt` | string | ISO 8601 timestamp of when the bundle was written. |

The command fails loud rather than guessing: no matching tracked role, no resume config for that role's company, or more than one config matching the same company name are all hard errors naming the ambiguity, not a silent best-effort bundle.

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

## Keyword list input (`score-keywords`)

A keyword list is a plain JSON array of strings — the required/preferred skills and technologies an agent extracts from a job posting by reading it. **The CLI never fetches or parses posting text itself**; there is no scraper or keyword extractor anywhere in this codebase. `score-keywords --config <resume-config.json> --keywords <keywords.json>` (and `tailor`'s `--keywords` flag, which runs the same scoring inline — see [`tailor.md`](playbooks/tailor.md#step-31a-keyword-coverage-advisory---keywords)) case-insensitive substring-matches each keyword against the resume config's `summary.text`, job `bullets`, and `skills` entries (both the name and the description of each `[name, description]` pair), and reports which are present vs. missing. Advisory only — never blocks, never persisted to a role or the tracker.

### Shape

A flat array of non-empty strings. No wrapper object, no `schemaVersion` — this is the simplest input shape in the workspace.

### Example

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

### Related

Missing keywords from this scoring step are the natural input to the [gap-classification workflow](#gap-classification-input-gap-report) below — see the [gap-analysis playbook](playbooks/gap-analysis.md) for the full walkthrough from score-keywords through a rendered gap report.

## Gap-classification input (`gap-report`)

A gap-classification file is a JSON array used as input to the `gap-report` command. It organizes missing keywords from a job posting into four gap types, each with a rationale and recommended action. The `gap-report` command renders this classification into a markdown report.

### Required fields

| Field | Type | Description |
| --- | --- | --- |
| `keyword` | string | The missing keyword or skill from the job posting. |
| `type` | string | Classification type: one of `PresentationGap`, `WeakEvidence`, `AdjacentSkill`, `TrueGap`. |
| `rationale` | string | One-line explanation of the classification. Reference evidence IDs or resume sections where relevant. |
| `recommendedAction` | string | What the candidate should do about this gap (e.g., update resume, deepen evidence, learn the skill). |

### Field descriptions

**Gap types:**

- `PresentationGap`: The skill exists in the candidate's resume or evidence but isn't phrased or positioned to match the posting's keyword. Recommended action: rephrase in the next resume revision.
- `WeakEvidence`: The skill is mentioned lightly in the resume or evidence (one brief mention, no depth). Recommended action: deepen with a real project, or remove the skill to avoid follow-up questions.
- `AdjacentSkill`: A related or transferable skill exists, but not the exact keyword. Recommended action: highlight the related skill and prepare to explain the transfer.
- `TrueGap`: The skill is genuinely absent with no related experience. Recommended action: learn the skill before applying, or skip the role if it's a blocker.

### Example

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

### Validation rules

The `gap-report` command validates input and rejects files that:

- Do not contain a JSON array.
- Contain objects missing any of the four required fields.
- Contain a `type` value other than the four allowed types.
- Contain empty or whitespace-only strings for `keyword`, `rationale`, or `recommendedAction`.

Invalid classifications fail with an itemized error message before `gap-report` renders anything.

---

## Related pages

- [Candidate workspace](candidate-workspace.md)
- [Modular architecture](modular-architecture.md)
- [Accuracy and claims](accuracy-and-claims.md)
