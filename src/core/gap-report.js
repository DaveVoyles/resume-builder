"use strict";

function requireString(value, label, errors) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${label}: missing or empty string`);
    return false;
  }
  return true;
}

function requireObject(value, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  return true;
}

function requireArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return false;
  }
  return true;
}

function validateGapClassifications(input) {
  const errors = [];
  const VALID_TYPES = new Set(["PresentationGap", "WeakEvidence", "AdjacentSkill", "TrueGap"]);

  if (!requireArray(input, "Gap classifications", errors)) {
    return errors;
  }

  input.forEach((gap, index) => {
    const label = `gap line ${index + 1}`;

    if (!requireObject(gap, label, errors)) {
      return;
    }

    if (!requireString(gap.keyword, `${label}.keyword`, errors)) {
      return;
    }

    if (requireString(gap.type, `${label}.type`, errors)) {
      if (!VALID_TYPES.has(gap.type)) {
        errors.push(
          `${label}.type: invalid value "${gap.type}" (must be one of: ${Array.from(VALID_TYPES).join(", ")})`,
        );
      }
    }

    requireString(gap.rationale, `${label}.rationale`, errors);
    requireString(gap.recommendedAction, `${label}.recommendedAction`, errors);
  });

  return errors;
}

module.exports = { validateGapClassifications };
