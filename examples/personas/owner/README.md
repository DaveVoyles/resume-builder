# Owner persona (real resume, real job postings)

The one persona built from a real person: the repo owner. The input is their real resume at `examples/real-resume/owner/` (email scrubbed, committed with their permission). The target jobs are real public postings, saved as offline snapshots so the demo still works after the pages come down.

Status: **snapshots are in; tailored resumes are next.** There is no `expected.json` yet, so `npm run e2e` skips this persona. It joins the suite once the tailored resume configs are written.

## What is here

| File | What it is |
| --- | --- |
| `answers.json` | The home-form answers. Where and when to start are assumptions for the demo (remote, 1 to 3 months). Salary and deal breakers are skipped. Change them if the owner's real preferences differ. |
| `JOBS.md` | The shortlist of roles that fit the resume, why each fits, and where it came from. |
| `postings/` | One snapshot per job. See `postings/README.md` for the format. |

## Rules

- Nothing is applied for. Snapshots are for tailoring and testing only, and no test submits anything.
- Resume claims must be backed by the resume. The tailored configs can reword and reorder what the resume says; they cannot add experience it does not show.
- Snapshots are public job pages kept for illustration with their source links. Remove one if its owner asks.
