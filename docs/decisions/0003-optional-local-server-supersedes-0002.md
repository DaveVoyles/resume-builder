# Optional local server permitted for change-detection auto-refresh

- Status: accepted
- Date: 2026-07-21
- Deciders: Dave Voyles
- Supersedes: [ADR 0002](0002-static-generated-html-only-ui-surface.md) (narrowly)

## Context and Problem Statement

ADR 0002 established the generated `tracker.html` as the project's sole UI
surface, explicitly rejecting a served, live-updating dashboard to avoid
server lifecycle, port, and security surface. Design plan 0006 (onboarding
UX improvements) asks for two things a pure static file cannot provide:
opening a browser tab automatically the moment a candidate finishes setup,
and refreshing that tab automatically as onboarding progresses, without the
candidate manually rebuilding and reloading. Neither is achievable from a
`file://`-opened static artifact — a browser cannot poll filesystem state
without a helper process — so satisfying them means revisiting ADR 0002's
boundary, which that ADR itself anticipated: "revisiting them requires
superseding this ADR."

## Decision Drivers

- ADR 0002's core concerns — no SPA, no backend application state, no API
  keys, and ADR 0001's deterministic/LLM-free CLI stance — remain valid and
  should not be reopened wholesale for the sake of two narrow UX asks.
- A local server already exists in this project (`serve`) as an opt-in
  convenience command; the runtime surface itself isn't new, only its
  default-on status and one small additional endpoint would be.
- The specific asks — auto-open, auto-refresh — need no live data fetching,
  no remote state, no authentication, and no interactivity beyond "reload
  when a generated file changed."

## Considered Options

1. Reject both asks and stay fully within ADR 0002 (server stays manual,
   refresh stays manual).
2. Supersede narrowly: keep `tracker.html` as the sole generated artifact
   of record; permit the existing optional server to (a) auto-launch by
   default and (b) expose one small, read-only change-detection endpoint
   purely to trigger a client-side reload.
3. Supersede fully: reopen ADR 0002's boundary broadly, allowing richer
   served or live features in general, not just auto-refresh.

## Decision Outcome

Chosen option: **supersede narrowly (Option 2)**. `tracker.html`, and every
other file `build-tracker` produces, remains the versionable, diffable,
generated artifact of record — nothing about *how* it is produced changes.
The only new capability is that the CLI's existing `serve` command may
launch automatically at setup, and may expose a minimal, read-only "has
`outputs/` changed" signal so an already-open tab can reload itself. No new
persistent state, no write endpoints, no authentication surface, and no API
keys are introduced — ADR 0001 and the rest of ADR 0002's stance are
preserved.

### Consequences

- Good: unlocks "see it working immediately" and "live progress" without
  abandoning the generated-artifact model or introducing app-like
  complexity.
- Good: the amendment is narrow and independently reversible — a future
  session could drop the auto-open/auto-refresh pieces without touching how
  the tracker itself is built.
- Bad: a running local server, even auto-launched, reintroduces port and
  process-lifecycle concerns (conflicts, orphaned processes) a pure static
  file never had. Mitigated by detecting and reusing an already-running
  instance, and by providing a no-auto-open escape hatch.
- Bad: this is the second UI-architecture decision in two days. If further
  live-feature requests arrive, that is a signal to write a broader ADR
  rather than keep issuing narrow amendments to this one.

## Links

- Supersedes [ADR 0002 — static generated HTML remains the only UI surface](0002-static-generated-html-only-ui-surface.md)
- Builds on [ADR 0001 — agent-operated CLI](0001-agent-operated-cli.md)
- Implemented by [design plan 0006](../design/0006-onboarding-early-server-progress.md)
