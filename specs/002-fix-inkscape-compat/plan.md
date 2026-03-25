# Implementation Plan: Fix Fixed SVG Crashing Inkscape

**Branch**: `002-fix-inkscape-compat` | **Date**: 2026-03-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-fix-inkscape-compat/spec.md`

## Summary

The fix pipeline produces SVG output that crashes Inkscape under certain input conditions.
Three root causes were identified via code inspection (see `research.md`):

1. **Degenerate M-only sub-paths** — compound-path splitting produces sub-paths with only
   a moveto command and no draw commands. These appear in the output and can cause Inkscape
   to crash or reject the file.
2. **Missing test for ID stripping** — FR-004 is already implemented correctly but has no
   regression test; a silent regression could reintroduce the bug.
3. **XML namespace guard** — `XMLSerializer` can omit or malform the SVG namespace
   declaration in certain environments, causing Inkscape to reject the file as non-SVG.

The approach is three targeted, minimal fixes with corresponding tests. No new abstractions,
no new dependencies, no interface changes.

---

## Technical Context

**Language/Version**: TypeScript strict (existing)
**Primary Dependencies**: Browser DOMParser, XMLSerializer (existing); no new dependencies
**Storage**: N/A — all in-memory, no persistence
**Testing**: Vitest 4 + jsdom 29 (existing)
**Target Platform**: Browser SPA (fixes apply in both browser and jsdom test environment)
**Project Type**: Bug fix within existing SPA
**Performance Goals**: No regression — each change is O(n) over existing path count
**Constraints**: Zero new dependencies; changes limited to affected modules only

---

## Constitution Check

*GATE: Must pass before implementation. Re-checked after design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Correctness-First | ✅ PASS | Root causes identified from code; tests written first (TDD) |
| II. Web Application Interface | ✅ PASS | Fixes are in the decoupled checker/fixer core; no UI changes |
| III. TDD | ✅ PASS | Failing tests written before each fix (see task ordering) |
| IV. Simplicity | ✅ PASS | No new abstractions; each fix is a targeted, single-concern change |
| V. Modularity | ✅ PASS | Changes touch only the affected module's own file; no cross-rule coupling |

**Fix-pipeline ordering standard**: ungroup → split → dedup → join (unchanged; no reordering).

**Post-design re-check**: All gates pass. No new public interfaces introduced.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-fix-inkscape-compat/
├── plan.md              # This file
├── research.md          # Root cause analysis (Phase 0)
└── spec.md              # Feature specification
```

### Source Code Changes

```text
src/
├── checker/
│   ├── fixer.ts                        # MODIFY: post-pipeline empty-d cleanup
│   └── rules/
│       └── compoundPathRule.ts         # MODIFY: filter degenerate M-only sub-paths
└── utils/
    └── svgSerialize.ts                 # MODIFY: namespace guard

tests/
├── fixtures/
│   ├── with-id-compound-path.svg       # NEW: compound path with id attribute
│   └── with-degenerate-subpaths.svg    # NEW: compound path with M-only sub-paths
└── unit/
    ├── compoundPathRule.test.ts        # MODIFY: update M-only test; ADD id test
    └── fixer.test.ts                   # ADD: integration tests for output correctness
```

**Structure Decision**: Single-project layout (existing). No new directories.

---

## Complexity Tracking

> No Constitution Check violations. This section is empty.

---

## Phase 1 Design

### Fix 1 — Filter degenerate M-only sub-paths (`compoundPathRule.ts`)

**Where**: `splitCompoundPath` return value, or within `fix()` before inserting the new path.

**Logic**: A sub-path is degenerate if its `d` string, after stripping the leading `M …`
component, contains no draw commands (`L`, `l`, `H`, `h`, `V`, `v`, `C`, `c`, `S`, `s`,
`Q`, `q`, `T`, `t`, `A`, `a`). A regex like `/[LlHhVvCcSsQqTtAa]/.test(d)` suffices.

**Behavior change**: The existing test
`'handles three sub-paths with chained relative m offsets'` must be updated:
- Input `M 100,100 L 200,100 m 50,50 m 10,10` produces 3 raw sub-paths.
- Sub-paths `M 250,150` and `M 260,160` are degenerate (M-only) and are dropped.
- Expected output: **1 path** (`M 100,100 L 200,100`), not 3.

### Fix 2 — Post-pipeline empty-d path removal (`fixer.ts`)

**Where**: After the ordered fix loop, before `serializeSVG(doc)`.

**Logic**: `doc.querySelectorAll('path')` → filter any path where `d` is absent, empty,
or contains only whitespace → `parentNode.removeChild(path)`.

**Why in fixer.ts and not a CheckRule**: This is a correctness invariant of the output,
not a user-visible quality metric. No score impact; no new check category.

### Fix 3 — Namespace guard in serializer (`svgSerialize.ts`)

**Where**: After `XMLSerializer().serializeToString(doc.documentElement)` returns.

**Logic**: Check the result string for `xmlns="http://www.w3.org/2000/svg"`. If absent
(edge case in certain environments), inject it into the opening `<svg` tag via a simple
string replacement. This is a defensive guard; under normal conditions the check is a no-op.

### No data-model changes

No new entities, no schema changes, no contract changes. The existing `CheckRule`,
`SVGAnalyzer`, `SVGFixer`, and `QualityReport` interfaces are unchanged.

---

## Quickstart Verification

No new setup steps. Run the existing test suite:

```bash
npm test
```

All existing tests MUST continue to pass (SC-005). The one exception is the intentional
update to `'handles three sub-paths with chained relative m offsets'` which now expects
1 path instead of 3 (the new correct behavior).
