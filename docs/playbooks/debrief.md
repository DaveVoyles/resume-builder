# Q&A debrief playbook

**Debrief** is an on-demand interview to capture Q&A performance feedback. It records how a candidate felt about answers they gave, proposes improvements for next time, and writes structured entries to a private feedback ledger.

This playbook guides you through a one-question-at-a-time debrief conversation. For each Q&A, you'll capture the context, question, answer, and sentiment, then propose a better answer for next time and write the resulting entry to `candidate/feedback.jsonl`.

Before you start:

- The candidate should have notes about a recent interview, conversation, or practice session — grill intake, real employer interview, study-guide preparation, or tailor walkthrough.
- You'll create or update files in the candidate's workspace (`candidate/feedback.jsonl`).
- After debrief, run `npm run workspace:validate -- --workspace candidate` to ensure the workspace is valid.

---

## Start the debrief conversation

**Propose a recommended approach:**

"I'll ask you about each question you were asked, how you answered it, and how you felt about your answer. For each one, I'll propose an improved answer based on your feedback. Let's start with your first Q&A."

**Confirm the candidate is ready:**

- [ ] The candidate has notes from a recent interview, conversation, or practice session.
- [ ] The candidate can describe the question asked, their answer, and how they felt.
- [ ] You have access to create or edit `candidate/feedback.jsonl`.

---

## Section 1: Capture one Q&A

### Question 1.1: Context type

**Ask:**

"What kind of Q&A was this? Was this from a grill intake, a real employer interview, study-guide prep, or a tailor conversation?"

**Candidate answers with:** One of: grill, interview, study-guide, tailor.

**Recommend:**

"I'm recording this as a [context type] question. Is that right?"

**Write to memory:** Note the context type for this Q&A.

### Question 1.2: Related role (optional)

**Ask:**

"Do you want to link this Q&A to a specific tracked role? If yes, what's the role ID? If no, we can skip this."

**Candidate answers with:** A role ID (e.g., `role-tracked-001`), or "no" to skip.

**Recommend:**

"I'm linking this to [role ID]. If this should stay independent, just say so."

**Write to memory:** Note the role ID if provided.

### Question 1.3: The question

**Ask:**

"What was the question you were asked? Be specific."

**Candidate answers with:** The exact or close-to-exact question text.

**Recommend:**

"Here's how I understood the question: '[Question text]'. Sound right?"

**Write to memory:** Record the question.

### Question 1.4: Your answer

**Ask:**

"How did you answer it? Tell me your actual answer, or as close as you remember."

**Candidate answers with:** The answer they gave, or a reconstruction of it.

**Recommend:**

"So your answer was: '[Answer text]'. Any corrections?"

**Write to memory:** Record the answer.

### Question 1.5: Sentiment

**Ask:**

"How did you feel about your answer? Were you confident, neutral, unsure, or did you feel it went poorly?"

**Candidate answers with:** One of: `confident`, `neutral`, `unsure`, `poor`.

**Recommend:**

"I'm noting your sentiment as '[sentiment]'. Any additional thoughts?"

**Write to memory:** Record the sentiment.

### Question 1.6: Sentiment note (optional)

**Ask:**

"Anything else you want to add about how that answer went? Why you felt that way, what you wish you'd said, or specific concerns?"

**Candidate answers with:** Free-text note, or "no" to skip.

**Recommend:**

"Got it. I'll add that to your notes: '[Sentiment note]'."

**Write to memory:** Record the sentiment note if provided.

### Question 1.7: Improved answer

**Ask:**

"Based on what you've told me, here's a better way to answer that question for next time: [Proposed improved answer]. Does that work? Should I adjust it?"

**Candidate answers with:** Approval, refinement, or correction to your proposed improvement.

**Recommend:**

"Perfect. I'll record this as your improved answer: '[Final improved answer]'."

**Write to memory:** Record the improved answer.

### Write to `candidate/feedback.jsonl`

After capturing all fields, write one JSON object to `candidate/feedback.jsonl` (JSON Lines format, one object per line):

```jsonl
{"schemaVersion":"1.0","id":"fb-001","context":"interview","relatedRoleId":"role-tracked-001","question":"Tell me about your experience with system design.","answer":"I talked about a project I led, but I didn't go deep enough into trade-offs.","sentiment":"neutral","sentimentNote":"Felt rushed. Interviewer seemed interested but I cut it short.","proposedAnswer":"I would start by asking clarifying questions about scale and constraints, then walk through the architecture decisions I'd make, explicitly naming trade-offs at each step.","createdAt":"2026-07-20T14:30:00.000Z"}
```

Each entry is a single line — the file is JSON Lines, not pretty-printed JSON; a multi-line object breaks the line-by-line validator.

**Important:** Debrief entries write only to `feedback.jsonl`. They do not update `profile.json`, `evidence.jsonl`, or tracked roles — that's a manual follow-up via the grill or tailor workflows. This is out of scope for the debrief playbook.

### Repeat for other Q&As

**Ask:**

"Do you want to debrief another question from the same session, or a different session?"

**Repeat questions 1.1–1.7** for each additional Q&A, incrementing the `id` field (e.g., `fb-001`, `fb-002`, `fb-003`).

**Stop when:**

- The candidate says they've covered all their feedback questions, or
- You've debriefed all the key Q&As the candidate wants to track.

---

## Closing: Validation and next steps

**Summarize what you've collected:**

"Here's what we captured: [Number] Q&A feedback entries from [context types]. I've written them into your feedback ledger. Let me validate everything now."

**Validate the workspace:**

```bash
npm run workspace:validate -- --workspace candidate
```

**If validation passes:**

"Your workspace is valid! Next steps: You can use these debrief notes to refine your answers before upcoming interviews, or share them with your agent for interview study-guide prep."

**If validation fails:**

Show the candidate the specific error, ask for clarification, and update the feedback.jsonl entries.

---

## Tips for the debrief

- **Ask one question at a time.** Pause for a complete answer before moving to the next question.
- **Capture verbatim when possible.** The candidate's exact words (or close reconstructions) are more useful for learning.
- **Don't over-coach.** Your proposed improved answer should be a suggestion, not a mandate. The candidate knows their own experience best.
- **Note timing and context.** If the candidate felt rushed or the interviewer seemed interested, capture that in the sentiment note.
- **Link to roles when relevant.** If this Q&A came from a real interview for a tracked role, link `relatedRoleId` so the feedback stays with the application.
- **Respect privacy.** Don't ask the candidate to record anything they're uncomfortable storing in the workspace.

---

## Schema reference

- `feedback.jsonl`: Stores Q&A feedback with sentiment and proposed improvements (ledger format, one JSON object per line).

For full details, see [Candidate workspace schemas](../workspace-schemas.md).
