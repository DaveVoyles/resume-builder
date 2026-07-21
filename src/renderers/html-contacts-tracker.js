"use strict";

const CONTACT_STATUS_LABELS = {
  identified: "Identified",
  "reached-out": "Reached out",
  responded: "Responded",
  "meeting-scheduled": "Meeting scheduled",
  met: "Met",
  referred: "Referred",
  "no-response": "No response",
  dormant: "Dormant",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function jsonScriptSafe(value) {
  return JSON.stringify(value, null, 2).replace(/<\/(script)/giu, "<\\/$1");
}

function sortContacts(contacts) {
  const withSort = contacts.map((contact) => ({
    original: contact,
    sortKey: contact.nextAction?.dueDate || "￿", // Use high unicode value for undefined
  }));

  return withSort
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((entry) => entry.original);
}

function renderHtmlContactsTracker(contacts, options = {}) {
  const title = options.title || "Contact Tracker";
  const generatedAt = options.generatedAt || new Date().toISOString();

  const sortedContacts = sortContacts(contacts);

  // Count contacts by status
  const counts = sortedContacts.reduce(
    (acc, contact) => {
      acc[contact.status] = (acc[contact.status] || 0) + 1;
      return acc;
    },
    {}
  );

  const rowsData = sortedContacts.map((contact) => {
    return {
      name: contact.name || "",
      company: contact.company || "",
      relationship: contact.relationship || "",
      status: contact.status || "",
      dueDate: contact.nextAction?.dueDate || "",
      notes: (contact.notes || []).map(escapeHtml).join("<br>"),
    };
  });

  const total = sortedContacts.length;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0;
    padding: 2.5rem;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    color: #0f172a;
  }
  h1 {
    margin: 0 0 0.5rem;
    font-size: 2.125rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #0f172a;
  }
  .subtitle {
    color: #64748b;
    margin: 0 0 2rem;
    font-size: 0.9rem;
    line-height: 1.5;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1.25rem;
    margin-bottom: 2.5rem;
  }
  .stat-card {
    background: #fff;
    border: none;
    border-radius: 1rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.08);
  }
  .stat-value {
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    color: #0284c7;
  }
  .stat-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    font-weight: 600;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 2rem;
    align-items: center;
    padding: 1rem 0;
  }
  .controls input {
    flex: 1;
    min-width: 200px;
    padding: 0.625rem 1rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.625rem;
    font-size: 0.9rem;
    background: #fff;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .controls input:focus {
    outline: none;
    border-color: #0284c7;
    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.1);
  }
  .controls button {
    padding: 0.5rem 1rem;
    border: 1px solid #cbd5e1;
    background: #fff;
    border-radius: 0.625rem;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s ease;
  }
  .controls button:hover {
    border-color: #94a3b8;
    background: #f8fafc;
  }
  .controls button.active {
    background: #0284c7;
    color: #fff;
    border-color: #0284c7;
    box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05);
  }
  th, td {
    text-align: left;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    font-size: 0.875rem;
    vertical-align: top;
    line-height: 1.5;
  }
  th {
    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #475569;
    cursor: pointer;
    user-select: none;
    font-weight: 700;
    transition: background-color 0.2s ease;
  }
  th:hover {
    background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
  }
  tr:last-child td {
    border-bottom: none;
  }
  tr:hover {
    background-color: #f8fafc;
  }
  .badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .badge-identified { background: #fef3c7; color: #92400e; }
  .badge-reached-out { background: #dbeafe; color: #1e40af; }
  .badge-responded { background: #dcfce7; color: #166534; }
  .badge-meeting-scheduled { background: #e9d5ff; color: #6b21a8; }
  .badge-met { background: #ede9fe; color: #5b21b6; }
  .badge-referred { background: #ddd6fe; color: #4c1d95; }
  .badge-no-response { background: #fed7aa; color: #92400e; }
  .badge-dormant { background: #f1f5f9; color: #475569; }
  .empty-state {
    padding: 3rem 2rem;
    text-align: center;
    color: #64748b;
    background: #fff;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
  }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="subtitle">Generated ${escapeHtml(generatedAt)} from <code>contacts.json</code>. Rebuild with <code>build-contacts-tracker --format html</code>; do not hand-edit.</p>

  <div class="stats">
    <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total contacts</div></div>
  </div>

  <div class="controls">
    <input type="text" id="search" placeholder="Search name, company, or relationship...">
  </div>

  <table id="contactsTable">
    <thead>
      <tr>
        <th data-sortable="name">Name</th><th data-sortable="company">Company</th><th data-sortable="relationship">Relationship</th><th data-sortable="status">Status</th><th data-sortable="dueDate">Next Action Due</th><th>Notes</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>
  <p class="empty-state" id="emptyState" style="display:none;">No tracked contacts yet.</p>

  <script>
    const contacts = ${jsonScriptSafe(rowsData)};
    const statusLabels = ${jsonScriptSafe(CONTACT_STATUS_LABELS)};
    const statusCounts = ${jsonScriptSafe(counts)};
    const tbody = document.querySelector("#contactsTable tbody");
    const emptyState = document.getElementById("emptyState");
    const searchInput = document.getElementById("search");
    const tableHeaders = document.querySelectorAll("table#contactsTable th[data-sortable]");
    let sortColumn = null;
    let sortDirection = "asc";

    function esc(value) {
      const div = document.createElement("div");
      div.textContent = value ?? "";
      return div.innerHTML;
    }

    function sortRows(rows, column, direction) {
      if (!column) return rows;
      const sorted = rows.slice();
      sorted.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
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
      let rows = contacts.filter((contact) => {
        if (!query) return true;
        return [contact.name, contact.company, contact.relationship].some((field) =>
          field.toLowerCase().includes(query)
        );
      });

      rows = sortRows(rows, sortColumn, sortDirection);

      tbody.innerHTML = rows
        .map((contact) => {
          const badgeClass = "badge-" + contact.status;
          const label = statusLabels[contact.status] || contact.status;
          return (
            "<tr>" +
            "<td>" + esc(contact.name || "—") + "</td>" +
            "<td>" + esc(contact.company || "—") + "</td>" +
            "<td>" + esc(contact.relationship || "—") + "</td>" +
            "<td><span class=\\"badge " + badgeClass + "\\">" + esc(label) + "</span></td>" +
            "<td>" + esc(contact.dueDate || "—") + "</td>" +
            "<td>" + (contact.notes || "—") + "</td>" +
            "</tr>"
          );
        })
        .join("");

      emptyState.style.display = rows.length === 0 ? "block" : "none";
      tbody.parentElement.style.display = rows.length === 0 ? "none" : "";
    }

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

module.exports = { renderHtmlContactsTracker };
