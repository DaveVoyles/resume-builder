# Port behavior, not private files

- status: accepted
- date: 2026-10-06
- decision-makers: Dave Voyles
- consulted: design plan [0008](../design/0008-catch-up-to-private-builder.md)

## Context and Problem Statement

The public builder should catch up to the private upstream tool. The private generator hardcodes one person's contact links inside the renderer. Copying that code, or any real resume, tracker row, or form answer, would publish private job-search data.

## Decision Drivers

- The public repo is used by strangers.
- [ADR 0001](0001-agent-operated-cli.md) already says the CLI never calls an AI.
- A July 2026 parity plan already shipped the shared loop (render, tailor, track, study-guide bundle). This round only adds what that plan left behind.

## Considered Options

1. **Copy the private generator and scrub it.** Fast, and easy to miss a hardcoded contact link.
2. **Reimplement the missing behaviors in this repo's workspace CLI**, using the fictional sample candidate only.
3. **Leave the public repo as it is.** The human README and the missing checks stay behind.

## Decision Outcome

Chosen option: **reimplement the missing behaviors here.**

- New code is written against this repo's schemas and the fictional sample candidate.
- Do not copy renderer source, role configs, study guides, or form answers from the private upstream checkout.
- The CLI still does not call an AI and still does not need an API key.
- No new GitHub Actions. The existing validate workflow stays unchanged.
