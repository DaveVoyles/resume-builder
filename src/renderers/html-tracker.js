"use strict";

const { formatNextAction, normalizeRole } = require("../core/role-view");
const { computeStaleness, DEFAULT_THRESHOLDS } = require("../core/staleness");

const STATUS_LABELS = {
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
  "not-applied": "Not applied",
  other: "Other",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

// Builds the notes cell server-side so every line is HTML-escaped before the
// `<br>` separators are added; the client then inserts this pre-escaped
// string directly instead of re-escaping (which would show literal `<br>`).
function notesHtml(role) {
  const notes = Array.isArray(role.notes) ? role.notes : role.notes ? [role.notes] : [];
  const nextAction = formatNextAction(role);
  const actions = nextAction ? [`Next action: ${nextAction}`] : [];
  const questions = Array.isArray(role.followUpQuestions) ? role.followUpQuestions.map((question) => `Question: ${question}`) : [];
  const lines = notes.concat(actions, questions);
  return lines.length ? lines.map(escapeHtml).join("<br>") : "";
}

// Prevents workspace text (company names, notes, etc.) that happens to
// contain "</script>" from breaking out of the embedded <script> block.
function jsonScriptSafe(value) {
  return JSON.stringify(value, null, 2).replace(/<\/(script)/giu, "<\\/$1");
}

function formatAvgCompensation(roles) {
  const withRange = roles
    .map((role) => role.compensationRange)
    .filter((range) => range.minimum !== undefined && range.maximum !== undefined);
  if (withRange.length === 0) return "—";
  const avgMin = Math.round(withRange.reduce((sum, range) => sum + range.minimum, 0) / withRange.length);
  const avgMax = Math.round(withRange.reduce((sum, range) => sum + range.maximum, 0) / withRange.length);
  const fmt = (value) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  return `${fmt(avgMin)} – ${fmt(avgMax)}`;
}

// Renders a single self-contained HTML file: no external CDN or network
// dependency, so it stays usable offline and safe to open from a private
// workspace. `options.title` lets a candidate/agent brand the page (e.g. with
// the candidate's name) without editing renderer code.
function renderHtmlTracker(roles, options = {}) {
  const title = options.title || "Application Tracker";
  const generatedAt = options.generatedAt || new Date().toISOString();
  const stalenessThresholds = options.stalenessThresholds || DEFAULT_THRESHOLDS;

  // Pair each source role with its normalized view, then sort both in lockstep
  // so `notesHtml(sortedSourceRoles[index])` below stays aligned with `normalized`.
  const paired = roles.map((role) => ({ role, view: normalizeRole(role) })).sort((a, b) => a.view.sortKey.localeCompare(b.view.sortKey));
  const sortedSourceRoles = paired.map((entry) => entry.role);
  const normalized = paired.map((entry) => entry.view);

  const total = normalized.length;
  const counts = normalized.reduce(
    (acc, role) => {
      acc[role.statusBucket] = (acc[role.statusBucket] || 0) + 1;
      return acc;
    },
    { applied: 0, rejected: 0, "not-applied": 0, ghosted: 0, other: 0, interview: 0, offer: 0, withdrawn: 0 },
  );

  const rowsData = normalized.map((role, index) => {
    // Compute staleness for this role
    const roleWithBucket = {
      ...sortedSourceRoles[index],
      statusBucket: role.statusBucket,
    };
    const staleness = computeStaleness(roleWithBucket, stalenessThresholds);

    return {
      company: role.company || "",
      title: role.title || "",
      location: role.location || "",
      compensation: role.compensation || "",
      fit: role.fit || "",
      applied: role.applied || "",
      statusBucket: role.statusBucket,
      jobUrl: role.jobUrl || "",
      applyUrl: role.applyUrl || "",
      resume: role.resume || "",
      coverLetterStatus: role.coverLetterStatus || "",
      notes: notesHtml(sortedSourceRoles[index]),
      isStale: staleness.isStale,
      daysSinceTouch: staleness.daysSinceTouch,
      suggestedNextAction: staleness.suggestedNextAction,
    };
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 2rem; background: #f8fafc; color: #0f172a; }
  h1 { margin: 0 0 0.25rem; font-size: 1.75rem; }
  .subtitle { color: #64748b; margin: 0 0 1.5rem; font-size: 0.85rem; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .stat-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem 1.25rem; }
  .stat-value { font-size: 1.5rem; font-weight: 700; }
  .stat-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
  .funnel { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; margin-bottom: 1.5rem; }
  .funnel td { padding: 0.75rem 1rem; border-right: 1px solid #e2e8f0; text-align: center; }
  .funnel td:last-child { border-right: none; }
  .funnel-stage { font-weight: 600; color: #334155; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .funnel-count { font-size: 1.25rem; font-weight: 700; color: #0284c7; }
  .controls { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; align-items: center; }
  .controls input { flex: 1; min-width: 200px; padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 0.9rem; }
  .controls button { padding: 0.4rem 0.8rem; border: 1px solid #cbd5e1; background: #fff; border-radius: 0.5rem; cursor: pointer; font-size: 0.8rem; }
  .controls button.active { background: #0284c7; color: #fff; border-color: #0284c7; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  th, td { text-align: left; padding: 0.65rem 0.85rem; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; vertical-align: top; }
  th { background: #f1f5f9; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; cursor: pointer; user-select: none; }
  th:hover { background: #e2e8f0; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; }
  .badge-applied { background: #dcfce7; color: #166534; }
  .badge-interview { background: #dbeafe; color: #1e40af; }
  .badge-offer { background: #ede9fe; color: #5b21b6; }
  .badge-rejected { background: #fee2e2; color: #991b1b; }
  .badge-withdrawn { background: #f1f5f9; color: #475569; }
  .badge-ghosted { background: #fed7aa; color: #92400e; }
  .badge-not-applied { background: #fef3c7; color: #92400e; }
  .badge-other { background: #e2e8f0; color: #334155; }
  .stale-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 0.375rem; background: #fcd34d; color: #92400e; font-size: 0.7rem; font-weight: 600; margin-right: 0.25rem; }
  .empty-state { padding: 2rem; text-align: center; color: #64748b; }
  a { color: #0284c7; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="subtitle">Generated ${escapeHtml(generatedAt)} from <code>roles.tracked.json</code>. Rebuild with <code>build-tracker --format html</code>; do not hand-edit.</p>

  <div class="stats">
    <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total roles</div></div>
    <div class="stat-card"><div class="stat-value">${counts.applied}</div><div class="stat-label">Applied</div></div>
    <div class="stat-card"><div class="stat-value">${counts["not-applied"]}</div><div class="stat-label">Not applied yet</div></div>
    <div class="stat-card"><div class="stat-value">${counts.rejected}</div><div class="stat-label">Rejected</div></div>
    <div class="stat-card"><div class="stat-value">${formatAvgCompensation(normalized)}</div><div class="stat-label">Avg. compensation</div></div>
  </div>

  <table class="funnel">
    <tr>
      <td><div class="funnel-stage">Not Applied</div><div class="funnel-count">${counts["not-applied"]}</div></td>
      <td><div class="funnel-stage">Applied</div><div class="funnel-count">${counts.applied}</div></td>
      <td><div class="funnel-stage">Interview</div><div class="funnel-count">${counts.interview}</div></td>
      <td><div class="funnel-stage">Offer</div><div class="funnel-count">${counts.offer}</div></td>
      <td><div class="funnel-stage">Rejected</div><div class="funnel-count">${counts.rejected}</div></td>
      <td><div class="funnel-stage">Withdrawn</div><div class="funnel-count">${counts.withdrawn}</div></td>
      <td><div class="funnel-stage">Ghosted</div><div class="funnel-count">${counts.ghosted}</div></td>
    </tr>
  </table>

  <div class="controls">
    <input type="text" id="search" placeholder="Search company, title, or location...">
    <button data-filter="all" class="active">All</button>
    <button data-filter="not-applied">Not applied</button>
    <button data-filter="applied">Applied</button>
    <button data-filter="interview">Interview</button>
    <button data-filter="offer">Offer</button>
    <button data-filter="rejected">Rejected</button>
    <button data-filter="withdrawn">Withdrawn</button>
    <button data-filter="ghosted">Ghosted</button>
    <button data-filter="stale">Stale</button>
  </div>

  <table id="rolesTable">
    <thead>
      <tr>
        <th data-sortable="company">Company</th><th data-sortable="title">Role</th><th data-sortable="location">Location</th><th data-sortable="compensation">Compensation</th><th data-sortable="fit">Fit</th><th data-sortable="statusBucket">Status</th><th>Links</th><th data-sortable="resume">Resume</th><th data-sortable="coverLetterStatus">Cover Letter</th><th data-sortable="stale">Stale</th><th data-sortable="notes">Notes</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>
  <p class="empty-state" id="emptyState" style="display:none;">No roles match your search/filter.</p>

  <script>
    const roles = ${jsonScriptSafe(rowsData)};
    const statusLabels = ${jsonScriptSafe(STATUS_LABELS)};
    const tbody = document.querySelector("#rolesTable tbody");
    const emptyState = document.getElementById("emptyState");
    const searchInput = document.getElementById("search");
    const filterButtons = document.querySelectorAll(".controls button[data-filter]");
    const tableHeaders = document.querySelectorAll("table#rolesTable th[data-sortable]");
    let activeFilter = "all";
    let sortColumn = null;
    let sortDirection = "asc";

    function esc(value) {
      const div = document.createElement("div");
      div.textContent = value ?? "";
      return div.innerHTML;
    }

    function linkCell(role) {
      const links = [];
      if (role.jobUrl) links.push('<a href="' + esc(role.jobUrl) + '" target="_blank" rel="noopener">Job</a>');
      if (role.applyUrl) links.push('<a href="' + esc(role.applyUrl) + '" target="_blank" rel="noopener">Apply</a>');
      return links.length ? links.join(" · ") : "—";
    }

    function staleCell(role) {
      if (!role.isStale) return "—";
      const days = role.daysSinceTouch || "?";
      const action = role.suggestedNextAction || "Follow up";
      return '<span class="stale-badge">Stale</span>' + esc(days + "d · " + action);
    }

    function sortRoles(rows, column, direction) {
      if (!column) return rows;
      const sorted = rows.slice();
      sorted.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        if (column === "stale") {
          aVal = a.isStale ? 1 : 0;
          bVal = b.isStale ? 1 : 0;
        }
        if (typeof aVal === "string") {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }
        if (aVal < bVal) return direction === "asc" ? -1 : 1;
        if (aVal > bVal) return direction === "asc" ? 1 : -1;
        return 0;
      });
      return sorted;
    }

    function render() {
      const query = searchInput.value.trim().toLowerCase();
      let rows = roles.filter((role) => {
        if (activeFilter === "stale") {
          if (!role.isStale) return false;
        } else if (activeFilter !== "all" && role.statusBucket !== activeFilter) {
          return false;
        }
        if (!query) return true;
        return [role.company, role.title, role.location].some((field) => field.toLowerCase().includes(query));
      });

      rows = sortRoles(rows, sortColumn, sortDirection);

      tbody.innerHTML = rows
        .map((role) => {
          const badgeClass = "badge-" + role.statusBucket;
          const label = statusLabels[role.statusBucket] || role.statusBucket;
          return (
            "<tr>" +
            "<td>" + esc(role.company) + "</td>" +
            "<td>" + esc(role.title) + "</td>" +
            "<td>" + esc(role.location) + "</td>" +
            "<td>" + esc(role.compensation || "—") + "</td>" +
            "<td>" + esc(role.fit || "—") + "</td>" +
            "<td><span class=\\"badge " + badgeClass + "\\">" + esc(label) + "</span><br><small>" + esc(role.applied || "—") + "</small></td>" +
            "<td>" + linkCell(role) + "</td>" +
            "<td>" + esc(role.resume || "—") + "</td>" +
            "<td>" + esc(role.coverLetterStatus || "—") + "</td>" +
            "<td>" + staleCell(role) + "</td>" +
            "<td>" + (role.notes || "—") + "</td>" +
            "</tr>"
          );
        })
        .join("");

      emptyState.style.display = rows.length === 0 ? "block" : "none";
    }

    filterButtons.forEach((button) => {
      button.addEventListener("click", () => {
        filterButtons.forEach((b) => b.classList.remove("active"));
        button.classList.add("active");
        activeFilter = button.getAttribute("data-filter");
        render();
      });
    });

    tableHeaders.forEach((header) => {
      header.addEventListener("click", () => {
        const column = header.getAttribute("data-sortable");
        if (sortColumn === column) {
          sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
          sortColumn = column;
          sortDirection = "asc";
        }
        render();
      });
    });

    searchInput.addEventListener("input", render);
    render();
  </script>
</body>
</html>
`;
}

module.exports = { renderHtmlTracker };
