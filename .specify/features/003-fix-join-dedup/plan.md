# Implementation Plan: Fix Incorrect Node Joining and Duplicate Line Removal

**Branch**: `003-fix-join-dedup` | **Date**: 2026-03-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `.specify/features/003-fix-join-dedup/spec.md`

**Note**: This plan is the output of `/speckit.plan`.

## Summary

Three root-cause bugs in `disconnectedLineRule.ts` and `duplicatePathRule.ts` cause incorrect node joining and missed duplicate-line removal. Fixes are surgical: reduce the join tolerance constant, extend dedup to cover `<line>` elements, and remove stroke from the dedup identity key.

## Technical Context

**Language/Version**: TypeScript 6 (strict mode)
**Primary Dependencies**: Vitest 4, jsdom 29, React Testing Library 16, DOMPurify 3
**Storage**: N/A (in-browser processing only)
**Testing**: Vitest 4 with jsdom 29 environment
**Target Platform**: Browser SPA (no backend)
**Project Type**: Web application / client-side library
**Performance Goals**: Analysis of 1 MB SVG < 500 ms; full flow < 30 s
**Constraints**: No `any`, no implicit returns, pure `check()` functions
**Scale/Scope**: Single-file SVG input; no concurrency concerns

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Correctness-First | ✅ Pass | Fix addresses false-positive joins and missed duplicates |
| II. Web Application Interface | ✅ Pass | No backend introduced; logic stays in checker/fixer modules |
| III. Test-Driven Development | ✅ Pass | New failing tests written before code changes (see Quickstart) |
| IV. Simplicity (YAGNI) | ✅ Pass | Changes are minimal constant + key adjustments; no new abstractions |
| V. Modularity | ✅ Pass | Changes isolated to `duplicatePathRule.ts` and `disconnectedLineRule.ts` |

No violations — Complexity Tracking table not required.

## Project Structure

### Documentation (this feature)

```text
.specify/features/003-fix-join-dedup/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (created by /speckit.tasks)
```

### Source Code (affected files only)

```text
src/
└── checker/
    └── rules/
        ├── disconnectedLineRule.ts   ← EPS constant fix + (optionally) bezier join
        └── duplicatePathRule.ts      ← geometry-only key + <line> element coverage

tests/
└── unit/
    ├── disconnectedLineRule.test.ts  ← new tolerance + false-join regression tests
    └── duplicatePathRule.test.ts     ← new geometry-only + <line> dedup tests

tests/
└── fixtures/                         ← new SVG fixtures for edge cases
```
