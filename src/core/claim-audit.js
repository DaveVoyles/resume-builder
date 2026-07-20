"use strict";

/**
 * Evidence-backed claim audit (design plan 0001, D3 — see
 * docs/accuracy-and-claims.md's "Evidence-ledger checks" section and
 * docs/workspace-schemas.md's evidence.jsonl reference).
 *
 * Concept ported from the private upstream implementation's claim-audit
 * script: extract numeric/metric claims from resume-facing text with regex,
 * then check each one against a source of truth. The private script
 * compared claims against live personal-infrastructure state (OpenClaw
 * skill counts, Slack command counts, homelab container counts — none of it
 * portable to a generic public tool). This port keeps the technique
 * (regex-extracted numeric claims, exact-value comparison, per-claim
 * failure messages) but compares against this repo's actual "evidence-
 * backed" mechanism instead: the workspace's `evidence.jsonl` ledger.
 *
 * A "claim" here is a metric embedded in resume-facing text: a percentage,
 * a multiplier, a money amount, a scaled count ("50 million users"), a
 * plain count with a resume-typical noun ("200 customers"), a team size, or
 * years of experience. Each has its own regex so a claim's category is
 * unambiguous — a "40%" claim is only satisfied by evidence stating the
 * same figure as a percentage, never by an unrelated "40 employees" entry.
 */

const CLAIM_PATTERNS = [
  {
    id: "percentage",
    label: "percentage",
    regex: /(\d{1,3}(?:\.\d+)?)\s?(?:%|percent\b)/giu,
    format: (value) => `${value}%`,
  },
  {
    id: "multiplier",
    label: "multiplier",
    regex: /(\d{1,4}(?:\.\d+)?)\s?x(?![a-zA-Z])/giu,
    format: (value) => `${value}x`,
  },
  {
    id: "money",
    label: "money amount",
    regex: /\$\s?(\d[\d,]*(?:\.\d+)?)\s?(million|thousand|billion|mm|bn|[mbk])?\b/giu,
    format: (value, scale) => `$${value}${scale ? ` ${scale}` : ""}`,
    hasQualifier: true,
  },
  {
    id: "team-size",
    label: "team size",
    regex: /team of (\d{1,3})\b/giu,
    format: (value) => `team of ${value}`,
  },
  {
    id: "counted-noun",
    label: "count",
    // Deliberately a closed whitelist, not general noun detection (avoids
    // regex complexity that would false-positive on incidental numbers near
    // arbitrary nouns — see extractNumericClaims's design note in the
    // ported private-repo script this concept came from). Known limitation:
    // a metric using a noun outside this list (e.g. "50 stakeholders", "3
    // patents") is not extracted as a claim and so isn't audited — see
    // docs/accuracy-and-claims.md's "Evidence-backed claim audit" section.
    regex:
      /(\d{1,3}(?:,\d{3})*)\+?\s+(users|customers|clients|subscribers|downloads|installs|requests|transactions|records|employees|engineers|developers|people|teams|projects|releases|deployments|incidents|tickets|integrations|services|servers|containers|repositories|repos|applications|apps|products|countries|markets|languages|reports|dashboards|stakeholders|vendors|partners|patents|awards|certifications|accounts|sites|locations|offices|regions|campaigns|features|hires|candidates|workshops|sessions|milestones|sprints|contracts|initiatives|programs|pipelines|workflows|alerts)\b/giu,
    format: (value, noun) => `${value} ${noun}`,
    hasQualifier: true,
  },
  {
    id: "scaled-count",
    label: "scaled count",
    regex: /(\d{1,4}(?:\.\d+)?)\+?\s?(million|thousand|billion|mm|bn|[mbk])\b/giu,
    format: (value, scale) => `${value} ${scale}`,
    hasQualifier: true,
  },
  {
    id: "years-experience",
    label: "years of experience",
    regex: /(\d{1,2})\+?\s?years?(?:\s+of)?\s+experience\b/giu,
    format: (value) => `${value}+ years experience`,
  },
];

// Categories whose qualifier changes the claim's substance ("$2" vs "$2
// million" are very different amounts) require an exact qualifier match to
// count as supported. Categories whose qualifier is closer to a cosmetic
// synonym (e.g. "customers" vs "clients") only require the numeric value to
// match, so evidence phrased slightly differently from the resume bullet
// still counts as support.
const STRICT_QUALIFIER_CATEGORIES = new Set(["money", "scaled-count"]);

// Patterns are ordered from most to least specific (money and team-size
// claims are also valid, less-specific counted-noun/scaled-count matches:
// "$2 million" would otherwise double-count as both a money claim and a
// scaled-count claim, and "team of 40 engineers" as both a team-size claim
// and a counted-noun claim). extractClaims resolves overlapping matches by
// this priority order so each span in the source text yields exactly one
// claim.

function normalizeScale(raw) {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower === "m" || lower === "mm" || lower === "million") return "million";
  if (lower === "b" || lower === "bn" || lower === "billion") return "billion";
  if (lower === "k" || lower === "thousand") return "thousand";
  return lower;
}

/**
 * Normalizes a matched numeric string for comparison: "40.0" and "40" (or
 * "3.0" and "3") must produce the same claim key, or a config claim and its
 * supporting evidence entry would fail to match purely on cosmetic
 * formatting differences — a false "unsupported claim" block on a claim
 * that is, in fact, evidence-backed.
 */
function normalizeValue(raw) {
  return String(Number(raw));
}

/**
 * Extracts metric claims from free text. Returns an array of
 * { category, label, value, qualifier, scale, text, snippet } objects.
 * `value` is the normalized numeric string (commas stripped); `snippet` is
 * a short surrounding excerpt for error messages.
 */
function extractClaims(text) {
  if (typeof text !== "string" || text.length === 0) return [];

  const candidates = [];
  CLAIM_PATTERNS.forEach((pattern, priority) => {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const value = normalizeValue(match[1].replace(/,/gu, ""));
      const scale = pattern.id === "money" || pattern.id === "scaled-count" ? normalizeScale(match[2]) : undefined;
      const qualifier = pattern.hasQualifier ? (scale || match[2]) : undefined;
      const contextStart = Math.max(0, match.index - 25);
      const contextEnd = Math.min(text.length, match.index + match[0].length + 25);
      candidates.push({
        category: pattern.id,
        label: pattern.label,
        value,
        qualifier,
        scale,
        text: pattern.format(value, scale || match[2]),
        snippet: text.slice(contextStart, contextEnd).replace(/\s+/gu, " ").trim(),
        priority,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  });

  // Resolve overlapping matches (e.g. "$2 million" matching both "money"
  // and "scaled-count") by keeping the highest-priority (most specific)
  // candidate for each span and discarding lower-priority candidates that
  // overlap it, so one figure in the text produces exactly one claim.
  candidates.sort((a, b) => a.priority - b.priority || a.start - b.start);
  const claimedRanges = [];
  const accepted = [];
  for (const candidate of candidates) {
    const overlapsExisting = claimedRanges.some(([start, end]) => candidate.start < end && candidate.end > start);
    if (overlapsExisting) continue;
    claimedRanges.push([candidate.start, candidate.end]);
    accepted.push(candidate);
  }

  accepted.sort((a, b) => a.start - b.start);
  return accepted.map(({ priority, start, end, ...claim }) => claim);
}

/**
 * Builds the comparison key used to decide whether an evidence-side claim
 * supports a config-side claim of the same category and value. Strict
 * categories fold the qualifier into the key; lenient categories ignore it.
 */
function claimKey(claim) {
  if (STRICT_QUALIFIER_CATEGORIES.has(claim.category)) {
    return `${claim.category}:${claim.value}:${claim.qualifier || ""}`;
  }
  return `${claim.category}:${claim.value}`;
}

function isNonBlankString(value) {
  return typeof value === "string" && value.trim() !== "";
}

/** Evidence text that can support a claim: fact + snippet + quote, skipping metadata-only entries. */
function supportingText(entry) {
  if (!entry || entry.confidence === "metadata-only") return "";
  return [entry.fact, entry.snippet, entry.quote].filter(isNonBlankString).join(" \n ");
}

function buildEvidenceClaimIndex(evidenceEntries) {
  const index = new Set();
  for (const entry of evidenceEntries || []) {
    const text = supportingText(entry);
    if (!text) continue;
    for (const claim of extractClaims(text)) {
      index.add(claimKey(claim));
    }
  }
  return index;
}

/** Locates every claim-bearing text field in a resume config, with a human-readable location and context. */
function collectConfigClaimSites(config) {
  const sites = [];

  if (config.summary && isNonBlankString(config.summary.text)) {
    sites.push({ path: "summary.text", text: config.summary.text });
  }

  (config.experienceSections || []).forEach((section, sIndex) => {
    (section.jobs || []).forEach((job, jIndex) => {
      const context = [job.title, job.company].filter(Boolean).join(" — ");
      (job.bullets || []).forEach((bullet, bIndex) => {
        sites.push({
          path: `experienceSections[${sIndex}].jobs[${jIndex}].bullets[${bIndex}]`,
          text: bullet,
          context,
        });
      });
    });
  });

  (config.skills || []).forEach((row, i) => {
    if (Array.isArray(row) && isNonBlankString(row[1])) {
      sites.push({ path: `skills[${i}]`, text: row[1], context: row[0] });
    }
  });

  return sites;
}

const THIN_LEDGER_THRESHOLD = 3;

/** Counts source-backed (non-metadata-only, snippet/quote-bearing) evidence entries and flags a thin ledger. */
function assessLedgerStrength(evidenceEntries, threshold = THIN_LEDGER_THRESHOLD) {
  const sourceBackedCount = (evidenceEntries || []).filter((entry) => isNonBlankString(supportingText(entry))).length;
  if (sourceBackedCount >= threshold) {
    return { thin: false, sourceBackedCount };
  }
  return {
    thin: true,
    sourceBackedCount,
    message:
      `Evidence ledger is thin: only ${sourceBackedCount} source-backed evidence ${sourceBackedCount === 1 ? "entry is" : "entries are"} ` +
      `available (recommended minimum: ${threshold}). Metric claims in this resume config rest on a narrow evidence base — ` +
      "ingest more source material (resumes, notes, GitHub activity) before treating generated claims as fully vetted.",
  };
}

/**
 * Audits metric claims extracted from a set of claim sites (e.g. resume bullets,
 * summary text) against a workspace's evidence ledger. Generic utility that
 * operates on claim sites with the shape { path, text, context? } — used
 * internally by auditResumeConfig and intended for use by other auditing
 * consumers (e.g. cover letter claim auditing, per plan 0004).
 *
 * Returns { errors, warnings, claimsFound }. `errors` is blocking (per plan
 * 0001 Decision 8, claim guards block `validate`, they don't just warn);
 * `warnings` covers ledger-strength messaging, which is informational and
 * never blocks.
 */
function auditClaims(claimSites, evidenceEntries) {
  const evidenceIndex = buildEvidenceClaimIndex(evidenceEntries);
  const errors = [];
  const claimsFound = [];

  (claimSites || []).forEach((site) => {
    for (const claim of extractClaims(site.text)) {
      claimsFound.push({ ...claim, path: site.path });
      if (!evidenceIndex.has(claimKey(claim))) {
        const locationLabel = site.context ? `${site.path} (${site.context})` : site.path;
        errors.push(
          `Unsupported claim at ${locationLabel}: "${claim.text}" in "${claim.snippet}" — no evidence.jsonl entry ` +
            `(fact/snippet/quote, excluding metadata-only entries) supports this ${claim.label}. Add a source-backed ` +
            "evidence entry confirming this figure, or rephrase the claim without an unverified number.",
        );
      }
    }
  });

  const warnings = [];
  const ledger = assessLedgerStrength(evidenceEntries);
  if (ledger.thin) warnings.push(ledger.message);

  return { errors, warnings, claimsFound };
}

/**
 * Audits every claim-bearing field in a resume config against a workspace's
 * evidence ledger. Returns { errors, warnings, claimsFound }. `errors` is
 * blocking (per plan 0001 Decision 8, claim guards block `validate`, they
 * don't just warn); `warnings` covers ledger-strength messaging, which is
 * informational and never blocks.
 *
 * Thin wrapper: collects claim sites from the config, then delegates to
 * auditClaims for the generic audit logic.
 */
function auditResumeConfig(config, evidenceEntries) {
  const claimSites = collectConfigClaimSites(config || {});
  return auditClaims(claimSites, evidenceEntries);
}

/** Locates every claim-bearing text field in a cover letter config, with a human-readable location and context. */
function collectCoverLetterClaimSites(config) {
  const sites = [];

  (config.bodyParagraphs || []).forEach((paragraph, i) => {
    if (isNonBlankString(paragraph)) {
      sites.push({ path: `bodyParagraphs[${i}]`, text: paragraph });
    }
  });

  return sites;
}

/**
 * Audits every claim-bearing field in a cover letter config against a workspace's
 * evidence ledger. Returns { errors, warnings, claimsFound }. `errors` is
 * blocking (per plan 0004, claim guards block validation, they don't just warn);
 * `warnings` covers ledger-strength messaging, which is informational and never blocks.
 *
 * Thin wrapper: collects claim sites from the config, then delegates to
 * auditClaims for the generic audit logic.
 */
function auditCoverLetterConfig(config, evidenceEntries) {
  const claimSites = collectCoverLetterClaimSites(config || {});
  return auditClaims(claimSites, evidenceEntries);
}

module.exports = {
  CLAIM_PATTERNS,
  THIN_LEDGER_THRESHOLD,
  assessLedgerStrength,
  auditClaims,
  auditCoverLetterConfig,
  auditResumeConfig,
  claimKey,
  collectCoverLetterClaimSites,
  collectConfigClaimSites,
  extractClaims,
};
