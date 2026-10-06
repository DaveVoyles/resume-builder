"use strict";

const FIELD_PATTERN = /name|email|phone/iu;

function profileKey(field) {
  const text = `${field.id || ""} ${field.label || ""}`;
  if (!FIELD_PATTERN.test(text)) return null;
  if (/email/iu.test(text)) return "email";
  if (/phone/iu.test(text)) return "phone";
  return "name";
}

function fillFields(profile, requiredFields, confirmSubmit) {
  const values = {};
  const missing = [];
  for (const field of requiredFields || []) {
    const key = profileKey(field);
    const value = key && profile ? profile[key] : "";
    if (typeof value === "string" && value.trim()) {
      values[field.id] = value;
    } else {
      missing.push(field.label);
    }
  }
  return { values, missing, submitted: confirmSubmit === true && missing.length === 0 };
}

module.exports = { fillFields };
