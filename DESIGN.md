---
name: Resume builder
description: Calm, card-based report and tracker pages that show evidence behind every resume edit.
colors:
  accent: "#0284c7"
  accent-soft: "#e0f2fe"
  accent-dark: "#38bdf8"
  ink: "#0f172a"
  muted: "#64748b"
  surface: "#ffffff"
  page: "#f8fafc"
  line: "#e2e8f0"
  good: "#15803d"
  good-soft: "#dcfce7"
  warn: "#b45309"
  warn-soft: "#fef3c7"
  bad: "#b91c1c"
  bad-soft: "#fee2e2"
  night-page: "#0b1220"
  night-surface: "#111a2e"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 800
    letterSpacing: "-0.02em"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  sm: "0.5rem"
  md: "0.625rem"
  lg: "1rem"
  pill: "999px"
spacing:
  sm: "0.75rem"
  md: "1.25rem"
  lg: "2.5rem"
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  button-filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-filter-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
  badge:
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.75rem"
---

# Design System: Resume builder

Scope: documents the incumbent styling in `src/renderers/html-tracker.js`, `html-contacts-tracker.js` and `html-tailor-report.js`. Each file inlines its own `<style>`; there is no shared stylesheet. No `--ds-*` tokens, theme pack or UI-shelf parts are in use today.

## Overview

**Creative North Star: "The Audit Ledger"** (Assumption: name chosen from the incumbent look, not confirmed with the owner.)

Pages read like a tidy ledger: white cards on a pale slate page, one sky-blue accent, and semantic green/amber/red for status. Density is moderate and information is the decoration. The tone supports PRODUCT.md's evidence-first, calm-and-honest principles.

**Key Characteristics:**
- Single accent (sky blue) used for numbers, active filters and the "after" side of comparisons.
- Soft layered cards with small shadows; no heavy chrome.
- Status is always color plus a text label, never color alone.

## Colors

Slate neutrals, one sky-blue accent, three semantic soft/solid pairs.

### Primary
- **Sky Accent** (#0284c7; #38bdf8 in dark): stat values, funnel counts, active filter, focus ring, report hero rule.

### Neutral
- **Slate Ink** (#0f172a): text. **Slate Muted** (#64748b): labels and notes. **Hairline** (#e2e8f0): borders and dividers. **Paper** (#ffffff) cards on **Mist** (#f8fafc) page.

### Semantic
- Good (#15803d on #dcfce7), warn (#b45309 on #fef3c7), bad (#b91c1c on #fee2e2). Tracker badges add blue, violet, teal and orange pairs per pipeline status.

### Named Rules
**The Label-With-Color Rule.** A status color always ships with its text word.
**The One Accent Rule.** Sky blue is the only non-semantic hue.

## Typography

**Font:** system sans stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). No webfonts.

**Character:** neutral and quick to read; weight (700-800) does the hierarchy work, not size jumps.

### Hierarchy
- **Headline** (800, 2.125rem tracker / 1.75rem report, tight -0.02em): page title.
- **Title** (700, 1.1rem): card headings in the report.
- **Body** (400, 0.875-0.92rem, 1.5): table and report text.
- **Label** (700, 0.72-0.8rem, uppercase, 0.05em tracking): stat labels, table headers, tags.

## Layout

Tracker and contacts pages use full-width bodies with 2.5rem padding, auto-fit grids (`minmax(180px,1fr)` stats, `minmax(100px,1fr)` funnel) and a full-width table. The tailor report is a centered `main` (max 52rem) with 16px side gutters and a before/after two-column grid that stacks under 560px.

## Elevation & Depth

Hybrid. Cards carry a soft two-layer shadow (`0 1px 3px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.05)`) and lift 2px on hover in the tracker. The report dark theme drops shadows for border-only depth.

## Shapes

Generous rounding: cards and tables 1rem, inputs and buttons 0.625rem, chips 0.5rem, badges and pills fully round (999px).

## Components

### Buttons (filters)
Outlined white, 0.625rem radius; active state fills sky accent with white text and a tinted shadow.

### Cards / Containers
White, 1rem radius, 1px hairline (report) or shadow only (tracker). The report hero card adds a 4px accent left rule.

### Inputs
Search input: 1px slate border, 0.625rem radius; focus swaps to accent border plus a 3px translucent ring.

### Badges and pills
Soft background with a darker same-hue text; one class per pipeline status and per location type.

### Bars and before/after
Report coverage bars (pill track, muted "before" fill, accent "after" fill) and a before/after pair (slate-tinted vs green-tinted panels).

### Tables
White, rounded, hairline row dividers, uppercase gradient header cells that are click-to-sort.

## Do's and Don'ts

### Do:
- **Do** support both light and dark when you add a page, using the report's CSS-variable pattern (`:root` plus `prefers-color-scheme` and `[data-theme]`); the tracker is currently light-only on purpose.
- **Do** pair every status color with text.
- **Do** keep a 16px minimum side gutter on mobile.

### Don't:
- **Don't** declare `color-scheme: light dark` in a stylesheet that only defines light colors (this made native controls invisible before).
- **Don't** add a second accent hue or gradient text.
- **Don't** invent claims, metrics or testimonials in UI copy (PRODUCT.md).

## Shared parts

Before hand-writing a button, input, card, modal, tabs, table, toast or similar, run `node ~/REPOS/studio/skills/ui/scripts/ui-find.mjs "<need>"` and reuse a shelf part (and `--ds-*` tokens from `~/REPOS/studio/skills/visual-kit/theme.css`) when one fits. If a part is adopted, record the theme pack and material here. Until then the three renderers' inline styles are the source of truth, and any new page should extract shared tokens rather than copy a fourth stylesheet.
