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
  "billing",
  "front-desk",
  "healthcare",
  "electronic records",
  "release management",
  "change management",
  "dependency management",
  "risk management",
  "agile",
  "API gateway",
  "authentication",
  "metering",
  "event streaming",
  "distributed systems",
  "MCP",
  "OAuth",
  "OIDC",
  "ServiceNow",
  "MuleSoft",
  "Apigee",
  "Kong",
  "Workato",
  "Backstage",
  "ERP",
  "RAG",
  "GenAI",
  "prompt engineering",
  "evaluation frameworks",
  "Claude",
  "Gemini",
  "OpenAI",
  "Open AI",
  "Anthropic",
  "Vertex AI",
  "Spark",
  "Airflow",
  "dbt",
  "MLOps",
  "LLMOps",
];

const REQUIRED_HEADING = /^(requirements?|required( qualifications| skills| experience)?|must[- ]haves?|minimum( qualifications| requirements)?|basic qualifications|qualifications|what you('| wi)?ll need|what you need|what you bring|you have|who you are|what we('| a)?re looking for|skills|(job )?responsibilities|you will|what you('| wi)?ll do|work you('| wi)?ll do|the role|about the role|job description|position summary|overview)\b/iu;
// Employer boilerplate: the section is skipped until the next requirement-style heading.
const IGNORE_HEADING = /^(about (us|the team|the company|our company|our team)|who we are|what we offer|(the|our) team|benefits( and perks)?|perks|compensation( and benefits)?|total rewards|job information|equal opportunity|eeo)\b/iu;
// Lines that are never a skill: pay, legal and process text, saved-page notes, requisition tags.
const BOILERPLATE_LINE = /\b(wage|salary|pay) range\b|equal opportunity|reasonable accommodations?|immigration sponsorship|discretionary (annual )?incentive|recruiting (for this role )?ends|e-verify|background check/iu;
const METADATA_LINE = /^(company|location|salary|compensation|team|department|source|retrieved|posted|requisition|url|link|saved|job (identification|category|schedule)|business unit|posting date|locations)\s*:/iu;
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
  "proven", "track", "record", "demonstrated", "deep", "advanced", "significant", "hands-on", "hands", "comprehensive", "complex", "consistent",
  "innovative", "essential", "difficult", "successful", "productive", "effectively", "ensuring", "ensure", "while", "when", "where", "which",
  "large", "addition", "able", "highest", "key", "major", "primary", "overall",
  "principles", "practices", "theories", "direction", "directions", "high-performing", "similar", "influence", "down", "break",
]);

// Words that describe the setting rather than a skill. Stripped from the edges
// of a phrase ("healthcare setting" -> "healthcare") and never kept alone.
const FILLER = new Set([
  "setting", "settings", "environment", "environments", "industry", "industries", "organization", "organizations", "business", "businesses",
  "candidate", "candidates", "position", "positions", "opportunity", "opportunities", "day-to-day", "daily", "fast-paced", "dynamic",
  "mission", "culture", "needs", "need", "keep", "run", "improve", "train", "help", "ensure", "support", "provide", "make", "take", "get",
  "processes", "process", "technologies", "neighborhood", "clinics", "clinic", "hires", "hire", "order", "things", "thing", "people", "folks", "someone", "everyone", "day", "time",
]);

// Too broad to mean anything as a keyword on their own ("product", "developers").
const GENERIC_ALONE = new Set(["product", "products", "engineering", "developer", "developers", "platform", "platforms", "tools", "tooling", "team", "teams", "customer", "customers", "user", "users", "data", "software", "technology", "technical", "operations", "practices", "principles", "theories", "solutions", "programs", "program", "aspects", "decisions", "direction", "delivery", "projects", "resources", "stakeholders", "requirements", "standards", "systems", "code", "quality", "adoption", "support", "plans", "timelines", "budgets", "risk", "risks", "business", "change", "changes", "functions", "functional", "partners", "clients", "client", "leaders", "workflow", "workflows", "decision-making", "develop", "stay", "design", "activities", "strategies", "strategy", "processes", "process", "architectural"]);

// Location words that carry no skill.
const LOCATION_WORDS = new Set([
  "remote", "hybrid", "onsite", "on-site", "site", "office", "usa", "us", "u.s.", "america", "american", "canada", "uk", "europe", "emea",
  "united", "states", "kingdom", "north", "south", "east", "west", "metro", "area", "region", "city", "state", "worldwide", "global", "nationwide",
]);

const COMPANY_SUFFIX = new Set(["inc", "inc.", "llc", "ltd", "ltd.", "corp", "corp.", "co", "co.", "company", "corporation", "group", "holdings", "fictional"]);

function wordsOf(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\([^)]*\)/gu, " ")
    .split(/[^a-z0-9.+#/'-]+/u)
    .map((word) => word.replace(/^[.'-]+|[.'-]+$/gu, ""))
    .filter(Boolean);
}

/** Company and location context for filtering: from options, else the posting's own "Company:" / "Location:" lines. */
function postingContext(text, options) {
  const line = (label) => {
    const match = String(text || "").match(new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\*\\*)?${label}(?:\\*\\*)?\\s*:\\s*(.+)$`, "imu"));
    return match ? match[1].trim() : "";
  };
  const company = [options.company, line("company")].filter((v) => typeof v === "string" && v.trim());
  const location = [options.location, line("location")].filter((v) => typeof v === "string" && v.trim());
  const companyWords = new Set();
  const multiWordCompany = { value: false };
  const companyNames = new Set();
  company.forEach((name) => {
    const words = wordsOf(name).filter((w) => !COMPANY_SUFFIX.has(w));
    if (words.length) companyNames.add(words.join(" "));
    if (words.length > 1) multiWordCompany.value = true;
    words.filter((w) => w.length > 1).forEach((w) => companyWords.add(w));
  });
  const locationWords = new Set(LOCATION_WORDS);
  location.forEach((place) => wordsOf(place).forEach((w) => locationWords.add(w)));
  return { companyWords, companyNames, locationWords, multiWordCompany: multiWordCompany.value };
}

/** True when a keyword is noise: company name or fragment, location words, or generic filler. */
function isNoiseKeyword(keyword, context, known) {
  const words = wordsOf(keyword);
  if (words.length === 0) return true;
  const joined = words.join(" ");
  const knownSkill = known.has(keyword.toLowerCase());
  // The company's name, or a product name built on it ("Acme Dynamics Portal").
  for (const name of context.companyNames) {
    if (knownSkill && words.length === 1 && !context.multiWordCompany) continue;
    if (` ${joined} `.includes(` ${name} `)) return true;
  }
  if (words.every((w) => FILLER.has(w) || STOPWORDS.has(w) || context.locationWords.has(w))) return true;
  if (words.length === 1 && GENERIC_ALONE.has(words[0]) && !known.has(keyword.toLowerCase())) return true;
  // A fragment of the company name ("Family Health", "Cloud" in "Lumen Cloud"). A known skill
  // term survives only when it is several words or the company name is a single word.
  const keepAsSkill = knownSkill && (words.length > 1 || !context.multiWordCompany);
  if (!keepAsSkill && words.every((w) => context.companyWords.has(w) || FILLER.has(w) || context.locationWords.has(w))) return true;
  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\/]/gu, "\\$&");
}

/** Case-insensitive match where the term is not embedded in a larger word. */
function containsTerm(text, term) {
  const pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, "iu");
  return pattern.test(text);
}

function stripLine(line) {
  return line
    .replace(/^\s*(?:#{1,6}|[-*+•]|\d+[.)])\s*/u, "")
    .replace(/\*\*|__/gu, "")
    .replace(/[‘’]/gu, "'")
    .trim();
}

const isBulletLine = (raw) => /^\s*(?:[-*+•]|\d+[.)])\s/u.test(raw);

function isHeading(raw, stripped) {
  if (/^\s*#{1,6}\s/u.test(raw)) return true;
  if (isBulletLine(raw)) return false;
  if (!stripped) return false;
  if (/:\s*$/u.test(stripped)) return true;
  const short = stripped.split(/\s+/u).length <= 6 && !/[.,]$/u.test(stripped);
  return short && (REQUIRED_HEADING.test(stripped) || PREFERRED_HEADING.test(stripped) || IGNORE_HEADING.test(stripped));
}

/**
 * A short, unpunctuated line that is not a bullet and not a recognised heading,
 * such as "Client Engagement" or "Engineering & Data Foundations": a sub-heading
 * inside a section. Its words name a topic, not a skill, so the line is skipped.
 */
function isSubHeading(raw, stripped, known) {
  if (isBulletLine(raw) || /^\s*#/u.test(raw)) return false;
  const words = stripped.split(/\s+/u);
  if (words.length < 2 || words.length > 8 || /[.,;:!?]$/u.test(stripped)) return false;
  const connectors = new Set(["&", "and", "of", "the", "for", "to", "in", "a"]);
  const content = words.filter((w) => !connectors.has(w.toLowerCase()));
  if (!content.every((w) => /^[A-Z]/u.test(w))) return false;
  // "Python and SQL" on its own line is a skill list, not a sub-heading.
  const skills = content.filter((w) => known.has(w.toLowerCase().replace(/[^a-z0-9.+#/-]/gu, "")));
  return skills.length < content.length * 0.6;
}

function cleanPhrase(phrase) {
  const words = phrase
    .replace(/[“”"]/gu, "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  const edge = (word) => STOPWORDS.has(word.toLowerCase()) || FILLER.has(word.toLowerCase());
  while (words.length && edge(words[0])) words.shift();
  while (words.length && edge(words[words.length - 1])) words.pop();
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
      // A comma, colon or semicolon ends a run: "Platforms: Anthropic, Google" is a list, not one name.
      if (/[,;:]$/u.test(token)) flush();
    } else {
      flush();
    }
  }
  flush();
  return found;
}

const stem = (word) => word.toLowerCase().replace(/(?<=[a-z]{3})s$/u, "");
const stemmed = (phrase) => wordsOf(phrase).map(stem).join(" ");

/**
 * Drops a phrase that only restates another keyword: a plural of one already
 * kept ("developer platforms"), or a longer phrase that contains a known term
 * ("developer platform roadmap" when "developer platform" and "roadmap" are kept).
 */
function dropRedundant(buckets, known) {
  const all = [...buckets.required, ...buckets.preferred];
  const knownKept = all.filter((keyword) => known.has(keyword.toLowerCase()));
  const firstSeen = new Map();
  all.forEach((keyword) => {
    const key = stemmed(keyword);
    if (!firstSeen.has(key)) firstSeen.set(key, keyword);
  });
  const redundant = (keyword) => {
    if (firstSeen.get(stemmed(keyword)) !== keyword) return true;
    if (known.has(keyword.toLowerCase())) {
      // "analytics" next to "data analytics": the longer known term says it. Acronyms stay.
      if (/^[A-Z0-9/+.#-]+$/u.test(keyword)) return false;
      return knownKept.some((term) => wordsOf(term).length > wordsOf(keyword).length && containsTerm(stemmed(term), stemmed(keyword)));
    }
    return knownKept.some((term) => term.toLowerCase() !== keyword.toLowerCase() && wordsOf(keyword).length > wordsOf(term).length && containsTerm(stemmed(keyword), stemmed(term)));
  };
  buckets.required = buckets.required.filter((keyword) => !redundant(keyword));
  buckets.preferred = buckets.preferred.filter((keyword) => !redundant(keyword));
}

/**
 * @param {string} text posting text
 * @param {{ max?: number, company?: string, location?: string }} [options] company and
 *   location (also read from the posting's "Company:" / "Location:" lines) are used to
 *   drop the company name, its fragments, and place words from the results.
 * @returns {{ required: string[], preferred: string[] }}
 */
function extractPostingKeywords(text, options = {}) {
  const max = options.max || MAX_KEYWORDS;
  const lines = (typeof text === "string" ? text : "").split(/\r?\n/u);
  const buckets = { required: [], preferred: [] };
  const seen = new Set();
  const skillList = [...SKILL_KEYWORDS, ...KNOWN_TERMS];
  const known = new Set(skillList.map((term) => term.toLowerCase()));
  const context = postingContext(text, options);
  // How strong a keyword is when the cap forces a choice: 0 known skill or tool, 1 proper
  // name or acronym from the text, 2 plain noun phrase after "experience with" and the like.
  const rank = new Map();
  const add = (lineSection, value, kind = 2) => {
    if (isNoiseKeyword(value, context, known)) return;
    const canonical = skillList.find((term) => term.toLowerCase() === value.toLowerCase()) || value;
    const key = canonical.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rank.set(canonical, known.has(key) ? 0 : kind);
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
    // Saved-page notes ("> Saved on ..."), metadata lines (Source:, Retrieved:, Requisition:),
    // requisition hashtags (#LI-Hybrid), and pay, legal or process text are never skills.
    if (/^\s*>/u.test(raw) || /^\s*#[A-Za-z]+-/u.test(raw)) return;
    if (METADATA_LINE.test(stripped) || BOILERPLATE_LINE.test(stripped)) return;

    let body = stripped;
    let lineSection = section;
    if (isHeading(raw, stripped)) {
      const colon = stripped.indexOf(":");
      const headText = colon === -1 ? stripped : stripped.slice(0, colon);
      if (IGNORE_HEADING.test(headText)) {
        section = "ignore";
        return;
      }
      if (PREFERRED_HEADING.test(headText)) section = "preferred";
      else if (REQUIRED_HEADING.test(headText)) section = "required";
      lineSection = section;
      // "Nice to have: X, Y" carries content after the colon.
      if (colon === -1 || colon === stripped.length - 1) return;
      body = stripped.slice(colon + 1).trim();
    }
    // About-us, benefits and similar employer text, until the next requirement-style heading.
    if (section === "ignore") return;
    if (isSubHeading(raw, stripped, known)) return;
    if (lineSection === "required" && PREFERRED_INLINE.test(body)) lineSection = "preferred";

    // Long prose paragraphs name teams and organisations in Title Case ("Enterprise
    // Technology", "Specialty Services Group"); only bullets and short lines get that treatment.
    const prose = !isBulletLine(raw) && body.split(/\s+/u).length > 30;

    const candidates = [];
    skillList.forEach((term) => {
      if (containsTerm(body, term)) candidates.push({ pos: body.toLowerCase().indexOf(term.toLowerCase()), value: term, kind: 0 });
    });
    body.split(/(?<=[.!?])\s+/u).forEach((sentence) => {
      capitalisedTerms(sentence).forEach((term) => {
        if (prose && /\s/u.test(term)) return;
        const cleaned = cleanPhrase(term);
        if (cleaned && !STOPWORDS.has(cleaned.toLowerCase())) candidates.push({ pos: body.indexOf(term), value: cleaned, kind: 1 });
      });
    });
    let match;
    TRIGGER.lastIndex = 0;
    while ((match = TRIGGER.exec(body)) !== null) {
      // "set", "shape", "coordinate" and "own" are ordinary verbs in running prose.
      if (prose && /^(?:set|shape|coordinate|own)\b/iu.test(match[0])) continue;
      match[1]
        // Split on list words, but never inside a hyphenated word ("end-to-end", "human-in-the-loop").
        .split(/,|(?<![\w-])(?:and|or|across|for|to|in|on|with|at|by|of)(?![\w-])/iu)
        .forEach((piece) => {
          const cleaned = cleanPhrase(piece.replace(/\b(?:such as|e\.g\.|like)\b.*$/iu, ""));
          if (!cleaned || /^-|-$/u.test(cleaned)) return;
          // "is essential", "are required": a clause, not a skill. "developing X": a verb phrase.
          const cleanedWords = cleaned.toLowerCase().split(/\s+/u);
          if (cleanedWords.some((w) => ["is", "are", "be", "was", "were", "will", "can", "may", "should", "must", "has", "have"].includes(w))) return;
          if (cleanedWords.length > 1 && /ing$/u.test(cleanedWords[0]) && !known.has(cleaned.toLowerCase())) return;
          candidates.push({ pos: match.index, value: cleaned });
        });
    }

    candidates.sort((a, b) => a.pos - b.pos).forEach(({ value, kind }) => add(lineSection, value, kind));
  });

  dropRedundant(buckets, known);

  // Over the cap, the weakest phrases go first, never the known skills and proper names.
  const choose = (list, count) => {
    if (list.length <= count) return list;
    return list
      .map((keyword, index) => ({ keyword, index }))
      .sort((a, b) => rank.get(a.keyword) - rank.get(b.keyword) || a.index - b.index)
      .slice(0, count)
      .sort((a, b) => a.index - b.index)
      .map((item) => item.keyword);
  };
  // Required wins the cap: preferred only fills what is left.
  const required = choose(buckets.required, max);
  const preferred = choose(buckets.preferred, Math.max(0, max - required.length));
  return { required, preferred };
}

function allKeywords(keywords) {
  if (!keywords) return [];
  return [...(keywords.required || []), ...(keywords.preferred || [])];
}

module.exports = { extractPostingKeywords, allKeywords, containsTerm, MAX_KEYWORDS };
