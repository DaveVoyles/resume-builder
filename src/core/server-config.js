"use strict";

// Shared between serve.js (which serves this route) and html-tracker.js
// (whose embedded client script polls it) so the two can't silently drift —
// a renderer and a CLI command each importing their own copy of this string
// is exactly the kind of duplication a rename would only half-catch.
const STATUS_ENDPOINT = "/__status";

const IDENTITY_HEADER = "X-Resume-Builder";
const IDENTITY_VALUE = "1";

function identityHeaders(headers = {}) {
  return { [IDENTITY_HEADER]: IDENTITY_VALUE, ...headers };
}

function hasIdentityHeader(headers) {
  if (!headers) return false;
  const raw = headers[IDENTITY_HEADER.toLowerCase()] ?? headers[IDENTITY_HEADER];
  return raw === IDENTITY_VALUE;
}

module.exports = { STATUS_ENDPOINT, IDENTITY_HEADER, IDENTITY_VALUE, identityHeaders, hasIdentityHeader };
