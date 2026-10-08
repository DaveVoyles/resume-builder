"use strict";

// Preloaded by `npm test` (node --require). Converting every rendered DOCX
// with LibreOffice would make the unit tests slow, so they skip the page
// check. Tests of the check itself inject a fake spawn instead.
process.env.RESUME_BUILDER_PAGE_CHECK = "off";
