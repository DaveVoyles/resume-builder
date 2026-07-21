"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { renderHtmlTracker, renderOnboardingChecklist } = require("../../src/renderers/html-tracker");
const { defaultOnboardingState } = require("../../src/core/onboarding-state");

// Tests for the HTML tracker renderer, including the Cover Letter column.

// Builds a stub filter button matching the real markup's
// `<button data-filter="...">`, capable of storing the click handler
// render() attaches via addEventListener and actually invoking it — so a
// test can simulate a real click (`button.click()`) and observe render()'s
// real effect on tbody, not just assert the button exists in the HTML.
function makeFilterButtonStub(filterValue, isActive) {
  const classes = new Set(isActive ? ["active"] : []);
  const stub = {
    getAttribute: (name) => (name === "data-filter" ? filterValue : null),
    addEventListener: (type, handler) => {
      stub._handler = type === "click" ? handler : stub._handler;
    },
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
    },
    click: () => stub._handler && stub._handler(),
  };
  return stub;
}

// Executes the tracker's embedded client-side <script> in a real Node vm
// sandbox (built-in module, no new dependency) against a minimal DOM stub,
// so tests can call the actual rendering helpers (companyColor, resumeCell,
// locationCell, esc, ...) and assert on real computed output — rather than
// pattern-matching the helpers' own source text, which would pass even if
// the underlying logic were broken. Top-level `function` declarations in
// the script become callable properties on the returned context object;
// top-level `const`/`let` do not (standard JS scoping), so `tbody`/`roles`
// etc. aren't directly readable here, but the stub objects backing
// `document.querySelector(...)` are the same references the script mutates,
// so tbodyStub.innerHTML reflects real output after calling context.render().
function runClientScript(html, { fetchImpl, location } = {}) {
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/u);
  if (!scriptMatch) throw new Error("runClientScript: no <script> block found in rendered output");

  const tbody = { innerHTML: "" };
  const emptyState = { style: { display: "" } };
  const searchInput = { value: "", addEventListener() {} };
  const filterButtons = [...html.matchAll(/<button data-filter="([^"]+)"( class="active")?>/gu)].map(([, filterValue, active]) =>
    makeFilterButtonStub(filterValue, Boolean(active)),
  );

  const documentStub = {
    querySelector: (selector) => (selector.includes("tbody") ? tbody : null),
    getElementById: (id) => (id === "emptyState" ? emptyState : id === "search" ? searchInput : null),
    querySelectorAll: (selector) => (selector.includes("data-filter") ? filterButtons : []),
    createElement: () => {
      let text = "";
      return {
        set textContent(value) {
          text = String(value);
        },
        get innerHTML() {
          // Mirrors a real browser's textContent -> innerHTML text-node
          // escaping: &, <, > only — quotes are not escaped in text-node
          // content (only in attribute values), matching esc()'s actual
          // production behavior.
          return text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
        },
      };
    },
  };

  // fetch/location are only injected when a test opts in — by default the
  // vm context has neither, matching a real un-served page opened directly
  // from disk (typeof fetch !== "function" there too), so the embedded
  // poll-for-changes call safely no-ops for every test that doesn't care
  // about it, exactly as it does in that real no-server scenario.
  const contextGlobals = { document: documentStub };
  if (fetchImpl) contextGlobals.fetch = fetchImpl;
  if (location) contextGlobals.location = location;

  const context = vm.createContext(contextGlobals);
  vm.runInContext(scriptMatch[1], context);
  return { context, tbody, emptyState, searchInput, filterButtons };
}

// Finds the filter-button stub for a given data-filter value and clicks it,
// exercising the real click -> activeFilter change -> render() path instead
// of only asserting the button's markup exists.
function clickFilter(filterButtons, filterValue) {
  const button = filterButtons.find((b) => b.getAttribute("data-filter") === filterValue);
  if (!button) throw new Error(`clickFilter: no button found for data-filter="${filterValue}"`);
  button.click();
}

// Column order in every rendered row, per the <thead> in html-tracker.js.
const ROW_COLUMNS = ["company", "title", "location", "compensation", "fit", "status", "links", "resume", "coverLetterStatus", "stale", "notes"];

// Splits a single <tr>...</tr> row's inner HTML into one string per column,
// by column name — so a test can assert on exactly the cell it cares about
// (e.g. "coverLetterStatus") instead of a bare "some <td> somewhere shows a
// dash" match that any other empty column would also satisfy.
function rowCell(rowHtml, columnName) {
  const cells = rowHtml.split(/<\/?td>/u).filter((_, i) => i % 2 === 1);
  const index = ROW_COLUMNS.indexOf(columnName);
  if (index === -1) throw new Error(`rowCell: unknown column "${columnName}"`);
  return cells[index];
}

test("html tracker renders a table with all columns including Cover Letter", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      location: "Remote",
      compensation: { minimum: 150000, maximum: 200000, currency: "USD" },
      fit: { level: "High", rationale: "Great fit" },
      application: { status: "applied", appliedAt: "2026-07-01" },
      urls: { job: "https://jobs.example.com/fabrikam/pm", apply: "https://apply.example.com" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      coverLetter: { status: "review-needed" },
      notes: ["Test note"],
    },
  ];

  const output = renderHtmlTracker(roles);

  // Check that the HTML includes the Cover Letter header
  assert.match(output, /<th.*?data-sortable=["']coverLetterStatus["'].*?>Cover Letter<\/th>/i);

  // Check that the data includes the cover letter status
  assert.match(output, /review-needed/);

  // Check that the script data includes coverLetterStatus
  assert.match(output, /"coverLetterStatus": "review-needed"/);
});

test("html tracker shows empty dash for missing Cover Letter status", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      location: "Remote",
      application: { status: "interested" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      // No coverLetter field
    },
  ];

  const output = renderHtmlTracker(roles);
  const { tbody } = runClientScript(output);
  const row = tbody.innerHTML.match(/<tr>.*?<\/tr>/u)[0];

  // The script data should include empty string for missing cover letter status
  assert.match(output, /"coverLetterStatus": ""/);

  // The actual rendered Cover Letter cell (not just some other empty column) shows a dash.
  assert.equal(rowCell(row, "coverLetterStatus"), "—");
});

test("html tracker HTML-escapes special characters in Cover Letter status when rendering", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      location: "Remote",
      application: { status: "interested" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      coverLetter: { status: "review & needed <urgently>" },
    },
  ];

  const output = renderHtmlTracker(roles);
  const { tbody } = runClientScript(output);
  const row = tbody.innerHTML.match(/<tr>.*?<\/tr>/u)[0];

  // The JSON data should contain the raw status (not escaped)
  assert.match(output, /"coverLetterStatus": "review & needed <urgently>"/);

  // The actual rendered Cover Letter cell is escaped, not just passed through raw.
  assert.equal(rowCell(row, "coverLetterStatus"), "review &amp; needed &lt;urgently&gt;");
});

test("html tracker renders empty list correctly with Cover Letter header", () => {
  const output = renderHtmlTracker([]);

  assert.match(output, /<th.*?data-sortable=["']coverLetterStatus["'].*?>Cover Letter<\/th>/i);
  assert.match(output, /No roles match your search\/filter/);
});

test("html tracker includes coverLetterStatus in rowsData object", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      location: "Remote",
      application: { status: "applied", appliedAt: "2026-07-01" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      coverLetter: { status: "submitted" },
    },
  ];

  const output = renderHtmlTracker(roles);

  // The JSON data embedded in the script should have the coverLetterStatus field
  assert.match(output, /"coverLetterStatus": "submitted"/);
});

// #120 — the status badge previously showed a generic bucket label ("Not
// applied") with the raw free-text status ("Interested") stacked
// underneath in an unlabeled <small> line, reading as two unrelated pieces
// of information. The badge now shows the specific status text directly
// (it's always at least as informative as the bucket label), falling back
// to the bucket label only when there's no raw status text at all.
test("html tracker status badge shows the specific status text, not a disconnected bucket label + sub-line", () => {
  const roles = [
    { id: "role-001", company: "Fabrikam AI", title: "Product Manager", location: "Remote", application: { status: "interested" } },
  ];

  const output = renderHtmlTracker(roles);
  const { tbody } = runClientScript(output);

  // The old disconnected two-line markup (bucket label badge + unlabeled <small> raw text) is gone.
  assert.doesNotMatch(output, /<\/span><br><small>/);
  // The badge shows the raw status text directly, not the generic bucket label.
  assert.match(tbody.innerHTML, /<span class="badge badge-not-applied">Interested<\/span>/);
});

test("html tracker status badge falls back to the bucket label when there's no raw status text", () => {
  const roles = [{ id: "role-001", company: "Fabrikam AI", title: "Product Manager", location: "Remote" }];

  const output = renderHtmlTracker(roles);
  const { tbody } = runClientScript(output);

  assert.match(tbody.innerHTML, /<span class="badge badge-not-applied">Not applied<\/span>/);
});

// #121 — scoped UI/UX improvements borrowed from a more polished reference dashboard.

test("html tracker marks a not-applied role with a rendered resume as ready to apply, and badges it accordingly", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
      // No application/status field — nothing to distinguish "ready" from "not started" except the resume.
    },
  ];

  const output = renderHtmlTracker(roles);
  const { tbody } = runClientScript(output);

  assert.match(output, /"readyToApply": true/);
  assert.match(output, /data-filter="ready-to-apply"/);
  // statusBucket stays the stable, canonical "not-applied" — readyToApply is a display-only dimension layered on top.
  assert.match(output, /"statusBucket": "not-applied"/);
  assert.match(tbody.innerHTML, /<span class="badge badge-ready-to-apply">Ready to apply<\/span>/);
});

test("html tracker does not mark a not-applied role without a resume as ready to apply", () => {
  const roles = [{ id: "role-001", company: "Fabrikam AI", title: "Product Manager" }];

  const output = renderHtmlTracker(roles);
  const { tbody } = runClientScript(output);

  assert.match(output, /"readyToApply": false/);
  assert.match(tbody.innerHTML, /<span class="badge badge-not-applied">Not applied<\/span>/);
});

test("html tracker does not mark a role past the not-applied stage as ready to apply, even with a resume", () => {
  // isReadyToApply's bucket guard is the whole point of the predicate — a role that has
  // already applied (or moved further) is not "ready to apply," it already did. This guards
  // against a regression that drops the `bucket === "not-applied"` check and treats any
  // resume-having role as ready to apply regardless of its actual status.
  const roles = [
    { id: "role-001", company: "Fabrikam AI", title: "PM", application: { status: "applied", appliedAt: "2026-07-01" }, resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" } },
  ];

  const output = renderHtmlTracker(roles);
  const { tbody } = runClientScript(output);

  assert.match(output, /"readyToApply": false/);
  assert.match(output, /"statusBucket": "applied"/);
  assert.match(tbody.innerHTML, /<span class="badge badge-applied">Applied 2026-07-01<\/span>/);
  assert.doesNotMatch(tbody.innerHTML, /badge-ready-to-apply/);
});

test("html tracker badges a ready-to-apply role as 'ready to apply' even when it also has raw status text (e.g. Interested)", () => {
  // A role can be both readyToApply (not-applied bucket + has a resume) AND carry raw status
  // text like "Interested" — the badge must still read as ready-to-apply (teal), not the
  // generic not-applied amber, so filter membership and the badge visually agree. See the
  // code-quality lens finding this test guards against: readyToApply used to be computed
  // independently of the badge's color, so this exact combination silently disagreed.
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "interested" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderHtmlTracker(roles);
  const { tbody } = runClientScript(output);

  assert.match(output, /"readyToApply": true/);
  // Raw text still wins for the label ("Interested" is more specific than the generic fallback)...
  assert.match(tbody.innerHTML, /<span class="badge badge-ready-to-apply">Interested<\/span>/);
});

test("html tracker's Ready to apply filter button actually filters rows when clicked, not just exists in the markup", () => {
  const roles = [
    { id: "role-001", company: "Fabrikam AI", title: "PM", resume: { outputPath: "outputs/resumes/a.docx" } },
    { id: "role-002", company: "TechCorp", title: "Engineer", application: { status: "applied", appliedAt: "2026-07-01" } },
    { id: "role-003", company: "StartupXYZ", title: "Lead" }, // not-applied, no resume — should NOT show
  ];

  const output = renderHtmlTracker(roles);
  const { tbody, filterButtons } = runClientScript(output);

  assert.equal((tbody.innerHTML.match(/<tr>/gu) || []).length, 3, "all 3 roles render before any filter is applied");

  clickFilter(filterButtons, "ready-to-apply");

  assert.equal((tbody.innerHTML.match(/<tr>/gu) || []).length, 1, "only the one ready-to-apply role should remain after filtering");
  assert.match(tbody.innerHTML, /Fabrikam AI/u);
  assert.doesNotMatch(tbody.innerHTML, /TechCorp/u);
  assert.doesNotMatch(tbody.innerHTML, /StartupXYZ/u);
});

test("html tracker splits the not-applied stat into Ready to apply and Not started, without double-counting", () => {
  const roles = [
    { id: "role-001", company: "Fabrikam AI", title: "PM", resume: { outputPath: "outputs/resumes/a.docx" } },
    { id: "role-002", company: "TechCorp", title: "Engineer" },
  ];

  const output = renderHtmlTracker(roles);

  assert.match(output, /<div class="stat-value">1<\/div><div class="stat-label">🎯 Ready to apply<\/div>/);
  assert.match(output, /<div class="stat-value">1<\/div><div class="stat-label">⏳ Not started<\/div>/);
  // The funnel's own "Not Applied" stage is untouched — it still reflects the full, undivided bucket count.
  assert.match(output, /funnel-stage">Not Applied<\/div><div class="funnel-count">2</);
});

test("html tracker's applied-funnel percentage covers the zero-roles guard, exact halves, and non-exact rounding", () => {
  assert.match(renderHtmlTracker([]), /<div class="stat-value">0%<\/div><div class="stat-label">📈 Applied funnel<\/div>/);

  const halfApplied = [
    { id: "r1", company: "A", title: "PM", application: { status: "applied", appliedAt: "2026-07-01" } },
    { id: "r2", company: "B", title: "Eng" },
  ];
  assert.match(renderHtmlTracker(halfApplied), /<div class="stat-value">50%<\/div><div class="stat-label">📈 Applied funnel<\/div>/);

  // 1 of 3 reached applied-or-beyond → 33.33...%, rounds to 33.
  const oneOfThree = [
    { id: "r1", company: "A", title: "PM", application: { status: "applied", appliedAt: "2026-07-01" } },
    { id: "r2", company: "B", title: "Eng" },
    { id: "r3", company: "C", title: "Lead" },
  ];
  assert.match(renderHtmlTracker(oneOfThree), /<div class="stat-value">33%<\/div><div class="stat-label">📈 Applied funnel<\/div>/);

  // All roles reached applied-or-beyond (including a rejected one, which still counts) → 100%.
  const allApplied = [
    { id: "r1", company: "A", title: "PM", application: { status: "applied", appliedAt: "2026-07-01" } },
    { id: "r2", company: "B", title: "Eng", application: { status: "rejected", appliedAt: "2026-06-01" } },
  ];
  assert.match(renderHtmlTracker(allApplied), /<div class="stat-value">100%<\/div><div class="stat-label">📈 Applied funnel<\/div>/);
});

test("html tracker renders a deterministic, non-uniform per-company color dot", () => {
  const output = renderHtmlTracker([
    { id: "role-001", company: "Fabrikam AI", title: "PM" },
    { id: "role-002", company: "Fabrikam AI", title: "Eng" },
    { id: "role-003", company: "Northwind Traders", title: "Lead" },
  ]);
  const { context, tbody } = runClientScript(output);

  // Same company, called twice, always yields the same color (determinism).
  assert.equal(context.companyColor("Fabrikam AI"), context.companyColor("Fabrikam AI"));
  // The two Fabrikam AI rows render the identical dot color.
  const dotColors = [...tbody.innerHTML.matchAll(/class="company-dot" style="background:(#[0-9a-f]{6})"/gu)].map((m) => m[1]);
  assert.equal(dotColors.length, 3);
  assert.equal(dotColors[0], dotColors[1], "both Fabrikam AI rows must share the same dot color");
  // A different company name produces a color from the same fixed palette (not necessarily
  // different — collisions are an accepted tradeoff of a small fixed palette — but real,
  // computed, and not the placeholder default).
  assert.match(dotColors[2], /^#[0-9a-f]{6}$/u);
});

test("html tracker's company color is case-insensitive, so casing drift doesn't fracture the same-company guarantee", () => {
  const output = renderHtmlTracker([{ id: "role-001", company: "Fabrikam AI" }]);
  const { context } = runClientScript(output);

  assert.equal(context.companyColor("Fabrikam AI"), context.companyColor("FABRIKAM AI"));
  assert.equal(context.companyColor("Fabrikam AI"), context.companyColor("fabrikam ai"));
});

test("html tracker shows a dash for a role with no company at all", () => {
  const output = renderHtmlTracker([{ id: "role-001", title: "Product Manager" }]);
  const { context } = runClientScript(output);

  assert.equal(context.companyCell({}), "—");
  assert.equal(context.companyCell({ company: "" }), "—");
});

test("html tracker escapes HTML-special characters in company and location text", () => {
  const roles = [{ id: "role-001", company: 'Acme & <Sons>', title: "PM", location: 'Remote <script>' }];

  const output = renderHtmlTracker(roles);
  const { tbody } = runClientScript(output);
  const row = tbody.innerHTML.match(/<tr>.*?<\/tr>/u)[0];

  assert.match(rowCell(row, "company"), /Acme &amp; &lt;Sons&gt;/u);
  assert.doesNotMatch(rowCell(row, "company"), /<Sons>/u);
  assert.match(rowCell(row, "location"), /Remote &lt;script&gt;/u);
  assert.doesNotMatch(rowCell(row, "location"), /<script>/u);
});

test("html tracker renders location as a styled pill, colored correctly across every work-mode variant", () => {
  const roles = [
    { id: "r1", company: "A", title: "PM", location: "Remote" },
    { id: "r2", company: "B", title: "Eng", location: "Seattle, WA (Hybrid)" },
    { id: "r3", company: "C", title: "Lead", location: "San Francisco, CA (On-site)" },
    { id: "r4", company: "D", title: "Dir", location: "REMOTE" }, // case-insensitivity
    { id: "r5", company: "E", title: "VP", location: "Austin, TX" }, // no work-mode keyword
  ];

  const output = renderHtmlTracker(roles);
  const { tbody } = runClientScript(output);

  assert.match(tbody.innerHTML, /<span class="loc-pill loc-remote">Remote<\/span>/);
  assert.match(tbody.innerHTML, /<span class="loc-pill loc-hybrid">Seattle, WA \(Hybrid\)<\/span>/);
  assert.match(tbody.innerHTML, /<span class="loc-pill loc-onsite">San Francisco, CA \(On-site\)<\/span>/);
  assert.match(tbody.innerHTML, /<span class="loc-pill loc-remote">REMOTE<\/span>/);
  assert.match(tbody.innerHTML, /<span class="loc-pill loc-other">Austin, TX<\/span>/);
});

test("html tracker renders the resume cell as a clickable link with the outputs\\/ prefix stripped, and a dash when absent", () => {
  const roles = [
    { id: "r1", company: "A", title: "PM", resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" } },
    { id: "r2", company: "B", title: "Eng", resume: { outputPath: "resumes/no-prefix.docx" } },
  ];

  const output = renderHtmlTracker(roles);
  const { context, tbody } = runClientScript(output);

  // outputs/ prefix stripped so the href resolves relative to tracker.html's own location.
  assert.match(tbody.innerHTML, /<a href="resumes\/fabrikam-ai\.docx" target="_blank" rel="noopener">fabrikam-ai\.docx<\/a>/);
  // A path that never had the prefix passes through unchanged.
  assert.match(tbody.innerHTML, /<a href="resumes\/no-prefix\.docx" target="_blank" rel="noopener">no-prefix\.docx<\/a>/);
  // Calling resumeCell directly isolates the no-resume case unambiguously (a full-row
  // assertion can't distinguish "resume cell is a dash" from "some other empty column is").
  assert.equal(context.resumeCell({ resume: "" }), "—");
  assert.equal(context.resumeCell({}), "—");
});

test("html tracker renders a pipeline funnel section with stage counts", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "PM",
      application: { status: "interested" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-002",
      company: "TechCorp",
      title: "Engineer",
      application: { status: "applied", appliedAt: "2026-07-15" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-003",
      company: "StartupXYZ",
      title: "Lead",
      application: { status: "interview", appliedAt: "2026-07-10" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-004",
      company: "BigCorp",
      title: "Manager",
      application: { status: "offer", appliedAt: "2026-07-08" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-005",
      company: "NopeInc",
      title: "Rejected",
      application: { status: "rejected", appliedAt: "2026-07-01" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-006",
      company: "WithdrawnLLC",
      title: "Withdrawn",
      application: { status: "withdrawn", appliedAt: "2026-07-02" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
    {
      id: "role-007",
      company: "GhostedCo",
      title: "Ghosted",
      application: { status: "ghosted", appliedAt: "2026-06-15" },
      resume: { outputPath: "outputs/resumes/test.docx" },
    },
  ];

  const output = renderHtmlTracker(roles);

  // Check that the funnel section exists and contains stage counts
  assert.match(output, /<.*class=["']funnel/i);

  // Check for stage counts (not-applied, applied, interview, offer, rejected, withdrawn, ghosted)
  // Use regex that matches the funnel div structure
  assert.match(output, /funnel-stage.*?Not Applied[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Applied[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Interview[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Offer[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Rejected[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Withdrawn[\s\S]*?funnel-count.*?>1</i);
  assert.match(output, /funnel-stage.*?Ghosted[\s\S]*?funnel-count.*?>1</i);
});

test("html tracker displays stale badges for old applications", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "applied", appliedAt: "2026-07-01" }, // 19 days old (threshold: 14)
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderHtmlTracker(roles, {
    stalenessThresholds: { applied: 14, interview: 7, offer: 3, "not-applied": 30, other: 21 },
  });

  // Check for stale badge markup in the embedded JSON
  assert.match(output, /"isStale":\s*true/);
  assert.match(output, /"daysSinceTouch":\s*\d+/);
  assert.match(output, /"suggestedNextAction":\s*"Follow up on application status"/);
});

test("html tracker shows no stale badge for recent applications", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "applied", appliedAt: "2026-07-15" }, // 5 days old (threshold: 14)
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderHtmlTracker(roles, {
    stalenessThresholds: { applied: 14, interview: 7, offer: 3, "not-applied": 30, other: 21 },
  });

  // Check for non-stale status in embedded JSON
  assert.match(output, /"isStale":\s*false/);
  assert.match(output, /"daysSinceTouch":\s*\d+/);
  assert.match(output, /"suggestedNextAction":\s*null/);
});

test("html tracker never marks terminal statuses as stale", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "ghosted", appliedAt: "2026-07-01" }, // 19 days old, but ghosted
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderHtmlTracker(roles, {
    stalenessThresholds: { applied: 14, interview: 7, offer: 3, "not-applied": 30, other: 21 },
  });

  // Even though it's old, ghosted should never be marked stale
  assert.match(output, /"isStale":\s*false/);
  assert.match(output, /"suggestedNextAction":\s*null/);
});

test("html tracker includes Stale filter button", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "applied", appliedAt: "2026-07-01" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderHtmlTracker(roles);

  // Check for the Stale filter button
  assert.match(output, /data-filter="stale"/i);
});

test("html tracker table has sortable stale column with data attributes", () => {
  const roles = [
    {
      id: "role-001",
      company: "Fabrikam AI",
      title: "Product Manager",
      application: { status: "applied", appliedAt: "2026-07-01" },
      resume: { outputPath: "outputs/resumes/fabrikam-ai.docx" },
    },
  ];

  const output = renderHtmlTracker(roles, {
    stalenessThresholds: { applied: 14, interview: 7, offer: 3, "not-applied": 30, other: 21 },
  });

  // Check for a Stale column in the table with sortable attribute
  assert.match(output, /<th.*?data-sortable=["']stale["'].*?>Stale<\/th>/i);

  // Check that stale row data is included
  assert.match(output, /"isStale":/);
  assert.match(output, /"daysSinceTouch":/);
  assert.match(output, /"suggestedNextAction":/);
});

// Coverage for design plan 0006 D4 (issue #131): live reload via polling.
// Executes the real embedded pollForTrackerChanges() function against a
// stubbed fetch/location — not just pattern-matching the script's source
// text — so a broken poll-vs-reload comparison would actually fail here.

function fetchStub(responses) {
  let callIndex = 0;
  return async () => {
    const response = responses[Math.min(callIndex, responses.length - 1)];
    callIndex += 1;
    return response;
  };
}

test("pollForTrackerChanges is a no-op when fetch is unavailable (e.g. opened directly from disk)", async () => {
  const html = renderHtmlTracker([]);
  const { context } = runClientScript(html);
  assert.strictEqual(typeof context.fetch, "undefined");
  await assert.doesNotReject(context.pollForTrackerChanges());
});

test("pollForTrackerChanges establishes a baseline on the first poll without reloading", async () => {
  const html = renderHtmlTracker([]);
  let reloaded = false;
  const { context } = runClientScript(html, {
    fetchImpl: fetchStub([{ ok: true, json: async () => ({ path: "tracker.html", mtimeMs: 1000 }) }]),
    location: { reload: () => { reloaded = true; } },
  });

  await context.pollForTrackerChanges();
  assert.strictEqual(reloaded, false, "the first poll only records a baseline, nothing to compare against yet");
});

test("pollForTrackerChanges reloads the page once the tracker's mtime actually changes", async () => {
  const html = renderHtmlTracker([]);
  let reloaded = false;
  const { context } = runClientScript(html, {
    fetchImpl: fetchStub([
      { ok: true, json: async () => ({ path: "tracker.html", mtimeMs: 1000 }) },
      { ok: true, json: async () => ({ path: "tracker.html", mtimeMs: 1000 }) },
      { ok: true, json: async () => ({ path: "tracker.html", mtimeMs: 2000 }) },
    ]),
    location: { reload: () => { reloaded = true; } },
  });

  await context.pollForTrackerChanges(); // baseline: 1000
  await context.pollForTrackerChanges(); // unchanged: 1000 — no reload
  assert.strictEqual(reloaded, false, "an unchanged mtime between polls must not trigger a reload");

  await context.pollForTrackerChanges(); // changed: 2000 — reload
  assert.strictEqual(reloaded, true, "a changed mtime must trigger exactly one reload");
});

test("pollForTrackerChanges fails silently on a fetch error (server not running) rather than throwing", async () => {
  const html = renderHtmlTracker([]);
  let reloaded = false;
  const { context } = runClientScript(html, {
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
    location: { reload: () => { reloaded = true; } },
  });

  await assert.doesNotReject(context.pollForTrackerChanges());
  assert.strictEqual(reloaded, false);
});

test("pollForTrackerChanges ignores a non-ok response instead of treating it as a change", async () => {
  const html = renderHtmlTracker([]);
  let reloaded = false;
  const { context } = runClientScript(html, {
    fetchImpl: fetchStub([{ ok: false, json: async () => ({}) }]),
    location: { reload: () => { reloaded = true; } },
  });

  await context.pollForTrackerChanges();
  assert.strictEqual(reloaded, false);
});

test("pollForTrackerChanges fails silently when the response body isn't valid JSON", async () => {
  const html = renderHtmlTracker([]);
  let reloaded = false;
  const { context } = runClientScript(html, {
    fetchImpl: fetchStub([
      {
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token in JSON");
        },
      },
    ]),
    location: { reload: () => { reloaded = true; } },
  });

  await assert.doesNotReject(context.pollForTrackerChanges());
  assert.strictEqual(reloaded, false);
});

test("pollForTrackerChanges detects tracker.html appearing after starting out absent (mtimeMs: null is not mistaken for 'no baseline yet')", async () => {
  // Regression: an earlier version used `lastKnownTrackerMtime === null` as
  // both the "haven't polled yet" sentinel AND a legitimate value (serve.js
  // reports mtimeMs: null when tracker.html doesn't exist), so a file that
  // appeared after the page loaded could never be detected — every poll
  // would keep re-establishing "no baseline yet" instead of comparing.
  const html = renderHtmlTracker([]);
  let reloaded = false;
  const { context } = runClientScript(html, {
    fetchImpl: fetchStub([
      { ok: true, json: async () => ({ path: "tracker.html", mtimeMs: null }) },
      { ok: true, json: async () => ({ path: "tracker.html", mtimeMs: null }) },
      { ok: true, json: async () => ({ path: "tracker.html", mtimeMs: 1000 }) },
    ]),
    location: { reload: () => { reloaded = true; } },
  });

  await context.pollForTrackerChanges(); // baseline: absent (null)
  await context.pollForTrackerChanges(); // still absent: null === null — no reload
  assert.strictEqual(reloaded, false);

  await context.pollForTrackerChanges(); // now exists: 1000 !== null — reload
  assert.strictEqual(reloaded, true, "tracker.html appearing for the first time must be detected as a change");
});

test("pollForTrackerChanges ignores an overlapping poll started while one is already in flight", async () => {
  // Regression: with no re-entrancy guard, a slow poll (still awaiting
  // fetch) overlapping with a second poll firing on the next interval tick
  // could race on the shared lastKnownTrackerMtime/hasBaseline state.
  let resolveFirstFetch;
  let fetchCallCount = 0;
  const html = renderHtmlTracker([]);
  let reloaded = false;
  const { context } = runClientScript(html, {
    fetchImpl: () => {
      fetchCallCount += 1;
      return new Promise((resolve) => {
        resolveFirstFetch = () => resolve({ ok: true, json: async () => ({ path: "tracker.html", mtimeMs: 1000 }) });
      });
    },
    location: { reload: () => { reloaded = true; } },
  });

  const firstPoll = context.pollForTrackerChanges(); // still pending — fetch hasn't resolved yet
  await context.pollForTrackerChanges(); // fires while the first is in flight — should be a no-op
  assert.strictEqual(fetchCallCount, 1, "an overlapping call must not start a second fetch while one is already in flight");

  resolveFirstFetch();
  await firstPoll;
  assert.strictEqual(reloaded, false, "a single in-flight poll establishing the baseline must not itself trigger a reload");
});

// Coverage for design plan 0006 D5 (issue #132): the onboarding checklist
// view, and the dashboard/checklist toggle in renderHtmlTracker.

test("renderOnboardingChecklist covers all 10 steps in order and counts done accurately", () => {
  const state = defaultOnboardingState();
  state.materialIngested = true;
  state.sections.basicInfo = true;
  state.sections.workHistory = true;

  const html = renderOnboardingChecklist(state);

  // setupComplete is already true in defaultOnboardingState() (setup itself
  // just ran) — so this is 4, not 3: setup + materialIngested + 2 sections.
  assert.match(html, /Onboarding: 4 of 10 steps/);
  ["Workspace created", "Material ingested", "Basic information", "Work history", "Education", "Target role", "Location and work mode", "Salary and compensation", "Constraints and deal breakers", "First role added"].forEach(
    (label) => assert.match(html, new RegExp(label)),
  );
});

test("renderOnboardingChecklist shows 1 of 10 for the fresh default state (setup itself already counts as done)", () => {
  const html = renderOnboardingChecklist(defaultOnboardingState());
  assert.match(html, /Onboarding: 1 of 10 steps/);
  assert.match(html, /onboarding-check-done">✓<\/span><span class="onboarding-item-label">Workspace created/);
});

test("renderOnboardingChecklist shows 10 of 10 once every step is complete", () => {
  const state = defaultOnboardingState();
  state.materialIngested = true;
  state.firstRoleAdded = true;
  Object.keys(state.sections).forEach((key) => { state.sections[key] = true; });
  const html = renderOnboardingChecklist(state);
  assert.match(html, /Onboarding: 10 of 10 steps/);
});

test("renderOnboardingChecklist tolerates a missing sections object entirely", () => {
  assert.doesNotThrow(() => renderOnboardingChecklist({}));
  assert.match(renderOnboardingChecklist({}), /Onboarding: 0 of 10 steps/);
});

test("renderHtmlTracker without onboardingState renders exactly as before — checklist hidden, no pill", () => {
  const html = renderHtmlTracker([]);
  assert.match(html, /class="onboarding-section" style="display:none"/, "with no onboardingState passed, the checklist section must stay hidden");
  assert.doesNotMatch(html, /Onboarding complete/);
  assert.match(html, /class="dashboard-section" style="display:block"/);
});

test("renderHtmlTracker shows the checklist (and hides the dashboard) while onboarding is incomplete", () => {
  const state = defaultOnboardingState();
  state.materialIngested = true;
  const html = renderHtmlTracker([], { onboardingState: state });

  assert.match(html, /class="onboarding-section" style="display:block"/);
  assert.match(html, /class="dashboard-section" style="display:none"/);
  assert.match(html, /Onboarding: 2 of 10 steps/);
  assert.doesNotMatch(html, /Onboarding complete/);
});

test("renderHtmlTracker shows the normal dashboard plus a completion pill once onboarding is done", () => {
  const state = defaultOnboardingState();
  state.materialIngested = true;
  state.firstRoleAdded = true;
  Object.keys(state.sections).forEach((key) => { state.sections[key] = true; });
  const html = renderHtmlTracker([], { onboardingState: state });

  assert.match(html, /class="onboarding-section" style="display:none"/);
  assert.match(html, /class="dashboard-section" style="display:block"/);
  assert.match(html, /onboarding-progress-pill-complete">✓ Onboarding complete/);
});

test("renderHtmlTracker's dashboard script still works normally when the checklist is showing (table markup stays present, just hidden)", () => {
  const roles = [{ id: "role-001", company: "Fabrikam AI", title: "PM", application: { status: "applied" } }];
  const state = defaultOnboardingState();
  const html = renderHtmlTracker(roles, { onboardingState: state });
  const { tbody } = runClientScript(html);
  assert.match(tbody.innerHTML, /Fabrikam AI/, "the dashboard's own script must still render rows into the (hidden) table, not crash on a missing element");
});
