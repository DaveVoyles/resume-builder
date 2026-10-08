"use strict";

/**
 * Splits resume text into small, citable pieces (one per job header, bullet,
 * or paragraph) so each metric lives in its own evidence entry. Pure text in,
 * plain objects out; no file access. Used by `ingest` for resume sources.
 *
 * Each chunk: { kind, text, section?, organization?, dateRange? }
 *   kind: "job-header" | "bullet" | "paragraph"
 */

const MAX_CHUNK_CHARS = 600;

const BULLET_RE = /^\s*(?:[-*+•▪◦‣●–]|\d{1,2}[.)])\s+(.*)$/u;
const MD_HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/u;

const SECTION_NAMES = [
  "summary", "professional summary", "profile", "objective", "about",
  "experience", "work experience", "professional experience", "work history", "employment", "employment history", "career history",
  "education", "skills", "technical skills", "projects", "certifications", "certificates",
  "publications", "speaking", "awards", "volunteer", "volunteering", "interests", "languages", "references",
];

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const DATE_POINT = `(?:${MONTH}\\s+)?(?:19|20)\\d{2}`;
const DATE_RANGE_RE = new RegExp(
  `(${DATE_POINT})\\s*(?:-|–|—|to|until)\\s*(${DATE_POINT}|present|now|current|today)`,
  "iu",
);

function cleanText(text) {
  return String(text || "").replace(/\s+/gu, " ").trim();
}

function isSectionHeading(line) {
  const trimmed = line.trim();
  const md = MD_HEADING_RE.exec(trimmed);
  if (md) return { name: cleanText(md[2]), level: md[1].length, markdown: true };
  const bare = trimmed.replace(/:$/u, "").trim();
  if (bare.length > 0 && bare.length <= 40 && SECTION_NAMES.includes(bare.toLowerCase())) {
    return { name: bare, level: 1, markdown: false };
  }
  return null;
}

function splitHeader(headerText) {
  const range = DATE_RANGE_RE.exec(headerText);
  let dateRange;
  let rest = headerText;
  if (range) {
    dateRange = cleanText(range[0]);
    rest = headerText.replace(range[0], " ");
  }
  rest = cleanText(rest.replace(/[()|]/gu, " ").replace(/\s[—–-]\s*$/u, "").replace(/^[\s,—–-]+|[\s,—–-]+$/gu, ""));
  return { organization: rest || undefined, dateRange };
}

/** Splits text longer than the cap on sentence boundaries, then on words. Never drops text. */
function splitLong(text, max = MAX_CHUNK_CHARS) {
  if (text.length <= max) return [text];
  const sentences = text.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)\s*/gu) || [text];
  const pieces = [];
  let current = "";
  const push = () => {
    if (current.trim()) pieces.push(current.trim());
    current = "";
  };
  for (const sentence of sentences) {
    if (sentence.length > max) {
      push();
      let remaining = sentence.trim();
      while (remaining.length > max) {
        let cut = remaining.lastIndexOf(" ", max);
        if (cut < max / 2) cut = max;
        pieces.push(remaining.slice(0, cut).trim());
        remaining = remaining.slice(cut).trim();
      }
      current = remaining ? `${remaining} ` : "";
      continue;
    }
    if ((current + sentence).trim().length > max) push();
    current += sentence;
  }
  push();
  return pieces;
}

function chunkResumeText(rawText) {
  const lines = String(rawText || "").replace(/\r\n?/gu, "\n").split("\n");
  const chunks = [];
  let section = "Header";
  let job = null; // { organization, dateRange }
  let buffer = null; // { kind, parts: [] }

  const flush = () => {
    if (!buffer) return;
    const text = cleanText(buffer.parts.join(" "));
    if (text) {
      for (const piece of splitLong(text)) {
        const chunk = { kind: buffer.kind, text: piece, section };
        if (job && buffer.kind !== "job-header") {
          if (job.organization) chunk.organization = job.organization;
          if (job.dateRange) chunk.dateRange = job.dateRange;
        }
        chunks.push(chunk);
      }
    }
    buffer = null;
  };

  const nextNonBlank = (index) => {
    for (let i = index + 1; i < lines.length; i += 1) if (lines[i].trim()) return lines[i];
    return "";
  };

  lines.forEach((line, index) => {
    if (!line.trim()) {
      flush();
      return;
    }
    const heading = isSectionHeading(line);
    if (heading) {
      flush();
      // Deeper markdown headings (### ...) under a section are job headers.
      if (heading.markdown && heading.level >= 3 && section !== "Header") {
        job = splitHeader(heading.name);
        chunks.push({ kind: "job-header", text: cleanText(heading.name), section, ...job });
      } else {
        section = heading.name;
        job = null;
      }
      return;
    }
    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flush();
      buffer = { kind: "bullet", parts: [bullet[1]] };
      return;
    }
    const trimmed = line.trim();
    const looksLikeHeader =
      DATE_RANGE_RE.test(trimmed) && trimmed.length <= 160
        ? true
        : trimmed.length <= 100 && !/[.!?]$/u.test(trimmed) && BULLET_RE.test(nextNonBlank(index));
    if (looksLikeHeader && !(buffer && buffer.kind === "bullet" && /^\s{2,}/u.test(line))) {
      flush();
      job = splitHeader(trimmed);
      chunks.push({ kind: "job-header", text: trimmed, section, ...job });
      return;
    }
    // Continuation of a wrapped bullet or a paragraph line.
    if (buffer) buffer.parts.push(trimmed);
    else buffer = { kind: "paragraph", parts: [trimmed] };
  });
  flush();
  return chunks;
}

module.exports = { MAX_CHUNK_CHARS, chunkResumeText, splitLong };
