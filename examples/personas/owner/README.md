# Owner persona (real resume, real job postings)

The one persona built from a real person: the repo owner. The input is their real resume at `examples/real-resume/owner/` (email scrubbed, committed with their permission). The target jobs are real public postings, saved as offline snapshots so the demo still works after the pages come down.

Status: **complete and part of the suite.** `npm run e2e`, `npm test` and `npm run test:browser` all run it. The resume goes through the real Word ingest path (29 ingested entries: Word list items are now kept as one entry each, where they used to be merged into 20), each posting is stored with its keywords, and each role gets a tailored one-page resume, a tailor report with before/after and coverage lift, and a golden DOCX text.

## What is here

| File | What it is |
| --- | --- |
| `answers.json` | The home-form answers. Where and when to start are assumptions for the demo (remote, 1 to 3 months). Salary and deal breakers are skipped. Change them if the owner's real preferences differ. |
| `JOBS.md` | The shortlist of roles that fit the resume, why each fits, and where it came from. |
| `postings/` | One snapshot per job. See `postings/README.md` for the format. |
| `inputs/notes/owner-confirmations.md` | The owner's yes/no answers of 2026-10-08 to the JPMorgan Chase report's confirmation questions, in their own words: nine keywords confirmed (each with the resume line behind it), RAID, agile and ServiceNow not done. Ingested as a note; the tool treats it as the source for those answers. |
| `expected.json` | Scorecard thresholds per posting, each with a `note` saying why. `inputs` points at `examples/real-resume/owner/owner-resume.docx`, so the 770 KB resume is not copied here, plus the confirmation note. `neverClaim` lists the keywords no resume may contain. |
| `resume-configs/` | The three tailored resumes. Every figure is bound to the resume bullet that states it. |
| `golden/` | The expected DOCX text of each tailored resume. Review any change to these line by line against the resume. |

## Results today

| Role | General resume | Tailored | Fit |
| --- | --- | --- | --- |
| JPMorgan Chase, Lead Technical Program Manager | 7% | 80% | Closest fit. Nine of the twelve extra keywords are on the resume under different words; the owner confirmed them. RAID, agile and ServiceNow stay off. |
| Bentley Systems, Senior Principal Engineer, Developer Platform | 12% | 20% | Stretch. The lift is two words the posting asks for by name (leadership, analytics), not new experience. Every real requirement is still missing. |
| Deloitte, Lead Forward Deployed Engineer, Frontier GenAI | 20% | 28% | Weakest fit. Generic words (AI, cloud, Azure, API, agents) plus leadership and risk management. Every real requirement is still missing. |

Before the owner answered, the JPMorgan Chase report listed those nine keywords under "Possible matches in your record. You decide." with the resume line behind each, and the tailored resume stayed at 20%. The literal matcher alone could not see them.

## Rules

- Nothing is applied for. Snapshots are for tailoring and testing only, and no test submits anything.
- Resume claims must be backed by the resume. The tailored configs can reword and reorder what the resume says; they cannot add experience it does not show.
- Snapshots are public job pages kept for illustration with their source links. Remove one if its owner asks.
