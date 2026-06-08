"use strict";

const crypto = require("crypto");

function hash(value) {
  const input = Buffer.isBuffer(value) ? value : String(value);
  return crypto.createHash("sha256").update(input).digest("hex");
}

function slug(value) {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/&/gu, " and ")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
  return cleaned || "item";
}

function stableId(prefix, parts) {
  const readable = slug(parts.filter(Boolean).slice(0, 2).join("-")).slice(0, 48);
  return `${prefix}_${readable}_${hash(parts.join("|")).slice(0, 10)}`;
}

module.exports = { hash, slug, stableId };
