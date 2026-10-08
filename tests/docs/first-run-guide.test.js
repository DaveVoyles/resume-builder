"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const guide = fs.readFileSync(
  path.join(__dirname, "../../docs/first-run/guide.html"),
  "utf8"
);
const speech = fs.readFileSync(
  path.join(__dirname, "../../docs/first-run/what-to-say.md"),
  "utf8"
);
const faq = fs.readFileSync(
  path.join(__dirname, "../../docs/first-run/FAQ.md"),
  "utf8"
);
const gettingStarted = fs.readFileSync(
  path.join(__dirname, "../../docs/getting-started.md"),
  "utf8"
);
const agentWorkflow = fs.readFileSync(
  path.join(__dirname, "../../docs/agent-workflow.md"),
  "utf8"
);
const readme = fs.readFileSync(
  path.join(__dirname, "../../README.md"),
  "utf8"
);
const transcript = fs.readFileSync(
  path.join(__dirname, "../../docs/playbooks/onboarding-sample-transcript.md"),
  "utf8"
);

test("the briefing states the four outcomes and keeps samples fictional", () => {
  assert.equal((guide.match(/<details/g) || []).length, 4);
  assert.doesNotMatch(guide, /Alex is not you/);
  assert.doesNotMatch(guide, /Meet Alex/);
  assert.doesNotMatch(guide, /You do this/);
  assert.doesNotMatch(guide, /You could say/);
  assert.doesNotMatch(guide, /Show this step/);
  assert.match(guide, /Nothing is sent until you say so/);
  assert.match(guide, /private profile/i);
  assert.match(guide, /Fabrikam Studio/);
  assert.match(guide, /Contoso Labs/);
  assert.match(guide, /Northwind Tools/);
  assert.match(guide, /Fictional sample/);
  assert.match(guide, /does not send an application/);
});

test("the assistant script matches the briefing and does not talk down", () => {
  assert.doesNotMatch(speech, /Alex is not you/);
  assert.doesNotMatch(speech, /It is not you/);
  assert.doesNotMatch(speech, /eight short steps/);
  assert.match(speech, /What the assistant produces before anything leaves your desk/);
  assert.match(speech, /private profile/);
  assert.match(speech, /only after you approve that role/);
});

test("the briefing tells a person where files go in and where results come back", () => {
  assert.match(guide, /my-documents/);
  assert.match(guide, /Put past resumes and notes in my-documents/);
  assert.match(guide, /finished resume, the role list, and the interview brief/);
});

test("the assistant opens my-documents and uses the real status words", () => {
  assert.match(speech, /my-documents/);
  assert.match(speech, /candidate\/inputs\/resumes/);
  assert.match(speech, /candidate\/inputs\/notes/);
  assert.doesNotMatch(speech, /Put resumes in the resumes folder/);
  assert.doesNotMatch(speech, /notes in the notes folder/);
  assert.match(speech, /they said no/);
  assert.match(speech, /you withdrew/);
  assert.match(speech, /no reply/);
  assert.doesNotMatch(speech, /or no\./);
  assert.match(speech, /outputs\/resumes/);
  assert.match(speech, /tracker\.html/);
  assert.match(speech, /study-guides/);
});

test("the FAQ and getting started agree with the briefing", () => {
  assert.match(faq, /If they ask about the samples/);
  assert.doesNotMatch(faq, /finished example first/);
  assert.match(faq, /Open `my-documents`/);
  assert.match(faq, /candidate\/inputs\/resumes/);
  assert.doesNotMatch(faq, /Open `candidate\/inputs\/`/);
  assert.doesNotMatch(gettingStarted, /The first goal is to make sure the fictional sample works/);
  assert.doesNotMatch(gettingStarted, /The sample workflow runs successfully/);
  assert.match(gettingStarted, /The briefing was opened before any resume was written/);
  assert.match(gettingStarted, /Do not lead with `npm start`/);
  assert.doesNotMatch(agentWorkflow, /Start by running the sample workflow/);
  assert.match(agentWorkflow, /Open docs\/first-run\/guide\.html/);
  assert.match(readme, /practice sample only/);
});

test("the onboarding sample transcript drops files in my-documents and the agent copies them", () => {
  assert.match(transcript, /drops a career notes file in `my-documents`/);
  assert.match(transcript, /cat my-documents\/career-notes.md/);
  assert.match(transcript, /copies the notes file into `candidate\/inputs\/notes`/);
  assert.match(transcript, /candidate\/inputs\/notes\/career-notes.md/);
  assert.match(transcript, /writes `candidate\/inputs\/links.md`/);
  assert.match(transcript, /The person does not edit `links.md`/);
  assert.doesNotMatch(transcript, /fills in `links.md`/);
  assert.doesNotMatch(readme, /Drop resumes, notes, and links into `candidate\/inputs\/`/);
});

