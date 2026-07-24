# GitHub Pages via Actions deploy-pages, scoped to demo output only

- Status: accepted
- Date: 2026-07-24
- Deciders: Dave Voyles

## Context and Problem Statement

Design plan 0007 adds a live, publicly hosted sample of the generated tracker dashboard so
README visitors can interact with a real artifact instead of a static screenshot. That requires
picking a GitHub Pages publishing mechanism. This repo already has an established position on UI
surface (ADR 0002: static-generated-HTML-only; ADR 0003: an optional local server, narrowly, for
change-detection auto-refresh) — the chosen mechanism needs to fit that line, not reopen it.

## Decision Drivers

- The published artifact must be genuine `renderHtmlTracker` output, not a hand-maintained copy
  — whatever mechanism is chosen must build from the actual CLI path, not a separately edited
  file.
- `docs/` already holds a large tree of markdown documentation (ADRs, design plans, playbooks,
  schemas). Any mechanism that lets GitHub Pages' default Jekyll processing run over that whole
  tree risks unrelated, unreviewed rendering behavior on content that was never meant to be a
  public site.
- No new runtime/server surface should be introduced — ADR 0002/0003's static-HTML-only stance
  should hold; a Pages-hosted static file doesn't violate that, but a live backend would.
- The demo should never silently go stale relative to renderer changes.

## Considered Options

1. GitHub Actions workflow builds the demo and deploys just that output via
   `actions/deploy-pages`
2. Point GitHub Pages at a `/docs` subfolder on `main`
3. Publish to a dedicated `gh-pages` branch (manually or via a workflow)

## Decision Outcome

Chosen option: **GitHub Actions workflow + `actions/deploy-pages`**, scoped to only the
generated demo output (a single `index.html`, not the repo's `docs/` tree).

- The workflow runs the same `build-tracker --format html` CLI path any user runs, against a new
  `examples/demo-candidate/` fixture workspace, so the published page is always real renderer
  output.
- Deploying only that generated file (via `actions/upload-pages-artifact` +
  `actions/deploy-pages`) means GitHub Pages never touches `docs/`'s markdown tree, so there's no
  Jekyll processing surprise over existing documentation.
- No server process is introduced — the deployed artifact is the same kind of self-contained
  static HTML file ADR 0002 already established as the project's UI surface; this ADR narrows
  *where it's hosted*, not *what it is*.
- Rebuilding on every push to `main` (design plan 0007's chosen trigger) keeps the demo from
  drifting out of sync with renderer changes, at the cost of some redundant builds on unrelated
  commits.

### Consequences

- Good: the live demo is provably real tool output, not a maintained-by-hand mockup.
- Good: `docs/`'s existing markdown documentation is completely unaffected by enabling Pages.
- Good: no new runtime surface — consistent with ADR 0002/0003's static-HTML-only line.
- Bad: enabling GitHub Pages itself is a one-time repo-settings change (Settings → Pages →
  Source: "GitHub Actions") that needs explicit human action/confirmation — not something this
  ADR or design plan 0007's approval can pre-authorize on its own.
- Bad: every push to `main` triggers a rebuild+redeploy even when unrelated to the demo, which is
  a deliberate tradeoff (see design plan 0007) in favor of zero staleness risk.

## Links

- Implements [design plan 0007 — live sample/demo page on GitHub Pages](../design/0007-live-demo-github-pages.md)
- Builds on [ADR 0002 — static generated HTML remains the only UI surface](0002-static-generated-html-only-ui-surface.md)
- Builds on [ADR 0003 — optional local server permitted for change-detection auto-refresh](0003-optional-local-server-supersedes-0002.md)
