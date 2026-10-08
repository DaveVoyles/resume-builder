"use strict";

/**
 * Keeps a resume from saying something the person has said they have not done.
 *
 * The person's "Not done" answers (see confirmations.js) are stored on their
 * notes evidence. A resume config that says one of those keywords, in its
 * summary, a bullet, a skills row or its headline, is blocked: `tailor` refuses
 * to render it and `validate` fails on it. There is no override flag. To use a
 * keyword they declined, the person says so, a new answer is recorded, and the
 * later answer wins (collectConfirmations).
 * No LLM, no network.
 */

const { collectConfirmations } = require("./confirmations");
const { collectSearchSites } = require("./keyword-coverage");
const { matchKeyword } = require("./keyword-match");

function resumeSites(config) {
  const sites = collectSearchSites(config);
  const headline = config && config.candidate && config.candidate.headline;
  if (typeof headline === "string" && headline.trim() !== "") sites.push({ where: "headline", text: headline });
  return sites;
}

/**
 * @returns {Array<{ keyword: string, where: string, matchedAs: string, date: string, evidenceId: string }>}
 */
function findDeclinedClaims(config, evidence) {
  const declined = collectConfirmations(evidence).filter((item) => item.status === "declined");
  if (declined.length === 0) return [];
  const sites = resumeSites(config);
  const found = [];
  for (const item of declined) {
    for (const site of sites) {
      const matchedAs = matchKeyword(site.text, item.keyword);
      if (matchedAs) found.push({ keyword: item.keyword, where: site.where, matchedAs, date: item.date, evidenceId: item.evidenceId });
    }
  }
  return found;
}

/** Plain-language error lines, one per keyword with every place it appears. */
function declinedClaimErrors(config, evidence) {
  const byKeyword = new Map();
  for (const claim of findDeclinedClaims(config, evidence)) {
    const entry = byKeyword.get(claim.keyword) || { claim, where: [] };
    entry.where.push(claim.where);
    byKeyword.set(claim.keyword, entry);
  }
  return [...byKeyword.values()].map(({ claim, where }) => {
    const when = claim.date ? ` on ${claim.date}` : "";
    return (
      `"${claim.keyword}" is on your not-done list (you said so${when}; evidence ${claim.evidenceId}), but this resume says it in: ${where.join("; ")}. ` +
      `Take it out. If it is now true, tell me, I will record the new answer first.`
    );
  });
}

module.exports = { declinedClaimErrors, findDeclinedClaims };
