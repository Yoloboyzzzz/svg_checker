# Implementation Plan: SVG Checker React App

**Branch**: `001-svg-checker-app` | **Date**: 2026-03-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-svg-checker-app/spec.md`

---

## Summary

A fully browser-based React 18 / TypeScript / Tailwind CSS v4 SPA that lets users upload
an SVG file, view a weighted quality score across three check categories (groups, compound
paths, duplicate paths), see a live SVG preview, and download a one-click fixed SVG.
All processing runs in the browser via the native `DOMParser` API — no backend required.

---

## Technical Context

**Language/Version**: TypeScript 5.x + React 18.x
**Primary Dependencies**: Vite 6, `@tailwindcss/vite` (Tailwind v4), DOMPurify 3
**Storage**: N/A — no persistence; all state is in-memory per session
**Testing**: Vitest 3 + React Testing Library 16 + jsdom
**Target Platform**: Desktop browsers (Chrome 120+, Firefox 120+, Safari 17+, Edge 120+)
**Project Type**: Single-page application (SPA)
**Performance Goals**: Analysis of a 1 MB SVG MUST complete in < 500 ms;
full upload-to-score flow MUST complete in < 30 s (SC-001)
**Constraints**: Zero network requests after initial page load (SC-004);
no backend; no authentication
**Scale/Scope**: Single user, single file at a time; desktop-only for v1

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Correctness-First | ✅ PASS | Every check rule has positive + negative test fixtures; TDD enforced |
| II. CLI Interface | ⚠️ JUSTIFIED VIOLATION — see Complexity Tracking | User explicitly required a React web UI; CLI interface out of scope for this feature |
| III. TDD | ✅ PASS | Tests written before implementation per task ordering in tasks.md |
| IV. Simplicity | ✅ PASS | No speculative abstractions; DOMPurify is the only non-trivial dep (security requirement); no geometry library added |
| V. Modularity | ✅ PASS | Each check is a self-contained `CheckRule` object; adding/removing a rule touches only its module and the rules registry |

**Post-design re-check**: All gates still pass after Phase 1 design. `CheckRule` interface
enforces Principle V. Test fixtures and rule unit tests enforce Principle I.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-svg-checker-app/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── check-rule.contract.ts
│   └── analyzer.contract.ts
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── index.ts                  # All shared TS interfaces (CheckRule, QualityReport, etc.)
├── checker/
│   ├── rules/
│   │   ├── groupRule.ts          # Check I: group detection + ungrouping fix
│   │   ├── compoundPathRule.ts   # Check II: compound path detection + split fix
│   │   ├── duplicatePathRule.ts  # Check III: duplicate detection + dedup fix
│   │   └── index.ts              # Rules registry (the only file that changes when adding a rule)
│   ├── analyzer.ts               # Orchestrates check rules → QualityReport
│   └── fixer.ts                  # Orchestrates fix rules → FixedSVG
├── utils/
│   ├── colorNormalize.ts         # CSS color → rgb(r,g,b) normalization via DOM
│   ├── svgParse.ts               # DOMParser wrapper + parseerror detection
│   ├── svgSerialize.ts           # XMLSerializer wrapper → SVG string
│   └── download.ts               # Blob URL download helper
├── components/
│   ├── DropZone.tsx              # Drag-and-drop + file picker upload area
│   ├── SVGPreview.tsx            # Inline SVG preview (DOMPurify sanitized)
│   ├── QualityScore.tsx          # Score ring / percentage display
│   ├── CheckCard.tsx             # Collapsible per-category result card
│   └── FixButton.tsx             # "Fix Issues" button (disabled when score=100)
├── App.tsx                       # Root component; owns AppState
├── main.tsx                      # React DOM entry point
└── index.css                     # Tailwind @import

tests/
├── fixtures/
│   ├── clean.svg
│   ├── with-groups.svg
│   ├── with-compound-paths.svg
│   ├── with-duplicates.svg
│   ├── all-violations.svg
│   ├── malformed.svg
│   └── empty.svg
├── unit/
│   ├── groupRule.test.ts
│   ├── compoundPathRule.test.ts
│   ├── duplicatePathRule.test.ts
│   ├── colorNormalize.test.ts
│   └── analyzer.test.ts
└── components/
    ├── DropZone.test.tsx
    ├── QualityScore.test.tsx
    └── CheckCard.test.tsx

index.html
vite.config.ts
vitest.setup.ts
tsconfig.json
tsconfig.app.json
```

**Structure Decision**: Single project (Option 1). No backend, no routing, no monorepo.
All checker logic isolated in `src/checker/` for testability independent of React.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle II (CLI Interface) | User explicitly required a React/TypeScript/Tailwind web UI as the primary interface | A CLI tool would not satisfy the user's requirement for an interactive browser-based SVG checker with drag-and-drop upload and inline preview |
| DOMPurify dependency | Inline SVG rendering requires stripping `<script>` tags and event handlers to prevent XSS | A hand-rolled allowlist sanitizer risks missing edge cases in the SVG spec; DOMPurify is battle-tested |

---

## Phase 0: Research

**Status**: ✅ Complete — see [research.md](research.md)

Key decisions:
- `DOMParser` for SVG parsing (no library needed)
- String normalization for duplicate detection (no geometry library)
- `getComputedStyle` trick for CSS color normalization (no color library)
- DOMPurify for inline preview sanitization (security requirement)
- Tailwind v4 + `@tailwindcss/vite` plugin
- Vitest + RTL for testing

All `NEEDS CLARIFICATION` items from Technical Context resolved in research.md.

---

## Phase 1: Design & Contracts

**Status**: ✅ Complete

| Artifact | Path | Status |
|----------|------|--------|
| Data model | [data-model.md](data-model.md) | ✅ Done |
| CheckRule contract | [contracts/check-rule.contract.ts](contracts/check-rule.contract.ts) | ✅ Done |
| Analyzer/Fixer contract | [contracts/analyzer.contract.ts](contracts/analyzer.contract.ts) | ✅ Done |
| Quickstart | [quickstart.md](quickstart.md) | ✅ Done |

---

## Key Design Decisions

### Check Rule Architecture

Each check is a module implementing the `CheckRule` interface (see contracts).
The rules registry in `src/checker/rules/index.ts` exports a `DEFAULT_RULES` array.
`analyzer.ts` and `fixer.ts` iterate this array — they have no knowledge of individual
rules. This satisfies Constitution Principle V with a minimal abstraction.

### Fix Ordering

Fixes MUST be applied in this order to avoid dependency issues:
1. **Ungroup** first — inlines inherited styles/transforms onto children
2. **Split compound paths** — operates on `<path>` elements (groups already removed)
3. **Deduplicate** — compares paths after splitting and ungrouping (accurate color comparison requires step 1 complete)

### Score Calculation

```
score = Math.round(
  checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0) * 100
)
```

Default weights: groups=1/3, compound-paths=1/3, duplicate-paths=1/3.
Weights are constants in `src/checker/rules/index.ts` and can be changed without
modifying any rule module.

### SVG Preview Security

Before inserting SVG content into the DOM via `dangerouslySetInnerHTML`, run it through
`DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })`.
This strips `<script>`, event handlers (`on*` attributes), and `javascript:` hrefs.
