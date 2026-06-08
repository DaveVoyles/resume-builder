"use strict";

const { fetchGithubMetadata } = require("../../adapters/github");
const { readTextSource } = require("../../adapters/freeform-notes");
const { createEvidenceEntry, appendUniqueEvidence, snippet } = require("../../core/evidence-ledger");
const { mergeProfileSource } = require("../../core/candidate-profile");
const { asArray } = require("../args");
const {
  readJson,
  resolveWorkspace,
  relativeToWorkspace,
  workspacePaths,
  writeJson,
} = require("../../core/workspace");

function collectSources(options) {
  return [
    ...asArray(options.resume).map((file) => ({ file, kind: "resume" })),
    ...asArray(options.notes).map((file) => ({ file, kind: "notes" })),
    ...asArray(options.input).map((file) => ({ file, kind: "source" })),
    ...asArray(options.source).map((file) => ({ file, kind: "source" })),
  ];
}

async function ingestLocalSources(options, workspace, paths, profile) {
  const entries = [];
  let nextProfile = profile;
  for (const source of collectSources(options)) {
    const read = readTextSource(source.file);
    const relativePath = relativeToWorkspace(workspace, read.path);
    const sourceInfo = {
      kind: source.kind,
      path: relativePath,
      sha256: read.metadata.sha256,
      ingestedAt: new Date().toISOString(),
      extractionMode: read.metadata.extractionMode,
    };
    entries.push(
      createEvidenceEntry({
        type: source.kind,
        source: sourceInfo,
        text: read.text,
        summary: `${source.kind} source ingested from ${relativePath}`,
        metadata: read.metadata,
      }),
    );
    nextProfile = mergeProfileSource(nextProfile, sourceInfo, read.text);
  }
  const appended = appendUniqueEvidence(paths.evidence, entries);
  return { profile: nextProfile, appended };
}

async function ingestGithub(options, paths, profile) {
  if (!options.github) return { profile, appended: 0 };
  const metadata = await fetchGithubMetadata(options.github);
  const source = {
    kind: "github",
    url: metadata.profile.html_url,
    username: metadata.username,
    ingestedAt: new Date().toISOString(),
  };
  const text = [
    metadata.profile.name,
    metadata.profile.bio,
    metadata.profile.company,
    metadata.profile.location,
    metadata.profile.blog,
    metadata.repos.map((repo) => `${repo.name}: ${repo.description || ""} ${repo.language || ""} ${(repo.topics || []).join(" ")}`).join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
  const entries = [
    createEvidenceEntry({
      type: "github_profile",
      source,
      text,
      summary: `Public GitHub metadata for ${metadata.username}`,
      metadata: {
        publicRepos: metadata.profile.public_repos,
        followers: metadata.profile.followers,
        reposCaptured: metadata.repos.length,
      },
    }),
  ];
  const nextProfile = mergeProfileSource(
    {
      ...profile,
      github: {
        username: metadata.username,
        url: metadata.profile.html_url,
        repos: metadata.repos.slice(0, 25),
      },
    },
    source,
    text,
  );
  const appended = appendUniqueEvidence(paths.evidence, entries);
  return { profile: nextProfile, appended };
}

async function run(options) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  let profile = readJson(paths.profile);

  const local = await ingestLocalSources(options, workspace, paths, profile);
  profile = local.profile;
  const github = await ingestGithub(options, paths, profile);
  profile = github.profile;

  writeJson(paths.profile, profile);
  const sourceCount = collectSources(options).length + (options.github ? 1 : 0);
  console.log(`Ingested ${sourceCount} source(s); appended ${local.appended + github.appended} evidence entr${local.appended + github.appended === 1 ? "y" : "ies"}.`);
  if (sourceCount === 0) console.log("No sources provided. Use --resume, --notes, --input, or --github.");
  if (profile.sources?.length) console.log(`Profile now references ${profile.sources.length} source(s). Latest snippet: ${snippet(profile.sources.at(-1).path || profile.sources.at(-1).url || "", 80)}`);
}

module.exports = { run };
