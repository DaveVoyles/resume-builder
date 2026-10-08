"use strict";

const path = require("path");
const { buildTailorPlan } = require("../../core/tailor-plan");
const { displayPath, findTrackedRole } = require("../../core/role-lookup");
const { hasPosting } = require("../../core/role-posting");
const { readJson, readJsonLines, resolveWorkspace, workspacePaths, writeJson } = require("../../core/workspace");

/**
 * tailor-plan --workspace <dir> (--id <role-id> | --company <name> --title <name>)
 *
 * Deterministic: no LLM, no network. Reads the role's stored posting keywords,
 * profile.json and evidence.jsonl, writes outputs/tailor-plans/<role-id>.json,
 * and prints a short plain summary. The agent then writes the resume config
 * (optionally extending a base config) and runs `tailor`.
 */
async function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const role = findTrackedRole(readJson(paths.rolesTracked, []), options, "tailor-plan");

  if (!hasPosting(role) || !role.posting.keywords) {
    throw new Error(`${role.company} — ${role.title} has no saved posting. Save it first: add-role --tracked --jd-file <posting.md> (or --jd-text), then run tailor-plan again.`);
  }

  const profile = readJson(paths.profile, null);
  const evidence = readJsonLines(paths.evidence);
  const plan = buildTailorPlan({ role, profile, evidence });

  const outFile = path.join(paths.outputs, "tailor-plans", `${role.id}.json`);
  writeJson(outFile, plan);

  const included = plan.jobs.filter((job) => job.include).sort((a, b) => a.rank - b.rank);
  const total = plan.keywords.supported.length + plan.keywords.doNotClaim.length;
  console.log(`Tailor plan for ${role.company} — ${role.title}`);
  console.log(`Keywords: ${total} from the posting, ${plan.keywords.supported.length} backed by your evidence, ${plan.keywords.doNotClaim.length} with no evidence.`);
  if (included.length > 0) {
    console.log("Lead with:");
    included.forEach((job) => {
      const label = [job.title, job.organization].filter(Boolean).join(" at ");
      const picked = job.bullets.filter((bullet) => bullet.recommended).length;
      console.log(`  - ${label}: ${picked} bullet(s), covers ${job.matchedKeywords.length} keyword(s)`);
    });
  }
  if (plan.keywords.doNotClaim.length > 0) {
    console.log(`Do not claim (no evidence): ${plan.keywords.doNotClaim.map((item) => item.keyword).join(", ")}`);
  }
  plan.notes.forEach((note) => console.log(`Note: ${note}`));
  console.log(`Plan saved: ${displayPath(workspace, outFile)}`);
  return plan;
}

module.exports = { run };
