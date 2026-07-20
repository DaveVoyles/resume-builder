"use strict";

/**
 * Resume config renderer (design plan 0001, D2). Produces a docx Document
 * from a schema-validated resume config (src/core/resume-config.js) via the
 * styling primitives in docx-helpers.js. Ported from the private upstream
 * implementation's render.js — the same low-level building blocks that
 * proved out golden parity across 74 real role renders there — with all
 * candidate-specific content (name, contact, education, publications,
 * speaking) moved from hardcoded constants into the config itself.
 */

const {
  name,
  contactLine,
  rule,
  sectionHeading,
  injectFit,
  para,
  skillsTable,
  jobBlock,
  entryBlock,
  docFrom,
} = require("./docx-helpers");
const { validateResumeConfig, LAYOUTS } = require("../core/resume-config");

// Named for readability below instead of re-typing the layout strings —
// LAYOUTS (src/core/resume-config.js) is the single source of truth for
// valid publicationsSpeakingLayout values; this destructure keeps this
// file's branches from drifting out of sync with the schema's enum order:
// ["combined", "speaking-then-publications", "combined-speaking-only", "publications-only"].
const [, LAYOUT_SPEAKING_THEN_PUBLICATIONS, LAYOUT_COMBINED_SPEAKING_ONLY, LAYOUT_PUBLICATIONS_ONLY] = LAYOUTS;

function buildEducationSection(entries) {
  return entries.flatMap((entry) => entryBlock(entry.degree, entry.institution, entry.dates, entry.details));
}

function buildPublicationsSection(entries) {
  return entries.flatMap((entry) => entryBlock(entry.title, entry.publisher, entry.dates, entry.details));
}

function buildSpeakingSection(entries) {
  return entries.flatMap((entry) => entryBlock(entry.heading, entry.organizations, entry.dates, entry.details));
}

/**
 * @param {object} config - a schema-validated resume config (see src/core/resume-config.js)
 * @returns {import("docx").Document}
 */
function renderResumeConfig(config) {
  const { valid, errors } = validateResumeConfig(config);
  if (!valid) {
    throw new Error(`Invalid resume config:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }

  const summary = injectFit(config.summary.text, config.summary.fitOverride ?? null);

  const children = [name(config.candidate.name), contactLine(config.candidate.contact), rule(), sectionHeading("Summary"), para(summary)];

  for (const section of config.experienceSections) {
    children.push(rule(), sectionHeading(section.heading));
    for (const job of section.jobs) {
      children.push(...jobBlock(job.title, job.company, job.dates, job.subHeader || null, job.bullets));
    }
  }

  children.push(rule(), sectionHeading("Skills"), skillsTable(config.skills));

  const includeEducation = (config.includeEducation ?? true) && Array.isArray(config.education) && config.education.length > 0;
  if (includeEducation) {
    children.push(rule(), sectionHeading("Education"), ...buildEducationSection(config.education));
  }

  const hasPublications = Array.isArray(config.publications) && config.publications.length > 0;
  const hasSpeaking = Array.isArray(config.speaking) && config.speaking.length > 0;
  const includePublicationsSpeaking = (config.includePublicationsSpeaking ?? true) && (hasPublications || hasSpeaking);
  if (includePublicationsSpeaking) {
    const layout = config.publicationsSpeakingLayout || LAYOUTS[0];
    if (layout === LAYOUT_SPEAKING_THEN_PUBLICATIONS) {
      if (hasSpeaking) children.push(rule(), sectionHeading("Speaking"), ...buildSpeakingSection(config.speaking));
      if (hasPublications) children.push(rule(), sectionHeading("Publications"), ...buildPublicationsSection(config.publications));
    } else if (layout === LAYOUT_COMBINED_SPEAKING_ONLY) {
      if (hasSpeaking) children.push(rule(), sectionHeading("Publications & Speaking"), ...buildSpeakingSection(config.speaking));
    } else if (layout === LAYOUT_PUBLICATIONS_ONLY) {
      if (hasPublications) children.push(rule(), sectionHeading("Publications"), ...buildPublicationsSection(config.publications));
    } else if (hasPublications && hasSpeaking) {
      children.push(rule(), sectionHeading("Publications & Speaking"), ...buildPublicationsSection(config.publications), ...buildSpeakingSection(config.speaking));
    } else if (hasPublications) {
      children.push(rule(), sectionHeading("Publications"), ...buildPublicationsSection(config.publications));
    } else if (hasSpeaking) {
      children.push(rule(), sectionHeading("Speaking"), ...buildSpeakingSection(config.speaking));
    }
  }

  return docFrom(children);
}

module.exports = { renderResumeConfig };
