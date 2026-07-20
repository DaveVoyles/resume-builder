"use strict";

// Agent-drafted gap text is untrusted content embedded inline in markdown
// (headings, bold labels) rather than a table cell, so the risk is a value
// that opens with heading/list markers or embeds a blank line, corrupting
// the report's structure rather than just misaligning a column. Collapse
// embedded newlines to a space and neutralize leading structural markers.
function inline(value) {
  const text = String(value ?? "").replace(/\r?\n/gu, " ").trim();
  return text.replace(/^([#>*+-]|\d+\.)/u, "\\$1") || "—";
}

function renderGapReport(gaps, roleTitle = "Target Role") {
  const safeRoleTitle = inline(roleTitle);
  if (!gaps || gaps.length === 0) {
    return [
      `# Gap Report: ${safeRoleTitle}`,
      "",
      "Gap classifications for resume tailoring.",
      "",
      "No gaps to report.",
      "",
    ].join("\n");
  }

  const lines = [
    `# Gap Report: ${safeRoleTitle}`,
    "",
    "Gap classifications for resume tailoring.",
    "",
    "## Gaps",
    "",
  ];

  gaps.forEach((gap, index) => {
    lines.push(`### ${index + 1}. ${inline(gap.keyword)}`);
    lines.push("");
    lines.push(`**Type:** ${inline(gap.type)}`);
    lines.push("");
    lines.push(`**Rationale:** ${inline(gap.rationale)}`);
    lines.push("");
    lines.push(`**Recommended Action:** ${inline(gap.recommendedAction)}`);
    lines.push("");
  });

  lines.push("## Review Actions");
  lines.push("");
  lines.push("Review each gap and its recommended action. Consider:");
  lines.push("");
  lines.push("- **PresentationGap**: Skill exists but is not visible. Make it visible in the resume.");
  lines.push("- **WeakEvidence**: Skill is mentioned but lacks depth. Strengthen the evidence and details.");
  lines.push("- **AdjacentSkill**: Related skill exists that could transfer. Highlight the connection.");
  lines.push("- **TrueGap**: Skill is missing. Decide whether to acquire, learn, or deprioritize.");
  lines.push("");

  return lines.join("\n");
}

module.exports = { renderGapReport };
