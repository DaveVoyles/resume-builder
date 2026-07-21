"use strict";

// Shared between serve.js (which serves this route) and html-tracker.js
// (whose embedded client script polls it) so the two can't silently drift —
// a renderer and a CLI command each importing their own copy of this string
// is exactly the kind of duplication a rename would only half-catch.
const STATUS_ENDPOINT = "/__status";

module.exports = { STATUS_ENDPOINT };
