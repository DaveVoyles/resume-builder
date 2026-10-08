# What to say

Say these sentences. Then stop and wait. Do not add command names or file types unless the person asks. Always name real folders from the repo root. Never say "the resumes folder" or "the notes folder."

If you must name a file type, say what it is in the same sentence. "Word file" is enough. Do not say docx, JSON, gitignore, workspace, CLI, ingest, or evidence ledger.

Speak as you would to a colleague. Do not talk down.

## 1. This page

"I'm opening a one-page briefing in your browser. It covers the profile, the resume, the role list, and the interview brief. Tell me when you can see it."

If they cannot see it: "I'll try again. The page is titled What the assistant produces before anything leaves your desk."

## 2. Their private folder

"I'll keep your resumes and notes in a private folder on this computer. I will not publish it."

After the empty list opens: "That page is your role list. It stays empty until we add roles."

## 3. Old material

"I need material you already have: past resumes, notes, or links to work you have published. More than one source is useful. I'll turn them into a private profile. I will not write a resume from them yet."

Open `my-documents` for them. If Open folder fails, or the home page shows the fallback note, open `my-documents` yourself from the repo root.

"Put those files in `my-documents` at the top of the resume-builder folder. Word files, PDFs, or notes are all fine. If you have a link, paste it to me. Tell me when the files are in."

After they confirm, copy the files into `candidate/inputs/resumes` or `candidate/inputs/notes`, then ingest. Do not ask them to drop files into `candidate/inputs/`. Home Introduction does not show those paths to the person. They are in this file and in the collapsed "For your AI agent" note on home.

## 4. Reading what they gave you

"I'll read what you added and draft a private profile for you to correct. I will not write a resume yet."

## 5. The interview

"I still need the story in your words. I'll ask one question at a time: roles you have held, the kind of work you want, where you can work, and compensation if you want to include it. Correct me when I have it wrong. Skip anything you would rather not answer."

Then follow `docs/playbooks/grill.md`. Keep each question to one sentence.

## 6. Roles

"You can send several postings. I'll check that each link is still live. I'll write a resume for one role at a time, and only after you approve that role. The others stay on the list."

## 7. The resume

Open the Word file under `candidate/outputs/resumes/` before you say this.

"The resume is ready in `candidate/outputs/resumes/`. Please read it. Tell me any sentence you would not say. Nothing has been sent."

## 8. The list

"This is your list of roles. Each row shows where that role stands: not started, applied, interview, offer, they said no, you withdrew, or no reply."

Those plain words match interested, applied, interview, offer, rejected, withdrawn, and ghosted. Use the plain words with the person.

## 9. A status change

"I'll update the list." Then repeat the new status. Remind them, if it is ambiguous, that updating the list does not submit an application.

## 10. The interview brief

Open `candidate/outputs/study-guides/<company>/study-guide.md` for them when it exists.

## If they ask where a file is

"I'll open it." Then name the matching path below and open the file.

| They mean | You open |
| --- | --- |
| Past resumes and notes | `my-documents` |
| The resume | the Word file under `candidate/outputs/resumes/` |
| The role list | http://localhost:4321/tracker.html |
| The interview brief | `candidate/outputs/study-guides/` |

Open the tracker from the home page link at http://localhost:4321/tracker.html. Rebuild it with `npm run workspace:tracker:html -- --workspace candidate` if it is missing. The file also lives at `candidate/outputs/tracker.html`.

## If they ask about the samples

"The samples on that page are a fictional person, Alex Rivera, at fictional companies. Your profile replaces them. I can also run a short practice with Alex and discard those files. The briefing is the page to keep."
