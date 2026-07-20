"use strict";

const path = require("path");
const renderResume = require("./render-resume");
const addRole = require("./add-role");
const setStatus = require("./set-status");
const buildTracker = require("./build-tracker");
const { createRole } = require("../../adapters/job-posting");
const { validateResumeConfig } = require("../../core/resume-config");
const { auditResumeConfig } = require("../../core/claim-audit");
const { readJson, readJsonLines, relativeToWorkspace, resolveWorkspace, workspacePaths, writeJson } = require("../../core/workspace");

// The D7 enum value (src/cli/commands/set-status.js's VALID_STATUSES) that
// buckets to "not-applied" in statusBucket() (src/core/role-view.js) — the
// deterministic "not yet applied" convention this command must reuse rather
// than inventing a new one (design plan 0001, D4 acceptance criteria: "new
// entries always land with a not-yet-applied status").
const NOT_YET_APPLIED_STATUS = "interested";

/**
 * Tailor workflow (design plan 0001, D4): validates a drafted resume config
 * (D2 schema + D3 claim audit), renders it to DOCX (D2), and registers the
 * tracked role (D6/add-role) — all in one pass, landing the new tracked role
 * un-applied so a human reviews the resume before anything is sent.
 *
 * Composes existing D2/D3/D6/D7 machinery instead of reimplementing any of
 * it: schema validation, the claim audit, DOCX rendering, role creation +
 * dedup, and the enum status write + tracker rebuild are each delegated to
 * their own module/command.
 */
async function run(options) {
  if (!options.config) {
    throw new Error("tailor requires --config <path-to-drafted-resume-config.json>");
  }

  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  const configPath = path.resolve(process.cwd(), options.config);
  const config = readJson(configPath);

  // Step 1: schema validation (D2, src/core/resume-config.js) — fail fast
  // with an itemized error before touching the evidence ledger or the
  // filesystem. render-resume (called below) validates again internally,
  // but a config that fails schema validation should never reach the claim
  // audit or role registration steps at all.
  const { valid, errors: schemaErrors } = validateResumeConfig(config);
  if (!valid) {
    throw new Error(`Invalid resume config:\n${schemaErrors.map((error) => `  - ${error}`).join("\n")}`);
  }

  // Step 2: evidence-backed claim audit (D3, src/core/claim-audit.js) — the
  // same blocking rule `validate` applies to every file under
  // resume-configs/, run here against the config being tailored right now so
  // an unsupported claim is caught before a DOCX is rendered or a role is
  // tracked, not discovered later by a separate `validate` pass.
  const evidence = readJsonLines(paths.evidence);
  const audit = auditResumeConfig(config, evidence);
  if (audit.errors.length > 0) {
    throw new Error(`Resume config failed the evidence-backed claim audit:\n${audit.errors.map((error) => `  - ${error}`).join("\n")}`);
  }
  audit.warnings.forEach((warning) => console.warn(`Warning: ${warning}`));

  // A tailored resume belongs to exactly one company. If the caller passes
  // an explicit --company that disagrees with the config's own `company`
  // field, fail loud instead of silently tracking the role under one name
  // while the resume renders under another.
  if (options.company && options.company.trim().toLowerCase() !== String(config.company || "").trim().toLowerCase()) {
    throw new Error(
      `--company "${options.company}" does not match the resume config's company "${config.company}". ` +
        "Use the same company for both, or omit --company to use the config's value.",
    );
  }

  // Step 3: render the DOCX (D2, render-resume) — delegate to the render
  // command itself so path sanitization, directory layout, and file writing
  // all stay in one place instead of a second, drifting copy here.
  const outputPath = await renderResume.run({ workspace: options.workspace, config: options.config });

  // Step 4: register the tracked role (D6, add-role) — delegate to
  // add-role's own command (dedup by id or job URL, tracked-list
  // membership) instead of reimplementing role creation. `company` defaults
  // to the resume config's own company so the caller doesn't have to repeat
  // it.
  const roleOptions = { ...options, tracked: true, company: options.company || config.company };
  addRole.run(roleOptions);

  // createRole is a pure function of roleOptions (src/adapters/job-posting.js)
  // — calling it again here just recomputes the same deterministic id
  // add-role.run derived above, so this locates the role we (or a prior,
  // deduped tailor/add-role call) just wrote without reimplementing any of
  // add-role's creation, dedup, or write logic.
  const { id: roleId } = createRole(roleOptions);
  const trackedRoles = readJson(paths.rolesTracked, []);
  const role = trackedRoles.find((candidate) => candidate.id === roleId);
  if (!role) {
    throw new Error(`tailor could not find the tracked role it just registered (id: ${roleId}).`);
  }

  // Step 5: link the role to the resume artifacts just produced.
  // `role.status` stays "tracked" (list membership, set by add-role above);
  // `resume.configPath`/`resume.outputPath` are siblings of the existing
  // `resume.status`/`resume.outputPath` fields (see docs/workspace-schemas.md),
  // not a new top-level key — study-guide-bundle and the tracker's existing
  // "Resume" column both pick them up with no schema migration.
  role.resume = role.resume || {};
  role.resume.configPath = relativeToWorkspace(workspace, configPath);
  role.resume.outputPath = relativeToWorkspace(workspace, outputPath);
  role.resume.status = "review-needed";
  writeJson(paths.rolesTracked, trackedRoles);

  // Step 6: land the role un-applied (plan 0001 Decision 8 / D4 acceptance
  // criteria — a human reviews the resume before anything is sent). Reuse
  // `set-status` (D7) for the enum write + tracker rebuild instead of
  // duplicating either. Skip only when the role already carries a real
  // application status (e.g. a second tailor pass that re-renders an
  // already-progressing application's resume) so a re-run never silently
  // reverts genuine progress back to "interested".
  if (!role.application?.status) {
    await setStatus.run({ workspace: options.workspace, id: roleId, status: NOT_YET_APPLIED_STATUS });
  } else {
    console.log(`Role already has application status "${role.application.status}"; leaving it unchanged.`);
    buildTracker.run({ workspace: options.workspace, format: "md" });
    buildTracker.run({ workspace: options.workspace, format: "html" });
  }

  console.log(`Tailored resume for ${role.company} — ${role.title}: ${outputPath}`);
  return { role, outputPath };
}

module.exports = { run };
