# Agent FAQ: empty folder to a study guide

You are the helper. The person does not run commands, edit files, or learn this repo. You do.

Read [what-to-say.md](what-to-say.md) before you speak. Open [guide.html](guide.html) before you ask them for anything.

## First session, in this order

Do not skip ahead. Do not show them a pile of commands.

1. **Open the start page.** From the repo root:

   ```bash
   open docs/first-run/guide.html
   ```

   On Windows: `start docs/first-run/guide.html`. On Linux: `xdg-open docs/first-run/guide.html`.

   Say sentence 1 in [what-to-say.md](what-to-say.md). Wait until they can see the page. Walk any step they ask about. Do not start setup while they are still reading.

2. **Install only if needed.** If `node_modules` is missing, run `npm install` yourself. Do not ask them to.

3. **Do not lead with `npm start`.** That command runs a fictional practice in a temporary folder and then deletes it. The person never gets a stable page from it. If they ask to see an example, say the sentence "If they ask to see a finished example first" and run it yourself. Then return to the start page.

4. **Create their private folder** only after they have seen the start page and are ready.

   ```bash
   npm run setup
   ```

   Say sentence 2. The setup command opens an empty job list in the browser. Tell them the emptiness is normal.

5. **Collect old material.** Open `candidate/inputs/resumes/` for them (`open` / `start` / `xdg-open` on that folder). Say sentence 3. Wait until they say the files are in, or they ask what to include.

   Enough to start: one old resume, or a notes file, or a GitHub username. More is better. LinkedIn pages are behind a login, so you cannot pull a LinkedIn profile the way you can pull public GitHub repos. If they want LinkedIn included, ask them to export their data from LinkedIn settings, or paste the parts they care about into a notes file.

6. **Read the files.** Say sentence 4. Wait for a yes. Then run ingest with only the flags that match what they gave you:

   ```bash
   npm run workspace:ingest -- --workspace candidate --resume <file> --notes <file> --links candidate/inputs/links.md --github <username>
   ```

   Tell them how many sources you read, in one sentence. Do not dump a log.

7. **Interview them.** Say sentence 5. Follow `docs/playbooks/grill.md`, one question at a time. Write answers to `candidate/profile.json`, `candidate/preferences.json`, and `candidate/evidence.jsonl`. You never ask them to edit those files.

8. **One job.** Say sentence 6. Follow `docs/playbooks/find-roles.md`. Check the link is live. If it is dead, say so and stop. Do not write a resume until they say yes to that job.

9. **Write the resume.** Follow `docs/playbooks/tailor.md`. The new role lands as interested, not applied. Open the Word file for them. Say sentence 7. Change any sentence they reject. Do not invent a metric, title, or employer to fill a gap.

10. **Show the list.** Rebuild and open the tracker if it is not already open. Say sentence 8.

    ```bash
    npm run workspace:tracker -- --workspace candidate
    ```

11. **Later: status.** When they say they applied, interviewed, got an offer, or were turned down, run `set-status` yourself and say sentence 9. Status words: interested, applied, interview, offer, rejected, withdrawn, ghosted. Say the plain version back: "not started," "applied," "interview," "offer," "they said no," "you withdrew," "no reply."

12. **Later: study guide.** When an interview is coming, follow `docs/playbooks/study-guide.md`. Say sentence 10. The guide stays in their private folder. Do not commit it.

## How you know which step they are on

At the start of a later session, check before you greet them:

| If this is true | You are here |
| --- | --- |
| `candidate/profile.json` is missing | Step 4. They have not started. Open the start page again if they have never seen it. |
| The private folder exists but `candidate/inputs/` has no real files | Step 5. Ask for old material. |
| Files are there and `candidate/evidence.jsonl` is empty | Step 6. Read the files. |
| Evidence exists and `profile.json` has an empty `experience` list | Step 7. Interview. |
| `experience` has at least one job | They are set up. Do the thing they asked. Do not restart onboarding. |

The same checks are written for you in `docs/playbooks/onboarding.md`. Use that file for edge cases. Use this file for what you say.

## Questions they will ask

**Do I need to know how to code?**
No. You run the steps. They answer questions and read the resume.

**Which helper can I use?**
Claude, Grok, or Gemini, including Google Antigravity. Copilot or ChatGPT also work if they can read this repo and run commands. This program does not call an AI and does not need an API key.

**Where do my files go?**
In a folder named `candidate/` on their machine. Say "a private folder on your computer." It is not uploaded with the project. Do not commit it. Before any commit of project files, run `npm run check:privacy`.

**Will this apply to jobs for me?**
No. A resume is written for them to review. Nothing is submitted unless they later say so, on a real application site, themselves. If you see a page titled like a practice application for a fictional company, that page is a test fixture. Do not open it during first-run. It is not their application.

**What if a sentence is wrong?**
Take it out. Do not soften a false claim. If you do not have a source, ask, or leave it off.

**What if I only have a LinkedIn profile?**
Ask them to paste the jobs and projects they want included, or to drop an export into the notes folder. Do not pretend you read a logged-in LinkedIn page.

**What is the job list?**
One page in the browser. Each row is a job. The status is a plain word. They do not keep a spreadsheet.

**What is the study guide?**
A short document for one interview. It uses their real work. It also lists what they have not done.

**Can we do more than one job?**
Yes. Repeat steps 8 and 9 for each job they choose. One at a time.

**What if the job link is dead?**
Stop. Tell them the posting is gone. Do not write a resume for it.

## What you run, and never show unless they ask

| They want | You run | Playbook |
| --- | --- | --- |
| Private folder | `npm run setup` | onboarding |
| Read their files | `npm run workspace:ingest` | onboarding |
| Interview | you write profile and evidence | grill |
| Check a job | you vet the link, then `add-role` when they say yes | find-roles |
| Resume | `npm run workspace:tailor` | tailor |
| Job list | `npm run workspace:tracker` | — |
| Status change | `npm run workspace -- set-status ...` | status recipe in `AGENTS.md` |
| Study guide | `npm run workspace:bundle`, then you write the guide | study-guide |
| Cover letter | only if they ask | cover-letter |
| People they know | only if they ask | contacts |
| After an interview | only if they want notes on how it went | debrief |

Validate before you hand them a resume:

```bash
npm run workspace:validate -- --workspace candidate
```

## Never

- Invent a job, a metric, a degree, or an employer.
- Commit `candidate/` or generated resumes.
- Tell them to paste a playbook into some other chat. You are the agent. Follow the playbook.
- Open a practice application form during first-run.
- Press Submit on any application.
- Restart the interview if they already have work history saved.
