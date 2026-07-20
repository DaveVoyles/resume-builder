"use strict";

/**
 * Extended sample workflow (design plan 0001, D9): runs the CLI directly
 * (not `npm run workspace:*`) against the fictional `examples/sample-candidate`
 * fixture to demonstrate the full agent-operated lifecycle end to end —
 * tracker + similar-role review + a rendered DOCX, plus tailor, set-status,
 * and study-guide-bundle.
 *
 * tailor/set-status/study-guide-bundle mutate workspace state
 * (roles.tracked.json, resume-configs/, outputs/study-guide-bundles/), so
 * this script runs them against a disposable copy of the sample workspace
 * in the OS temp dir rather than the committed fixtures under
 * examples/sample-candidate/ — see docs/playbooks/tailor.md's sample
 * walkthrough note: "the sample workspace's committed data stays limited to
 * the fixtures already checked in." The temp copy is deleted before this
 * script exits, so re-running `npm start` never leaves the working tree
 * dirty.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const cliPath = path.join(repoRoot, "src", "cli", "index.js");
const sampleDir = path.join(repoRoot, "examples", "sample-candidate");

function run(args) {
  console.log(`\n$ node src/cli/index.js ${args.join(" ")}`);
  execFileSync(process.execPath, [cliPath, ...args], {
    stdio: "inherit",
    cwd: repoRoot,
  });
}

function fabrikamResumeConfig() {
  // Mirrors the "Sample-candidate walkthrough" documented in
  // docs/playbooks/tailor.md: tailor the Fabrikam AI seed role
  // (roles.seed.json) using the same two evidence-backed bullets already
  // proven out for Northwind Tools (ev-001, ev-002).
  return {
    schemaVersion: "1.0",
    company: "Fabrikam AI",
    outputFileName: "alex-rivera-fabrikam-ai.docx",
    candidate: {
      name: "Alex Rivera",
      contact: [
        { text: "Raleigh, NC" },
        { text: "alex.rivera@example.invalid", link: "mailto:alex.rivera@example.invalid" },
        { text: "portfolio.example.invalid/alex-rivera", link: "https://portfolio.example.invalid/alex-rivera" },
      ],
    },
    summary: {
      text: "Fictional product and program leader focused on developer platforms, AI-assisted workflows, and launch readiness.",
      fitOverride: "Strong fit for Fabrikam AI's developer platform product manager opening.",
    },
    experienceSections: [
      {
        heading: "Experience",
        jobs: [
          {
            title: "Senior Platform Program Manager",
            company: "Contoso Labs",
            dates: "2022 - Present",
            subHeader: "Remote",
            bullets: [
              "Led launch coordination for an internal developer platform used by multiple product teams.",
              "Created a fictional demo project for documenting AI-assisted developer workflow experiments.",
            ],
          },
        ],
      },
    ],
    skills: [
      ["Developer platforms", "Platform strategy, internal tooling, developer experience"],
      ["AI workflows", "AI-assisted developer tooling, workflow automation"],
    ],
  };
}

function main() {
  console.log("== Resume Builder sample quickstart ==");
  console.log("Fictional candidate: Alex Rivera (examples/sample-candidate/). Nothing here is real.");

  console.log("\nStep 1/6: Build the application tracker (markdown + HTML) from the already-tracked sample role.");
  run(["build-tracker", "--workspace", sampleDir]);
  run(["build-tracker", "--workspace", sampleDir, "--format", "html"]);

  console.log("\nStep 2/6: Score manually researched candidate roles against the sample's seed role (find-roles playbook, D6).");
  run(["find-similar", "--workspace", sampleDir, "--candidates", path.join(sampleDir, "roles.similar.candidates.json")]);

  console.log("\nStep 3/6: Render the already-tracked Northwind Tools resume config to a DOCX file.");
  run(["render-resume", "--workspace", sampleDir, "--config", path.join(sampleDir, "resume-configs", "northwind-tools-senior-pm.json")]);

  console.log(
    "\nStep 4/6: Exercise tailor, set-status, and study-guide-bundle (the rest of the lifecycle) in a disposable copy of the" +
      " sample workspace — this never mutates the committed examples/sample-candidate fixtures.",
  );
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "resume-builder-quickstart-"));
  const tmpWorkspace = path.join(tmpRoot, "sample-candidate");
  try {
    fs.cpSync(sampleDir, tmpWorkspace, { recursive: true });

    const fabrikamConfigPath = path.join(tmpWorkspace, "resume-configs", "fabrikam-ai-developer-platform-pm.json");
    fs.writeFileSync(fabrikamConfigPath, `${JSON.stringify(fabrikamResumeConfig(), null, 2)}\n`);

    console.log("\n  tailor: validate + audit + render + track the Fabrikam AI role in one pass (tailor playbook, D4).");
    run([
      "tailor",
      "--workspace",
      tmpWorkspace,
      "--config",
      fabrikamConfigPath,
      "--url",
      "https://jobs.example.invalid/fabrikam/developer-platform-product-manager",
      "--title",
      "Developer platform product manager",
    ]);

    console.log("\n  set-status: record the candidate applying, the way an agent maps \"I applied to X\" to one command (D7).");
    run([
      "set-status",
      "--workspace",
      tmpWorkspace,
      "--company",
      "Fabrikam AI",
      "--title",
      "Developer platform product manager",
      "--status",
      "applied",
    ]);

    console.log("\n  study-guide-bundle: gather profile + evidence + resume config + JD context for interview prep (study-guide playbook, D8).");
    run([
      "study-guide-bundle",
      "--workspace",
      tmpWorkspace,
      "--company",
      "Fabrikam AI",
      "--title",
      "Developer platform product manager",
    ]);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    console.log(`\n  (Disposable workspace copy at ${tmpRoot} cleaned up.)`);
  }

  console.log("\nStep 5/6: Validate the committed sample workspace (schema + evidence-backed claim audit + privacy boundaries).");
  run(["validate", "--workspace", sampleDir]);

  console.log(
    "\nStep 6/6: Done. See examples/sample-candidate/outputs/ for the tracker (tracker.md / tracker.html) and the rendered" +
      " DOCX under outputs/resumes/Northwind Tools/.",
  );
}

main();
