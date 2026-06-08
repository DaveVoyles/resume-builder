# Generator refactor plan

Try this:

```text
Use this plan before you add modular DOCX resume generation.
Keep the sidecar generator separate until workspace output is validated.
```

This plan splits the current generator into data-driven templates, renderers, role strategy, and workspace outputs. It assumes the v1 workspace CLI already owns candidate intake, evidence, role storage, tracker rendering, and validation.

---

## Problem statement

The private Dave resume workflow proves that role-specific DOCX generation is useful, but it is not reusable as a modular product because candidate facts, role strategy, and rendering decisions are coupled to one person's application history. A friend-facing workflow needs resume generation to read structured workspace data instead of asking each candidate to edit JavaScript.

The modular workspace already stores candidate facts, evidence, preferences, seed roles, tracked roles, and tracker output under stable paths. Resume generation should consume those structured files instead of treating code as the source of truth.

## Proposed architecture

The generator should become a pipeline with four separable responsibilities:

1. Load workspace data.
2. Build a role-specific resume plan.
3. Render the plan to DOCX and metadata outputs.
4. Validate that generated claims and files match the workspace records.

### Target modules

| Module | Proposed path | Responsibility | Inputs | Outputs |
| --- | --- | --- | --- | --- |
| Workspace loader | `src/core/workspace.js` plus `src/core/generation-inputs.js` | Read profile, preferences, evidence, claim policy, and tracked roles. | Candidate workspace path. | Normalized generation input object. |
| Resume model | `src/core/resume-model.js` | Define neutral resume sections, bullets, links, skills, and metadata. | Profile facts and evidence references. | Renderer-independent resume document model. |
| Role analysis | `src/core/role-analysis.js` | Normalize title, company, seniority, keywords, requirements, compensation, and gaps from structured role data. | `roles.seed.json`, `roles.tracked.json`, and posting fields. | Role requirement summary and fit inputs. |
| Role strategy | `src/core/role-strategy.js` | Choose summary, section order, emphasized evidence, bullets to include, gaps to soften, and claims to avoid. | Resume model, role analysis, preferences, claim policy. | `resumePlan` with evidence IDs for each claim. |
| Claim guard | `src/core/claim-policy.js` | Enforce evidence confidence, blocked phrases, metric rules, and candidate-review gates. | `resumePlan`, `evidence.jsonl`, `claim-policy.json`. | Approved plan or validation errors. |
| Templates | `src/templates/resume/` | Store reusable section templates, style presets, and role-family defaults. | `resumePlan` and style preset. | Template-specific render instructions. |
| DOCX renderer | `src/renderers/docx-resume.js` | Convert a renderer-independent plan to a DOCX file using `docx`. | Template render instructions. | DOCX resume file. |
| Markdown renderer | `src/renderers/markdown-tracker.js` and future `src/renderers/generation-summary.js` | Render tracker, generation manifest, follow-up questions, and review notes. | Tracked role records and generation results. | Markdown and JSON outputs. |
| Generate command | `src/cli/commands/generate-resumes.js` | Orchestrate role selection, plan creation, rendering, manifest updates, and validation handoff. | Workspace path and optional role IDs. | Files under `outputs/`. |

### Data-driven template contract

Templates should not contain candidate facts. They should define reusable structure:

- Section order, such as summary, experience, selected projects, skills, education, and links.
- Section limits, such as maximum bullets per role and maximum skills per group.
- Role-family emphasis, such as developer relations, technical program management, product management, or platform engineering.
- Style choices, such as concise executive summary, technical depth, metric density, and one-page or two-page output.

Candidate facts stay in `profile.json` and `evidence.jsonl`. Role-specific choices stay in `roles.tracked.json`, `preferences.json`, and the generated `resumePlan`.

### Role strategy contract

Role strategy is the decision layer between data and rendering. It should produce a deterministic JSON object that a renderer can consume without knowing why a bullet was selected.

Minimum `resumePlan` shape:

```json
{
  "schemaVersion": "1.0",
  "roleId": "role-tracked-001",
  "candidateId": "sample-candidate",
  "templateId": "technical-program-manager",
  "outputPath": "outputs/resumes/sample-candidate-fabrikam-tpm.docx",
  "strategy": {
    "headline": "Technical program leader for AI developer platforms",
    "emphasis": ["developer platforms", "AI workflow adoption", "launch coordination"],
    "sectionOrder": ["summary", "experience", "selectedProjects", "skills", "education"],
    "claimsToAvoid": ["unconfirmed budget ownership"]
  },
  "sections": [
    {
      "id": "summary",
      "items": [
        {
          "text": "Product-minded technical program leader focused on AI-assisted developer workflows.",
          "evidenceIds": ["ev-001"],
          "confidence": "high"
        }
      ]
    }
  ],
  "reviewRequired": []
}
```

Each rendered bullet, summary sentence, skill group, and project highlight must include evidence IDs unless it is static contact or formatting text.

### Workspace outputs

Generated outputs should stay under the workspace output root and remain ignored by default:

```text
outputs/
  resumes/
    <company>/
      <candidate>-<role-slug>.docx
  tracker.md
  similar-roles.md
  follow-up-questions.md
  generation-manifest.json
  generation-review.md
```

`generation-manifest.json` should record role ID, output path, template ID, source data hashes, evidence IDs used, generated timestamp, and validation status. This gives tracker generation and parity checks a stable source without parsing DOCX files.

## What changes

- Resume generation reads candidate and role data from workspace files.
- Role positioning moves from hand-coded builder functions to role strategy objects.
- Templates define reusable structure rather than candidate-specific language.
- Renderers receive a normalized plan and write outputs without making strategy decisions.
- Tracker rows and generation manifests come from structured role data and generation results.

## What stays the same

- The private Dave repo remains the reference workflow for legacy generated DOCX behavior.
- Root workspace commands remain focused on reusable candidate workflows.
- `npm run validate` remains the modular handoff gate for this repo.
- The existing DOCX visual style can be reused in the new DOCX renderer.
- The current tracker table shape remains the default markdown output.

## Migration order

### Phase 0: Freeze parity evidence

1. Run the private Dave workflow without changing generator behavior.
2. Record the expected role count, output filenames, tracker rows, and validation command results in the private repo.
3. Treat private generated DOCX files as optional baseline artifacts. Do not copy them into this modular repo.

### Phase 1: Extract read-only contracts

1. Add `resumePlan`, template, role strategy, and generation manifest schemas.
2. Add tests or fixtures that validate schema shape with fictional sample data.
3. Keep the sidecar contracts independent from any private candidate generator.

### Phase 2: Build the sidecar generator

1. Add `generate-resumes` as a new workspace command.
2. Implement workspace loading, role filtering, role strategy, claim guard checks, and manifest writing.
3. Render a fictional sample candidate first, then compare against private legacy outputs only after sample validation passes.

### Phase 3: Port reusable rendering helpers

1. Copy reusable DOCX style helpers into `src/renderers/docx-resume.js` or `src/templates/resume/`.
2. Remove candidate-specific text during the copy.
3. Preserve section spacing, typography, link handling, and output naming rules where they affect parity.

### Phase 4: Compare against private legacy output

1. Generate equivalent private-reference outputs from the modular pipeline into a separate ignored output directory.
2. Compare role count, filenames, section order, required links, placeholder absence, and tracker rows.
3. Keep the private repo as the rollback path until parity passes.

### Phase 5: Switch the default only after approval

1. Update package scripts only after modular sample output and private-reference comparison pass.
2. Keep the private repo rollback path for at least one release window.
3. Document the final command sequence for a friend-facing workflow.

## Parity checks

Use these checks before making modular DOCX generation the default:

| Check | Private reference baseline | Modular requirement |
| --- | --- | --- |
| Build command | Private repo build completes. | New `generate-resumes` command completes against a workspace. |
| Validation command | Private repo validation passes or known existing failures are documented. | Workspace validation passes for generated outputs in scope. |
| Role count | Private role index and generated files agree. | `roles.tracked.json`, `generation-manifest.json`, and `outputs/tracker.md` agree. |
| Output naming | Private reference paths are stable. | Deterministic slugs produce predictable paths without collisions. |
| Tracker shape | Private tracker columns stay readable. | Generated tracker keeps equivalent columns and adds only structured, documented fields. |
| Claims | Private claims come from private source notes. | Each generated claim references evidence IDs or requires candidate review. |
| Privacy | Private artifacts remain in the private repo. | Friend workspaces keep raw inputs and outputs ignored by default. |

## Tracker-generation assumptions

Tracker generation can proceed with these assumptions:

- `roles.tracked.json` is the source of truth for tracked applications.
- Every tracked role has a stable `id`, `company`, `title`, `status`, and `urls` object.
- Fit, compensation, location, application state, next action, resume output path, notes, and follow-up questions are structured fields, not manually edited tracker text.
- `generation-manifest.json` records which resume file was produced for each role.
- `outputs/tracker.md` is generated and can be overwritten.
- Similar-role recommendations stay separate until the candidate accepts them into `roles.tracked.json`.

## Key decisions needed

### 1. Add a sidecar command before making DOCX generation default

**Recommendation:** Add `generate-resumes` under the workspace CLI and keep existing workspace commands unchanged during v1.

**Rationale:** This lets the modular path prove output quality without disrupting existing intake, tracker, and validation behavior.

### 2. Store generated plans for review

**Recommendation:** Write `outputs/generation-manifest.json` and optionally `outputs/generation-review.md`.

**Rationale:** A manifest makes tracker generation and validation deterministic. A review file gives the candidate a readable list of claims, evidence, and questions without opening DOCX files.

### 3. Keep role tailoring partly agent-assisted in v1

**Recommendation:** Let deterministic code render and validate, while agents can help classify roles, choose emphasis, and write candidate-review questions.

**Rationale:** Role positioning needs judgment, but file generation, evidence checks, and tracker output should be reproducible.

## Risks and mitigations

### Risk 1: The sidecar renderer drifts from the current DOCX style

**Likelihood:** Medium
**Impact:** Medium

**Mitigation:** Port style helpers only after baseline outputs are recorded. Compare typography, section order, links, and filenames before switching defaults.

### Risk 2: Strategy objects encode candidate-specific language

**Likelihood:** Medium
**Impact:** High

**Mitigation:** Test templates with fictional sample data first. Reject templates that contain candidate names, employers, or unsupported claims.

### Risk 3: Tracker and resume outputs disagree

**Likelihood:** Medium
**Impact:** High

**Mitigation:** Generate tracker rows from `roles.tracked.json` plus `generation-manifest.json`. Add validation that each ready resume path exists and maps to one role ID.

### Risk 4: Evidence checks block useful drafts

**Likelihood:** Medium
**Impact:** Medium

**Mitigation:** Allow draft plans with `reviewRequired` entries, but block final-ready status until the candidate confirms or removes unsupported claims.

## Scope

### In v1

- New workspace `generate-resumes` command.
- JSON `resumePlan` and `generation-manifest.json` contracts.
- Data-driven templates for core resume sections.
- Role strategy for seed and tracked roles.
- DOCX output for selected tracked roles.
- Tracker integration through structured resume output paths.
- Evidence-backed claim validation with candidate-review gates.
- Side-by-side private-reference comparison before any default command switch.

### V1 non-goals

- Broad refactor of private legacy generators.
- Hand-editing generated DOCX files.
- PDF output.
- Cover letters as first-class generated artifacts.
- Authenticated LinkedIn, Workday, Greenhouse, or Ashby automation.
- Automatic job applications.
- Full migration of private historical notes into generic fixtures.
- Multi-candidate web UI.
- Public repository publication or history scrubbing.

## Related pages

- [Modular architecture](modular-architecture.md)
- [Candidate workspace](candidate-workspace.md)
- [Candidate workspace schemas](workspace-schemas.md)
- [Accuracy and claims](accuracy-and-claims.md)
