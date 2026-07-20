"use strict";

function renderGapReport(gaps, roleTitle = "Target Role") {
  if (!gaps || gaps.length === 0) {
    return [
      `# Gap Report: ${roleTitle}`,
      "",
      "Gap classifications for resume tailoring.",
      "",
      "No gaps to report.",
      "",
    ].join("\n");
  }

  const lines = [
    `# Gap Report: ${roleTitle}`,
    "",
    "Gap classifications for resume tailoring.",
    "",
    "## Gaps",
    "",
  ];

  gaps.forEach((gap, index) => {
    lines.push(`### ${index + 1}. ${gap.keyword}`);
    lines.push("");
    lines.push(`**Type:** ${gap.type}`);
    lines.push("");
    lines.push(`**Rationale:** ${gap.rationale}`);
    lines.push("");
    lines.push(`**Recommended Action:** ${gap.recommendedAction}`);
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
