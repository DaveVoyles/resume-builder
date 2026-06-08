"use strict";

function cell(value) {
  const text = String(value || "—").replace(/\|/gu, "\\|").replace(/\r?\n/gu, "<br>");
  return text.trim() || "—";
}

function roleUrl(role) {
  return role.urls?.job || role.url || role.jobUrl || "";
}

function renderCandidateTable(recommendations, maxRows) {
  const rows = recommendations.slice(0, maxRows).map((role) =>
    [
      cell(role.company),
      cell(role.title),
      cell(role.location),
      cell(role.fit?.level),
      cell(role.fit?.score),
      cell(role.fit?.rationale),
      cell(role.fit?.risks?.join(" ")),
      roleUrl(role) ? `[Job](${roleUrl(role)})` : "—",
      cell(role.suggestedResumeStrategy),
      "Review before tracking",
    ].join(" | "),
  );

  if (rows.length === 0) return "_No scored candidate roles yet. Add a local candidate JSON file with `--candidates <file>` to score manually researched roles._";

  return [
    "| Company | Role | Location | Fit | Score | Rationale | Risks or missing evidence | Source | Resume strategy | Review action |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
  ].join("\n");
}

function renderSearchBriefs(briefs) {
  if (briefs.length === 0) return "_Add seed roles or role targets before generating search briefs._";
  return briefs
    .map((brief) => {
      const query = [brief.titlePattern, brief.keywords.slice(0, 5).join(" "), brief.workModes.join(" ")].filter(Boolean).join(" ");
      return `- Search for "${query}". Prefer seniority: ${brief.seniority.join(", ") || "flexible"}.`;
    })
    .join("\n");
}

function renderSimilarRoles(discovery, options = {}) {
  const maxRows = Number(options.max || 10);
  return [
    "# Similar-role review",
    "",
    "Generated from `roles.seed.json`, `preferences.json`, and optional manually supplied candidate roles.",
    "",
    "> Review-before-tracking rule: do not add a similar role to `roles.tracked.json` until the candidate reviews the source posting, duplicate check, fit rationale, evidence gaps, and resume strategy.",
    "",
    "## Search briefs",
    "",
    renderSearchBriefs(discovery.searchBriefs || []),
    "",
    "## Scored candidate roles",
    "",
    renderCandidateTable(discovery.recommendations || [], maxRows),
    "",
    "## Duplicate candidates suppressed",
    "",
    discovery.duplicateCandidates?.length
      ? discovery.duplicateCandidates.map((role) => `- ${cell(role.company)} — ${cell(role.title || role.role)}`).join("\n")
      : "_No duplicates were suppressed._",
    "",
    "## Review flow",
    "",
    "1. Confirm the posting source is current and safe to use.",
    "2. Check that the role is not already in `roles.seed.json` or `roles.tracked.json`.",
    "3. Review fit score, risks, missing evidence, compensation, location, and work mode.",
    "4. Ask follow-up questions before using low-confidence claims in a resume.",
    "5. Promote only accepted roles with `npm run workspace:add-role -- --workspace <workspace> --url <url> --tracked`.",
    "6. Rebuild the tracker with `npm run workspace:tracker -- --workspace <workspace>`.",
    "",
  ].join("\n");
}

module.exports = { renderSimilarRoles };
