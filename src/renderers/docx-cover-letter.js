"use strict";

/**
 * Cover letter config renderer (design plan 0004, D2). Produces a docx Document
 * from a schema-validated cover letter config (src/core/cover-letter-config.js)
 * via the styling primitives in docx-helpers.js. Renders header (name + contact),
 * salutation, body paragraphs, and closing — no date line or recipient address block.
 */

const { name, contactLine, rule, para, docFrom } = require("./docx-helpers");
const { validateCoverLetterConfig } = require("../core/cover-letter-config");

/**
 * @param {object} config - a schema-validated cover letter config (see src/core/cover-letter-config.js)
 * @returns {import("docx").Document}
 */
function renderCoverLetterConfig(config) {
  const { valid, errors } = validateCoverLetterConfig(config);
  if (!valid) {
    throw new Error(`Invalid cover letter config:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  }

  const children = [
    name(config.candidate.name),
    contactLine(config.candidate.contact),
    rule(),
    para(config.salutation),
  ];

  for (const paragraph of config.bodyParagraphs) {
    children.push(para(paragraph));
  }

  children.push(para(config.closing));

  return docFrom(children);
}

module.exports = { renderCoverLetterConfig };
