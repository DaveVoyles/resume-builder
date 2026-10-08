"use strict";

/**
 * Standalone, readable version of the tailor report:
 * <workspace>/outputs/tailor-reports/<role-id>.html, written next to the .md.
 *
 * Input is the plain data model from buildTailorReportModel()
 * (src/core/tailor-report.js). No external assets, no scripts; every value is
 * HTML-escaped. Same visual language as html-tracker.js (cards, sky-blue
 * accent), with a dark scheme and a phone-width layout.
 */

function esc(value) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

const asArray = (value) => (Array.isArray(value) ? value : []);
const pct = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const CSS = `
:root {
  color-scheme: light dark;
  --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; --line: #e2e8f0;
  --accent: #0284c7; --accent-soft: #e0f2fe; --good: #15803d; --good-soft: #dcfce7;
  --warn: #b45309; --warn-soft: #fef3c7; --bad: #b91c1c; --bad-soft: #fee2e2;
  --before-bg: #f1f5f9; --after-bg: #ecfdf5; --track: #e2e8f0; --shadow: 0 1px 3px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.05);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0b1220; --card: #111a2e; --text: #e2e8f0; --muted: #94a3b8; --line: #1f2b45;
    --accent: #38bdf8; --accent-soft: #0c2a40; --good: #4ade80; --good-soft: #0f2e1d;
    --warn: #fbbf24; --warn-soft: #3a2a0a; --bad: #f87171; --bad-soft: #3b1414;
    --before-bg: #16213a; --after-bg: #0f2e22; --track: #22304d; --shadow: none;
  }
}
:root[data-theme="dark"] {
  --bg: #0b1220; --card: #111a2e; --text: #e2e8f0; --muted: #94a3b8; --line: #1f2b45;
  --accent: #38bdf8; --accent-soft: #0c2a40; --good: #4ade80; --good-soft: #0f2e1d;
  --warn: #fbbf24; --warn-soft: #3a2a0a; --bad: #f87171; --bad-soft: #3b1414;
  --before-bg: #16213a; --after-bg: #0f2e22; --track: #22304d; --shadow: none;
}
* { box-sizing: border-box; }
body { margin: 0; padding: 2rem 16px 3rem; background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; }
main { max-width: 52rem; margin: 0 auto; }
h1 { margin: 0 0 .5rem; font-size: 1.75rem; font-weight: 800; letter-spacing: -.02em; }
h2 { margin: 0 0 .75rem; font-size: 1.1rem; font-weight: 700; }
h3 { margin: 1rem 0 .5rem; font-size: .95rem; font-weight: 700; }
p { margin: .25rem 0 .75rem; }
.meta { color: var(--muted); font-size: .9rem; margin: 0 0 1rem; }
.pill { display: inline-block; padding: .2rem .75rem; border-radius: 999px; font-size: .8rem; font-weight: 700; margin-bottom: .75rem; }
.pill-ready { background: var(--good-soft); color: var(--good); }
.pill-draft, .pill-confirm { background: var(--warn-soft); color: var(--warn); }
.pill-blocked { background: var(--bad-soft); color: var(--bad); }
.card { background: var(--card); border-radius: 1rem; padding: 1.25rem 1.25rem; margin: 0 0 1.25rem; box-shadow: var(--shadow); border: 1px solid var(--line); }
.hero { border-left: 4px solid var(--accent); }
.bars { display: grid; gap: .75rem; margin: .75rem 0 1rem; }
.bar-label { display: flex; justify-content: space-between; gap: 1rem; font-size: .9rem; margin-bottom: .25rem; }
.bar-label strong { font-weight: 700; }
.track { height: .9rem; border-radius: 999px; background: var(--track); overflow: hidden; }
.fill { height: 100%; border-radius: 999px; background: var(--muted); }
.fill-after { background: var(--accent); }
.lift { font-size: 1.05rem; font-weight: 700; color: var(--good); margin: 0 0 .5rem; }
.chips { display: flex; flex-wrap: wrap; gap: .5rem; padding: 0; margin: .5rem 0; list-style: none; }
.chip { background: var(--accent-soft); color: var(--accent); border-radius: .5rem; padding: .25rem .65rem; font-size: .85rem; font-weight: 600; }
.chip small { font-weight: 400; color: var(--muted); }
.chip-warn { background: var(--warn-soft); color: var(--warn); }
.edit { border-top: 1px solid var(--line); padding: .85rem 0 .25rem; }
.edit:first-of-type { border-top: 0; }
.tag { display: inline-block; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--accent); margin-bottom: .35rem; }
.ba { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.before, .after { border-radius: .6rem; padding: .6rem .8rem; font-size: .92rem; }
.before { background: var(--before-bg); }
.after { background: var(--after-bg); }
.ba-title { display: block; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: .2rem; }
.why { color: var(--muted); font-size: .85rem; margin: .4rem 0 0; }
ul.plain, ol.plain { margin: .25rem 0 .5rem; padding-left: 1.25rem; }
li { margin: .25rem 0; }
.note { color: var(--muted); font-size: .85rem; }
code { font-size: .85em; background: var(--before-bg); padding: .05rem .3rem; border-radius: .3rem; }
@media (max-width: 560px) {
  body { padding-top: 1.25rem; }
  .ba { grid-template-columns: 1fr; }
  h1 { font-size: 1.4rem; }
}
`;

function whyHtml(why) {
  if (!why) return "";
  const parts = [];
  const keywords = asArray(why.keywords);
  if (keywords.length) parts.push(`Uses ${keywords.map((k) => `&ldquo;${esc(k)}&rdquo;`).join(", ")} from the posting.`);
  const sources = asArray(why.sources);
  if (sources.length) parts.push(`Backed by your note${sources.length === 1 ? "" : "s"}: ${sources.map(esc).join(", ")}.`);
  else if (asArray(why.evidenceIds).length) parts.push(`Backed by your record (${why.evidenceIds.map(esc).join(", ")}).`);
  return parts.length ? `<p class="why"><strong>Why:</strong> ${parts.join(" ")}</p>` : "";
}

function beforeAfter(before, after, beforeTitle = "Before") {
  return `<div class="ba"><div class="before"><span class="ba-title">${esc(beforeTitle)}</span>${before ? esc(before) : "<em>(nothing)</em>"}</div>` +
    `<div class="after"><span class="ba-title">After, for this job</span>${after ? esc(after) : "<em>(left out)</em>"}</div></div>`;
}

function editBlock(tag, inner, why) {
  return `<div class="edit"><span class="tag">${esc(tag)}</span>${inner}${whyHtml(why)}</div>`;
}

function itemHtml(item, beforeTitle) {
  if (item.type === "reworded") return editBlock("Reworded bullet", beforeAfter(item.before, item.after, beforeTitle), item.why);
  if (item.type === "added") return editBlock("New bullet", beforeAfter("", item.after, beforeTitle), item.why);
  if (item.type === "promoted") return editBlock("Moved up", `<div class="after"><span class="ba-title">Now near the top</span>${esc(item.after)}</div>`, item.why);
  return editBlock("Left out", `<div class="before"><span class="ba-title">${esc(beforeTitle)}</span>${esc(item.before)}</div>`, null);
}

function changesHtml(model) {
  const { changes } = model;
  if (model.blocked) return "<p>No resume file was made yet, so there is nothing to compare.</p>";
  if (!changes.hasBase || !changes.diff) {
    const keywords = asArray(changes.keywordLines);
    return "<p>This is the first resume for this role, so there is nothing to compare yet.</p>" +
      (keywords.length ? `<h3>Posting keywords the resume now uses, and where</h3><ul class="plain">${keywords.map((line) => `<li>${esc(line)}</li>`).join("")}</ul>` : "");
  }
  const beforeTitle = changes.kind === "general" ? "Your general resume" : "Based on";
  const { diff } = changes;
  const out = [`<p class="note">Compared with ${changes.kind === "general" ? "your general resume (built from your profile and past resumes)" : "the resume this one was based on"}.</p>`];
  if (diff.summary) {
    const label = diff.summary.type === "added" ? "Summary added" : diff.summary.type === "removed" ? "Summary removed" : "Summary reworded";
    out.push(editBlock(label, beforeAfter(diff.summary.before, diff.summary.after, beforeTitle), diff.summary.why));
  }
  for (const job of asArray(diff.jobs)) {
    out.push(`<h3>${esc(job.label)}</h3>`);
    asArray(job.items).forEach((item) => out.push(itemHtml(item, beforeTitle)));
  }
  asArray(diff.jobsAdded).forEach((job) => out.push(editBlock("Job added", `<div class="after">${esc(job.label)} (${esc(job.count)} ${job.count === 1 ? "bullet" : "bullets"})</div>`, null)));
  asArray(diff.jobsLeftOut).forEach((label) => out.push(editBlock("Job left out", `<div class="before"><span class="ba-title">${esc(beforeTitle)}</span>${esc(label)}</div>`, null)));
  if (diff.skills) {
    const added = asArray(diff.skills.added);
    const parts = [];
    if (added.length) parts.push(`<div class="after"><span class="ba-title">Added to skills</span>${added.map(esc).join(", ")}</div>`);
    if (diff.skills.reordered) parts.push('<p class="note">The skills lines were reordered.</p>');
    out.push(editBlock("Skills", parts.join(""), diff.skills.why));
  }
  if (out.length === 1) out.push(`<p>${esc(changes.lines[0] || "No wording changes.")}</p>`);
  return out.join("");
}

function barHtml(label, stats, extraClass) {
  const percent = pct(stats.percent);
  return `<div><div class="bar-label"><span>${esc(label)}</span><strong>${esc(stats.covered)} of ${esc(stats.total)} keywords (${percent}%)</strong></div>` +
    `<div class="track" role="img" aria-label="${esc(label)}: ${percent} percent"><div class="fill ${extraClass}" style="width:${percent}%"></div></div></div>`;
}

function coverageHtml(model) {
  const { lift, coverage } = model;
  if (!coverage) return "";
  if (!lift) {
    return `<section class="card"><h2>Job match</h2>${barHtml("This resume", { covered: coverage.covered.length, total: coverage.total, percent: coverage.percent === null ? 0 : coverage.percent }, "fill-after")}</section>`;
  }
  const head = lift.liftPoints > 0
    ? `<p class="lift">+${esc(lift.liftPoints)} points more of the posting&rsquo;s keywords than ${lift.kind === "general" ? "your general resume" : "the resume it was based on"}.</p>`
    : "";
  const gained = asArray(lift.gained);
  const chips = gained.length
    ? `<h3>Keywords this resume gained</h3><ul class="chips">${gained.map((item) =>
      `<li class="chip${item.supported ? "" : " chip-warn"}">${esc(item.keyword)} <small>in ${esc(item.where)}${item.supported ? "" : "; please confirm"}</small></li>`).join("")}</ul>`
    : "<p class=\"note\">No keywords were gained; the general resume already covered every keyword this one does.</p>";
  const still = asArray(lift.stillMissing);
  const missing = still.filter((item) => !item.supported && !item.possible && !item.declined);
  const declined = still.filter((item) => item.declined);
  const confirmedOff = still.filter((item) => item.supported && item.confirmed);
  const missingHtml =
    (missing.length
      ? `<p class="note">Still not on the resume, and I found nothing in your record that backs them, so I left them off: ${missing.map((item) => esc(item.keyword)).join(", ")}.</p>`
      : "") +
    (declined.length
      ? `<p class="note">You told me you have not done these, so they stay off: ${declined.map((item) => esc(item.keyword)).join(", ")}.</p>`
      : "") +
    (confirmedOff.length
      ? `<p class="note">You confirmed these, but this resume does not use them yet: ${confirmedOff.map((item) => esc(item.keyword)).join(", ")}.</p>`
      : "");
  return `<section class="card hero"><h2>Proof it was tailored</h2>${head}` +
    `<p>${esc(model.liftSentence)}</p>` +
    `<div class="bars">${barHtml(lift.label, lift.baseline, "")}${barHtml("This resume", lift.tailored, "fill-after")}</div>${chips}${missingHtml}</section>`;
}

function possibleHtml(model) {
  const items = asArray(model.possibleMatches);
  if (model.blocked || !items.length) return "";
  const list = items.map((item) =>
    `<li><strong>${esc(item.keyword)}</strong><ul class="plain">${asArray(item.matches).map((match) =>
      `<li>&ldquo;${esc(match.quote)}&rdquo; <span class="note">(${match.source ? `from ${esc(match.source)}` : `evidence <code>${esc(match.evidenceId)}</code>`})</span></li>`).join("")}</ul></li>`).join("");
  return `<section class="card"><h2>${esc(model.possibleHeading)}</h2><p>${esc(model.possibleIntro)}</p><ul class="plain">${list}</ul></section>`;
}

function listCard(title, items, ordered) {
  if (!items.length) return "";
  const tag = ordered ? "ol" : "ul";
  return `<section class="card"><h2>${esc(title)}</h2><${tag} class="plain">${items.map((item) => `<li>${item}</li>`).join("")}</${tag}></section>`;
}

/**
 * @param {object} model from buildTailorReportModel()
 * @returns {string} a complete HTML document
 */
function renderHtmlTailorReport(model) {
  const title = `Resume report: ${model.title} at ${model.company}`;
  const confirm = asArray(model.confirm);
  const checks = asArray(model.checks).map((item) =>
    esc(item.text) + (item.sub.length ? `<ul class="plain">${item.sub.map((text) => `<li>${esc(text)}</li>`).join("")}</ul>` : ""));
  const gaps = asArray(model.gaps).map((gap) => `<strong>${esc(gap.keyword)}</strong>: ${esc(gap.type)}. ${esc(gap.action)}`);
  const notDone = asArray(model.notDone).map(esc);

  const body = [
    `<h1>${esc(title)}</h1>`,
    `<span class="pill pill-${esc(model.statusKind)}">${esc(model.status)}</span>`,
    `<p class="meta">Resume file: ${esc(model.resumeFile || "not made yet")} &middot; Report written: ${esc(model.date)}</p>`,
    `<p>${esc(model.intro)}</p>`,
    model.blocked ? "" : coverageHtml(model),
    possibleHtml(model),
    `<section class="card"><h2>What changed for this job</h2>${changesHtml(model)}</section>`,
    confirm.length
      ? listCard("Needs your confirmation", confirm.map(esc), true).replace("</section>", '<p class="note">Answer in plain words. I&rsquo;ll record what you tell me before anything is sent.</p></section>')
      : '<section class="card"><h2>Needs your confirmation</h2><p>Nothing right now.</p></section>',
    listCard("What the checks found", checks, false),
    model.fit ? `<section class="card"><h2>Fit</h2><p>${esc(model.fit)}</p></section>` : "",
    listCard("Not done yet", notDone, false),
    gaps.length ? listCard("Open gaps", gaps, false) : "",
  ].join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
${body}
</main>
</body>
</html>
`;
}

module.exports = { renderHtmlTailorReport };
