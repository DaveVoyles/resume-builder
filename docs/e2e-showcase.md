# 🧪 End-to-end showcase & playbook regression pass

This page is the receipt for design plan [0001](design/0001-feature-parity-agent-first.md)'s
final slice (D9): every playbook in [`docs/playbooks/`](playbooks/) run against the fictional
sample candidate, with real command output captured below — not paraphrased. It doubles as the
regression pass over D4–D8 the plan calls for.

Everything on this page is fictional. **Alex Rivera**, **Northwind Tools**, and **Fabrikam AI**
do not exist; `.invalid` domains are used throughout so nothing here resolves to a real site.

For the lifecycle diagram, see the "The lifecycle" section of the [README](../README.md). This page is the
step-by-step evidence that each stage actually works.

## How this was run

Four things below are real, captured verbatim from this repo at the commit that shipped this
page:

1. `npm start` (`scripts/sample-quickstart.js`) — runs the tracker, similar-role review, and a
   DOCX render directly against the committed `examples/sample-candidate/` fixtures, then
   exercises `tailor`, `set-status`, and `study-guide-bundle` in a disposable copy of that
   workspace so the committed fixtures never change.
2. A one-off `find-roles` promotion (leads → `add-role --tracked`), run the same way — a
   disposable copy, not the committed fixtures.
3. `npm test` (114 tests) and `npm run validate`.
4. The archify-generated lifecycle diagram and two screenshots (tracker HTML, rendered DOCX).

None of this touched `examples/sample-candidate/roles.tracked.json`,
`examples/sample-candidate/resume-configs/`, or any other committed fixture — the sample
workspace's committed data stays limited to what's already checked in, per
[`docs/playbooks/tailor.md`](playbooks/tailor.md)'s own note on the sample walkthrough.

---

## 1. Grill intake — [`docs/playbooks/grill.md`](playbooks/grill.md)

`examples/sample-candidate/profile.json`, `preferences.json`, and `evidence.jsonl` are
themselves the output of a grill-shaped intake for the fictional Alex Rivera — one work history
entry, one project, two evidence entries, and a full preferences file (role targets, location,
compensation, deal breakers).

A complete, narrated example of the interview itself (a different fictional candidate, Jordan
Park, to keep the two sample data sets clearly separate) already exists at
[`docs/playbooks/grill-sample-transcript.md`](playbooks/grill-sample-transcript.md), produced
when the playbook shipped (D5). Re-checked here against the current
[`docs/workspace-schemas.md`](workspace-schemas.md) `profile.json`/`preferences.json`/
`evidence.jsonl` field tables: still accurate, no drift.

## 2. Find roles — [`docs/playbooks/find-roles.md`](playbooks/find-roles.md)

`find-roles` ships no CLI code of its own (D6 is playbook-only) — it produces a plain
`leads.json` file and promotes accepted leads with the existing `add-role` command. Both parts
run for real here, against a disposable copy of the sample workspace:

**Step 1 — write a vetted lead to `leads.json`** (playbook Section 4), fictional and using the
`.invalid` domain the repo reserves for sample data:

```json
{
  "schemaVersion": "1.0",
  "leads": [
    {
      "id": "lead-001",
      "company": "Fabrikam AI",
      "title": "Developer platform product manager",
      "url": "https://jobs.example.invalid/fabrikam/developer-platform-product-manager",
      "source": "Company careers page",
      "discoveredAt": "2026-07-20",
      "fit": {
        "level": "strong",
        "rationale": "Matches the sample candidate's developer-platform and AI-workflow focus; remote, US-based, within compensation range."
      },
      "notes": "Fictional posting for the sample workspace. Verified link format only (example.invalid domain, not a live posting)."
    }
  ]
}
```

**Step 2 — promote the accepted lead** (playbook Section 5):

```text
$ node src/cli/index.js add-role --workspace <sample-copy> \
    --url "https://jobs.example.invalid/fabrikam/developer-platform-product-manager" \
    --title "Developer platform product manager" \
    --company "Fabrikam AI" \
    --tracked

Added tracked role: Fabrikam AI — Developer platform product manager
Run build-tracker to refresh outputs/tracker.md.
```

The role lands in `roles.tracked.json` with `status: "tracked"` and `applied: "Not applied"` —
exactly the not-yet-applied landing state the playbook promises, ready for `tailor` to attach a
resume next.

## 3. Tailor — [`docs/playbooks/tailor.md`](playbooks/tailor.md)

This is the headline workflow, and `npm start` exercises it directly against a freshly drafted
Fabrikam AI resume config (the same fictional walkthrough the playbook itself documents in its
"Sample-candidate walkthrough" section). Verbatim output:

```text
$ node src/cli/index.js tailor --workspace <sample-copy> \
    --config <sample-copy>/resume-configs/fabrikam-ai-developer-platform-pm.json \
    --url https://jobs.example.invalid/fabrikam/developer-platform-product-manager \
    --title "Developer platform product manager"

Warning: Evidence ledger is thin: only 2 source-backed evidence entries are available
(recommended minimum: 3). Metric claims in this resume config rest on a narrow evidence
base — ingest more source material (resumes, notes, GitHub activity) before treating
generated claims as fully vetted.
Rendered resume for Fabrikam AI: <sample-copy>/outputs/resumes/Fabrikam AI/alex-rivera-fabrikam-ai.docx
Added tracked role: Fabrikam AI — Developer platform product manager
Run build-tracker to refresh outputs/tracker.md.
Built tracker for 2 tracked role(s): <sample-copy>/outputs/tracker.md
Built html tracker for 2 tracked role(s): <sample-copy>/outputs/tracker.html
Updated Fabrikam AI — Developer platform product manager to status: interested (2026-07-20)
Tailored resume for Fabrikam AI — Developer platform product manager: <sample-copy>/outputs/resumes/Fabrikam AI/alex-rivera-fabrikam-ai.docx
```

One pass: schema validation, the evidence-backed claim audit (D3), the DOCX render (D2), and
tracked-role registration landing at `interested` — not `applied` — so a human reviews before
anything is sent. The thin-ledger warning is expected: the sample fixture ships exactly two
evidence entries on purpose (see `examples/sample-candidate/README.md`).

Then, the way an agent maps "I applied to X" onto one command (D7):

```text
$ node src/cli/index.js set-status --workspace <sample-copy> \
    --company "Fabrikam AI" --title "Developer platform product manager" --status applied

Built tracker for 2 tracked role(s): <sample-copy>/outputs/tracker.md
Built html tracker for 2 tracked role(s): <sample-copy>/outputs/tracker.html
Updated Fabrikam AI — Developer platform product manager to status: applied (2026-07-20)
```

**Regression finding, fixed in this change:** `docs/playbooks/tailor.md` Section 4 documents
`npm run workspace:set-status -- ...`, but `package.json` never defined that script — only
`workspace:tailor`, `workspace:bundle`, etc. existed. Running the playbook literally as written
failed with `npm error Missing script: "workspace:set-status"`. Fixed by adding
`"workspace:set-status": "node src/cli/index.js set-status"` to `package.json`, so the playbook
now works exactly as documented.

## 4. Study guide — [`docs/playbooks/study-guide.md`](playbooks/study-guide.md)

`study-guide-bundle` gathers profile, evidence, the tailored resume config, and job-posting URLs
into one context file for an agent to write the actual guide from:

```text
$ node src/cli/index.js study-guide-bundle --workspace <sample-copy> \
    --company "Fabrikam AI" --title "Developer platform product manager"

Created study guide bundle for Fabrikam AI — Developer platform product manager:
<sample-copy>/outputs/study-guide-bundles/role_fabrikam-ai-developer-platform-product-manager_c79a317aa9.json
```

The bundle's four sections (`role`, `profile`, `evidence`, `resumeConfig`, `jobPosting`) all
came through populated and consistent with what `tailor` had just written. Writing the guide
itself from that bundle is agent prose, not CLI output — the playbook's own "Example: study
guide structure" section (using the already-tracked Northwind Tools role) is that worked
example, and it still matches the bundle shape produced above.

## 5. Debrief — [`docs/playbooks/debrief.md`](playbooks/debrief.md)

`debrief` ships no CLI code of its own (playbook-only) — it produces a Q&A feedback entry and
writes it directly to `feedback.jsonl`. Both parts run for real here, against a disposable copy
of the sample workspace:

**Step 1 — capture a Q&A debrief entry** (playbook Section 1), fictional and tied to the
already-tracked Northwind Tools role for the sample candidate:

```json
{"schemaVersion":"1.0","id":"fb-001","context":"interview","relatedRoleId":"role-tracked-001","question":"Tell us about your experience building platform infrastructure for developer-facing products.","answer":"I described the API gateway work I led, but I didn't clearly articulate how it improved developer experience metrics or adoption rates.","sentiment":"neutral","sentimentNote":"Felt like I had good technical depth but missed the business impact angle. Interviewer seemed interested in the adoption metrics specifically.","proposedAnswer":"I would lead with the business outcome first: 'We increased third-party API adoption by 40% in six months by rebuilding our developer platform infrastructure. Here's how: [architectural decisions and metrics].' This frames the technical work in terms of outcomes, then dives into implementation details.","createdAt":"2026-07-20T14:30:00.000Z"}
```

**Step 2 — validate the workspace** (playbook Closing section):

```text
$ npm run workspace:validate -- --workspace <sample-copy>

Warning: resume-configs/northwind-tools-senior-pm.json: Evidence ledger is thin: only 2 source-backed evidence entries are available (recommended minimum: 3). Metric claims in this resume config rest on a narrow evidence base — ingest more source material (resumes, notes, GitHub activity) before treating generated claims as fully vetted.
Workspace valid: <sample-copy>
```

The feedback entry lands in `feedback.jsonl` with all fields populated — `context`, `relatedRoleId`,
the original question and answer, sentiment, and the proposed improvement for next time. The
`validate` pass confirms the entry conforms to the feedback schema; workspace remains otherwise
unchanged (debrief writes only to the feedback ledger, per the playbook's note in Section 1).

---

## Extended sample workflow (`npm start`)

`npm start` → `scripts/sample-quickstart.js` now runs the full lifecycle in one command:

1. Build the tracker (markdown + HTML) from the committed sample fixtures.
2. Score candidate roles with `find-similar`.
3. Render the already-tracked Northwind Tools resume to DOCX.
4. In a disposable temp-dir copy of the sample workspace (deleted before the script exits):
   `tailor` a new Fabrikam AI resume, `set-status` it to `applied`, and build a
   `study-guide-bundle` for it.
5. `validate` the committed sample workspace (schema + claim audit + privacy check).

Re-running `npm start` never leaves the working tree dirty — everything that mutates workspace
state happens inside a fresh OS-temp-dir copy that gets deleted at the end of the run.

## Regression-pass summary

| Playbook | Ran against sample data | Result |
| --- | --- | --- |
| `grill.md` | Alex Rivera fixture (already-populated) + Jordan Park transcript (re-checked) | Schema-accurate, no drift |
| `find-roles.md` | Fabrikam AI lead → promoted via `add-role --tracked` | Works as documented |
| `tailor.md` | Fabrikam AI resume config → `tailor` | Works as documented; found and fixed a missing `workspace:set-status` npm script |
| `study-guide.md` | Fabrikam AI tracked role → `study-guide-bundle` | Works as documented |
| `debrief.md` | Northwind Tools role → Q&A feedback entry to `feedback.jsonl` | Works as documented |

## Visual artifacts

- Lifecycle diagram: [`docs/images/lifecycle-flow.svg`](images/lifecycle-flow.svg) (embedded in
  the [README](../README.md)), source at
  [`docs/images/lifecycle-flow.workflow.json`](images/lifecycle-flow.workflow.json), generated
  with the `archify` skill.
- Tracker HTML screenshot: [`docs/images/tracker-html-sample.png`](images/tracker-html-sample.png).
- Rendered DOCX screenshot: [`docs/images/resume-docx-sample.png`](images/resume-docx-sample.png)
  (captured via a macOS Quick Look thumbnail of the real generated file — this repo has no
  headless DOCX-to-image pipeline, and PDF export is out of scope for plan 0001 per its Decision
  1, so this was the most faithful screenshot available in this environment).
