"use strict";

const fs = require("fs");
const path = require("path");
const { fetchGithubMetadata } = require("../../adapters/github");
const { readTextSource } = require("../../adapters/freeform-notes");
const { createEvidenceEntry, createChunkEvidenceEntry, appendUniqueEvidence, snippet } = require("../../core/evidence-ledger");
const { chunkResumeText } = require("../../core/resume-chunker");
const { mergeProfileSource } = require("../../core/candidate-profile");
const { syncOnboardingState } = require("../../core/onboarding-state");
const { tryRebuildTrackers } = require("./build-tracker");
const { asArray } = require("../args");
const {
  readJson,
  resolveWorkspace,
  relativeToWorkspace,
  workspacePaths,
  writeJson,
} = require("../../core/workspace");

const REPLACE_SCAN_KEYS = ["resume", "notes", "input", "source"];
const INTAKE_TEMPLATE_PATH = path.resolve(__dirname, "../../../templates/candidate-intake.md");
const SUPPORTED_EXTENSIONS = new Set([
  ".docx",
  ".pptx",
  ".pdf",
  ".md",
  ".markdown",
  ".txt",
  ".json",
  ".csv",
  ".tsv",
]);

function hasReplaceScanFlags(options) {
  if (options.github) return true;
  return REPLACE_SCAN_KEYS.some((key) => asArray(options[key]).length > 0);
}

function collectFlagSources(options) {
  return [
    ...asArray(options.resume).map((file) => ({ file, kind: "resume" })),
    ...asArray(options.notes).map((file) => ({ file, kind: "notes" })),
    ...asArray(options.links).map((file) => ({ file, kind: "links" })),
    ...asArray(options.input).map((file) => ({ file, kind: "source" })),
    ...asArray(options.source).map((file) => ({ file, kind: "source" })),
  ];
}

function displayPath(workspace, filePath) {
  return relativeToWorkspace(workspace, filePath) || filePath;
}

function skipEntry(workspace, filePath, reason) {
  console.log(`Skipped ${displayPath(workspace, filePath)}: ${reason}`);
}

function normalizeTemplateText(text) {
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
}

function isUnchangedIntakeTemplate(filePath, templateNormalized) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    return false;
  }
  return normalizeTemplateText(text) === templateNormalized;
}

function hasLinkContent(text) {
  return String(text)
    .split(/\r?\n/)
    .some((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith("#");
    });
}


function collectDefaultFolderSources(workspace, paths) {
  const sources = [];
  const folders = [
    { dir: paths.resumes, kind: "resume" },
    { dir: paths.notes, kind: "notes" },
  ];
  let intakeTemplateNormalized = "";
  try {
    intakeTemplateNormalized = normalizeTemplateText(fs.readFileSync(INTAKE_TEMPLATE_PATH, "utf8"));
  } catch (error) {
    intakeTemplateNormalized = "";
  }

  for (const { dir, kind } of folders) {
    if (!fs.existsSync(dir)) continue;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        skipEntry(workspace, fullPath, "directory");
        continue;
      }
      if (!entry.isFile()) {
        skipEntry(workspace, fullPath, "unsupported type");
        continue;
      }
      if (entry.name.startsWith(".")) {
        skipEntry(workspace, fullPath, "dotfile");
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        skipEntry(workspace, fullPath, "unsupported type");
        continue;
      }
      let size = 0;
      try {
        size = fs.statSync(fullPath).size;
      } catch (error) {
        skipEntry(workspace, fullPath, "unsupported type");
        continue;
      }
      if (size === 0) {
        skipEntry(workspace, fullPath, "empty");
        continue;
      }
      if (kind === "notes" && entry.name === "intake.md" && isUnchangedIntakeTemplate(fullPath, intakeTemplateNormalized)) {
        skipEntry(workspace, fullPath, "blank template");
        continue;
      }
      console.log(`Read ${displayPath(workspace, fullPath)}`);
      sources.push({ file: fullPath, kind });
    }
  }

  const linksPath = paths.links;
  if (fs.existsSync(linksPath)) {
    let linksStat;
    try {
      linksStat = fs.statSync(linksPath);
    } catch (error) {
      linksStat = null;
    }
    if (linksStat && linksStat.isFile()) {
      let linksText = "";
      try {
        linksText = fs.readFileSync(linksPath, "utf8");
      } catch (error) {
        linksText = null;
      }
      if (linksText !== null) {
        if (!hasLinkContent(linksText)) {
          skipEntry(workspace, linksPath, "no links (only blank or comment lines)");
        } else {
          console.log(`Read ${displayPath(workspace, linksPath)}`);
          sources.push({ file: linksPath, kind: "links" });
        }
      }
    }
  }

  return sources;
}

function collectSources(options, workspace, paths) {
  const flagSources = collectFlagSources(options);
  if (hasReplaceScanFlags(options) || !workspace || !paths) return flagSources;
  const folderSources = collectDefaultFolderSources(workspace, paths);
  const seen = new Set(folderSources.map((source) => path.resolve(source.file)));
  for (const source of flagSources) {
    const resolved = path.resolve(source.file);
    if (seen.has(resolved)) continue;
    folderSources.push(source);
    seen.add(resolved);
  }
  return folderSources;
}

async function ingestLocalSources(sources, workspace, paths, profile, deps = {}) {
  const entries = [];
  let nextProfile = profile;
  for (const source of sources) {
    const read = readTextSource(source.file, deps);
    const relativePath = relativeToWorkspace(workspace, read.path);
    if (read.warning) {
      console.warn(`⚠ ${relativePath}: ${read.warning}`);
    }
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
    if (path.extname(read.path).toLowerCase() === ".pdf" && !read.text) {
      console.log(
        `I can't read the text inside ${path.basename(read.path)}. ` +
          "Please save a Word (.docx) or plain text copy of that resume in my-documents and tell me when it's there, " +
          "so each job and bullet can be used as proof.",
      );
    }
    if (source.kind === "resume" && read.text) {
      // The whole-file entry above stays for compatibility. These add one
      // entry per job header, bullet, or paragraph so a number deep in the
      // resume can be cited on its own. A one-piece resume adds nothing new.
      const chunks = chunkResumeText(read.text);
      const seen = new Map();
      if (!(chunks.length === 1 && snippet(chunks[0].text, 600) === snippet(read.text, 600))) {
        for (const chunk of chunks) {
          const key = `${chunk.kind}|${chunk.organization || ""}|${chunk.dateRange || ""}|${chunk.text}`;
          const occurrence = seen.get(key) || 0;
          seen.set(key, occurrence + 1);
          entries.push(
            createChunkEvidenceEntry({ type: source.kind, source: sourceInfo, chunk, occurrence, metadata: read.metadata }),
          );
        }
      }
    }
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

function noFilesFoundMessage(workspace, paths) {
  const resumesDisplay = displayPath(workspace, paths.resumes);
  const notesDisplay = displayPath(workspace, paths.notes);
  return `No files found in ${resumesDisplay} or ${notesDisplay}. Add files there or pass --resume/--notes.`;
}

async function run(options, deps = {}) {
  const workspace = resolveWorkspace(options.workspace);
  const paths = workspacePaths(workspace);
  let profile = readJson(paths.profile);
  const sources = collectSources(options, workspace, paths);

  const local = await ingestLocalSources(sources, workspace, paths, profile, deps);
  profile = local.profile;
  const github = await ingestGithub(options, paths, profile);
  profile = github.profile;

  writeJson(paths.profile, profile);
  const sourceCount = sources.length + (options.github ? 1 : 0);
  syncOnboardingState(workspace);
  tryRebuildTrackers(workspace);
  console.log(`Ingested ${sourceCount} source(s); appended ${local.appended + github.appended} evidence entr${local.appended + github.appended === 1 ? "y" : "ies"}.`);
  if (sourceCount === 0) console.log(noFilesFoundMessage(workspace, paths));
  if (profile.sources?.length) console.log(`Profile now references ${profile.sources.length} source(s). Latest snippet: ${snippet(profile.sources.at(-1).path || profile.sources.at(-1).url || "", 80)}`);
}

module.exports = { run };
