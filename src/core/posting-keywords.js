"use strict";

/**
 * Deterministic keyword extraction from job-posting text. No network, no LLM.
 *
 * Splits the posting into "required" and "preferred" sections using headings
 * and inline phrases, then collects candidate skills, tools, and phrases:
 * the profile skill list, known multiword terms, capitalised terms and
 * acronyms, and noun phrases after "experience with" style triggers.
 * Results are deduped case-insensitively and capped.
 */

const { SKILL_KEYWORDS } = require("./candidate-profile");

const MAX_KEYWORDS = 25;

const KNOWN_TERMS = [
  "product management",
  "program management",
  "project management",
  "stakeholder management",
  "developer platform",
  "developer experience",
  "developer tooling",
  "internal tooling",
  "platform strategy",
  "launch coordination",
  "machine learning",
  "data analysis",
  "data analytics",
  "customer success",
  "customer education",
  "customer support",
  "cross-functional",
  "go-to-market",
  "roadmap",
  "user research",
  "a/b testing",
  "continuous integration",
  "technical writing",
  "curriculum design",
  "classroom management",
  "workshop facilitation",
  "scheduling",
  "office management",
  "vendor management",
  "budget management",
  "event planning",
  "onboarding",
  "training",
  "analytics",
  "CI/CD",
  "microservices",
  "Kubernetes",
  "Docker",
  "SQL",
  "Excel",
  "Terraform",
  "AWS",
  "GCP",
  "GraphQL",
  "Snowflake",
  "Looker",
  "Salesforce",
  "Jira",
  "Figma",
  "Tableau",
  "Zendesk",
  "PowerPoint",
  "Google Workspace",
  "documentation",
  "workshops",
];

const REQUIRED_HEADING = /^(requirements?|required( qualifications| skills| experience)?|must[- ]haves?|minimum( qualifications| requirements)?|basic qualifications|qualifications|what you('| wi)?ll need|what you need|what you bring|you have|who you are|what we('| a)?re looking for|skills|responsibilities|you will|what you('| wi)?ll do|the role|about the role)\b/iu;
const PREFERRED_HEADING = /^(nice[- ]to[- ]haves?|preferred( qualifications| skills| experience)?|bonus( points)?|pluses|plus|desired( skills| qualifications)?|good to have|ideal( candidate)?|extra credit)\b/iu;
const PREFERRED_INLINE = /\b(nice[- ]to[- ]have|preferred|bonus|a plus|desired|ideally)\b/iu;
const TRIGGER = /\b(?:experience (?:with|in|of)|knowledge of|familiarity with|proficien(?:t|cy) (?:in|with)|expertise in|background in|skilled in|understanding of|curiosity about|comfortable with|focus on|set|shape|coordinate|own)\s+([^.;:()\n]+)/giu;

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "our", "your", "you", "we", "is", "are", "be", "as", "at", "by", "from",
  "this", "that", "these", "those", "it", "its", "their", "his", "her", "who", "will", "have", "has", "can", "may", "strong", "good", "great",
  "excellent", "ability", "experience", "years", "year", "plus", "team", "teams", "work", "working", "role", "company", "about", "all", "any", "new",
  "more", "other", "such", "across", "within", "into", "using", "use", "etc", "including", "ideal", "bonus", "fictional", "remote", "location",
  "united", "states", "responsibilities", "requirements", "qualifications", "benefits", "apply", "join", "us", "what", "how", "why", "when",
  "senior", "junior", "lead", "manager", "i", "if", "not", "but", "so", "than", "then", "also", "both", "each", "every", "well", "own",
  "set", "shape", "build", "coordinate", "manage", "curiosity", "familiarity", "knowledge", "understanding", "proficiency", "expertise",
  "you'll", "we're", "you're", "it's", "must", "should", "nice", "preferred", "required", "equal", "opportunity", "employer",
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\/]/gu, "\\$&");
}

/** Case-insensitive match where the term is not embedded in a larger word. */
function containsTerm(text, term) {
  const pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, "iu");
  return pattern.test(text);
}

function stripLine(line) {
  return line.replace(/^\s*(?:#{1,6}|[-*+•]|\d+[.)])\s*/u, "").replace(/\*\*|__/gu, "").trim();
}

function isHeading(raw, stripped) {
  if (/^\s*#{1,6}\s/u.test(raw)) return true;
  if (/^\s*(?:[-*+•]|\d+[.)])\s/u.test(raw)) return false;
  if (!stripped) return false;
  if (/:\s*$/u.test(stripped)) return true;
  const short = stripped.split(/\s+/u).length <= 5 && !/[.,]$/u.test(stripped);
  return short && (REQUIRED_HEADING.test(stripped) || PREFERRED_HEADING.test(stripped));
}

function cleanPhrase(phrase) {
  const words = phrase
    .replace(/[“”"]/gu, "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  while (words.length && STOPWORDS.has(words[0].toLowerCase())) words.shift();
  while (words.length && STOPWORDS.has(words[words.length - 1].toLowerCase())) words.pop();
  if (words.length === 0 || words.length > 3) return "";
  const result = words.join(" ").replace(/[,;]+$/u, "");
  if (result.length < 2 || !/[A-Za-z]/u.test(result)) return "";
  return result;
}

function capitalisedTerms(sentence) {
  const found = [];
  let wordIndex = 0;
  let run = [];
  const flush = () => {
    if (run.length >= 2) found.push(run.join(" "));
    run = [];
  };
  for (const token of sentence.split(/\s+/u)) {
    if (!token) continue;
    // Skip the first word of a sentence; it is capitalised by grammar.
    const first = wordIndex === 0;
    wordIndex += 1;
    const word = token.replace(/^[("'“]+|[)"'”,;:!?.]+$/gu, "");
    const lower = word.toLowerCase();
    const acronym = /^[A-Z][A-Z0-9/+#&-]+$/u.test(word) && !STOPWORDS.has(lower);
    const camel = /^[A-Z]?[a-z]+[A-Z][A-Za-z0-9]*$/u.test(word);
    const dotted = /^[A-Za-z][A-Za-z0-9]*\.[A-Za-z]{1,4}$/u.test(word) && /[A-Z]|js$/u.test(word);
    const title = /^[A-Z][a-z0-9]+$/u.test(word) && !STOPWORDS.has(lower) && !first;
    if (acronym || camel || dotted) {
      flush();
      found.push(word);
    } else if (title) {
      run.push(word);
    } else {
      flush();
    }
  }
  flush();
  return found;
}

/**
 * @param {string} text posting text
 * @returns {{ required: string[], preferred: string[] }}
 */
function extractPostingKeywords(text, options = {}) {
  const max = options.max || MAX_KEYWORDS;
  const lines = (typeof text === "string" ? text : "").split(/\r?\n/u);
  const buckets = { required: [], preferred: [] };
  const seen = new Set();
  const skillList = [...SKILL_KEYWORDS, ...KNOWN_TERMS];
  const add = (lineSection, value) => {
    const canonical = skillList.find((term) => term.toLowerCase() === value.toLowerCase()) || value;
    const key = canonical.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    buckets[lineSection].push(canonical);
  };

  let section = "required";
  let firstContentLine = true;
  lines.forEach((raw) => {
    const stripped = stripLine(raw);
    if (!stripped) return;
    // The first line is the posting title; its words describe the role, not a skill list.
    if (firstContentLine) {
      firstContentLine = false;
      if (/^\s*#/u.test(raw)) return;
    }
    if (/^(company|location|salary|compensation|team|department)\s*:/iu.test(stripped)) return;

    let body = stripped;
    let lineSection = section;
    if (isHeading(raw, stripped)) {
      const colon = stripped.indexOf(":");
      const headText = colon === -1 ? stripped : stripped.slice(0, colon);
      if (PREFERRED_HEADING.test(headText)) section = "preferred";
      else if (REQUIRED_HEADING.test(headText)) section = "required";
      lineSection = section;
      // "Nice to have: X, Y" carries content after the colon.
      if (colon === -1 || colon === stripped.length - 1) return;
      body = stripped.slice(colon + 1).trim();
    }
    if (lineSection === "required" && PREFERRED_INLINE.test(body)) lineSection = "preferred";

    const candidates = [];
    skillList.forEach((term) => {
      if (containsTerm(body, term)) candidates.push({ pos: body.toLowerCase().indexOf(term.toLowerCase()), value: term });
    });
    body.split(/(?<=[.!?])\s+/u).forEach((sentence) => {
      capitalisedTerms(sentence).forEach((term) => {
        const cleaned = cleanPhrase(term);
        if (cleaned && !STOPWORDS.has(cleaned.toLowerCase())) candidates.push({ pos: body.indexOf(term), value: cleaned });
      });
    });
    let match;
    TRIGGER.lastIndex = 0;
    while ((match = TRIGGER.exec(body)) !== null) {
      match[1]
        .split(/,|\b(?:and|or|across|for|to|in|on|with|at|by|of)\b/iu)
        .forEach((piece) => {
          const cleaned = cleanPhrase(piece.replace(/\b(?:such as|e\.g\.|like)\b.*$/iu, ""));
          if (cleaned) candidates.push({ pos: match.index, value: cleaned });
        });
    }

    candidates.sort((a, b) => a.pos - b.pos).forEach(({ value }) => add(lineSection, value));
  });

  // Required wins the cap: preferred only fills what is left.
  const required = buckets.required.slice(0, max);
  const preferred = buckets.preferred.slice(0, Math.max(0, max - required.length));
  return { required, preferred };
}

function allKeywords(keywords) {
  if (!keywords) return [];
  return [...(keywords.required || []), ...(keywords.preferred || [])];
}

module.exports = { extractPostingKeywords, allKeywords, containsTerm, MAX_KEYWORDS };
