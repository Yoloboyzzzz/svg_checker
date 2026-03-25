<!--
  SYNC IMPACT REPORT
  ==================
  Version change: 1.0.0 → 2.0.0  (MAJOR — Principle II redefined; Technology section overhauled)
  Bump rationale: MAJOR — Principle II ("CLI Interface") replaced with "Web Application Interface",
    a backward-incompatible governance change. Technology & Quality Standards completely revised
    to match the actual stack (TypeScript/React/Vitest, replacing stale Python/pytest references).
    Fix-pipeline ordering codified as a mandatory standard.

  Modified principles:
    II. CLI Interface  →  II. Web Application Interface

  Added sections:
    None — section structure unchanged.

  Removed sections:
    None.

  Templates reviewed & status:
    ✅ .specify/templates/plan-template.md      — Constitution Check gate is generic; no edits needed.
    ✅ .specify/templates/spec-template.md      — FR/SC structure compatible; no edits needed.
    ✅ .specify/templates/tasks-template.md     — Phase/story model compatible; no edits needed.
    ✅ .specify/templates/agent-file-template.md — Generic; no principle refs to update.

  Follow-up:
    - specs/001-svg-checker-app/plan.md: The existing "JUSTIFIED VIOLATION" on Principle II is
      now moot — the constitution reflects the web-UI nature of the project. No edit to plan.md
      required (it is a historical record); future plans will have no violation on Principle II.

  Deferred TODOs: None — all placeholders resolved.
-->

# SVG Checker Constitution

## Core Principles

### I. Correctness-First

Every check MUST produce accurate results. False positives mislead users; false negatives
hide real problems. Both are bugs. New checks MUST include test cases that cover the
expected detection boundary (valid SVG that passes, invalid SVG that fails).

**Rationale**: An SVG checker that cries wolf or silently misses issues erodes user trust
faster than having fewer checks.

### II. Web Application Interface

The primary interface is a browser-based single-page application (SPA). All SVG analysis
and fixing MUST run entirely in the browser — no backend, no network requests after the
initial page load, no server-side processing. The checker and fixer core (rules, analyzer,
fixer) MUST remain fully decoupled from the UI layer so that the logic is independently
testable without a browser environment.

**Rationale**: Running entirely in-browser removes the need for infrastructure, keeps user
data local, and makes the tool instantly deployable as a static site. Decoupling the core
from the UI ensures logic can be unit-tested in a Node/jsdom environment and could be
embedded in other contexts without modification.

### III. Test-Driven Development (NON-NEGOTIABLE)

Tests MUST be written before implementation. The Red-Green-Refactor cycle is strictly
enforced:
1. Write a failing test that describes the desired behavior.
2. Get explicit confirmation the test fails for the right reason.
3. Implement the minimum code to make it pass.
4. Refactor while keeping tests green.

Each new check rule MUST have at least one positive test (detects the issue) and one
negative test (does not fire on valid SVG).

**Rationale**: SVG parsing edge cases are subtle; tests written after the fact tend to
verify the implementation rather than the specification.

### IV. Simplicity (YAGNI)

Start with the simplest solution that satisfies the current requirement. Abstractions,
configuration options, and extensibility layers MUST NOT be added speculatively.
Complexity MUST be justified: if a simpler alternative exists, use it. Dependencies MUST
be minimized — a new third-party dependency requires explicit justification in the plan.

**Rationale**: SVG checking is a well-scoped problem. Over-engineering it leads to
maintenance burden that outlasts any short-term convenience.

### V. Modularity

Each check rule MUST be a self-contained, independently toggleable unit. Rules MUST NOT
have undeclared side-effects on one another. Adding or removing a rule MUST require
changes only within that rule's own module/file. The rule registry MUST accept new rules
without modification to core dispatch logic (open/closed principle).

**Rationale**: Users will want to suppress specific rules or add domain-specific checks.
Monolithic rule logic prevents both.

## Technology & Quality Standards

- **Language**: TypeScript (strict mode — no `any`, no implicit returns).
- **UI framework**: React 19 (`^19.x`).
- **Build tool**: Vite 8 (`^8.x`) + `@vitejs/plugin-react`.
- **Styling**: Tailwind CSS v4 (`^4.x`) via `@tailwindcss/vite`; no PostCSS config required.
  Inline styles are prohibited — Tailwind utility classes only.
- **Sanitization**: DOMPurify 3 MUST be applied before any `dangerouslySetInnerHTML`.
  No exceptions.
- **Testing**: Vitest 4 + React Testing Library 16 + jsdom 29.
  100% branch coverage required for all checker rule modules.
- **Fix-pipeline ordering**: The fixer MUST apply rules in this exact sequence:
  ungroup → split compound paths → deduplicate → join connected segments.
  Deviation requires explicit justification in the plan's Complexity Tracking table.
- **Pure check functions**: All `check()` implementations MUST be pure — they MUST NOT
  mutate the DOM. `fix()` implementations MUST mutate only the document passed to them.
- **Performance**: Analysis of a 1 MB SVG MUST complete in < 500 ms in a browser tab on
  commodity hardware. The full upload-to-score flow MUST complete in < 30 s.

## Development Workflow

- Every feature MUST start with a `spec.md` (user stories + acceptance criteria).
- A `plan.md` MUST be completed and pass the Constitution Check before any code is written.
- `tasks.md` drives implementation; tasks are checked off as they are completed.
- Pull requests MUST reference the task ID(s) they close.
- No PR merges to `main` without passing CI (lint + tests).
- Breaking changes to the `CheckRule` interface or `QualityReport` schema require a MAJOR
  version bump of the tool itself (separate from this constitution's version).

## Governance

This constitution supersedes all other development practices. Amendments MUST be:
1. Proposed as a pull request editing this file.
2. Accompanied by a rationale in the PR description.
3. Reviewed by at least one other contributor (or self-reviewed with a written rationale
   if the project is solo, noting the date and reasoning).
4. Reflected by incrementing `CONSTITUTION_VERSION` per semantic versioning rules defined
   in the speckit workflow.

All plan.md "Constitution Check" gates MUST verify compliance with Principles I–V.
Violations that cannot be avoided MUST be documented in the plan's Complexity Tracking
table.

**Version**: 2.0.0 | **Ratified**: 2026-03-24 | **Last Amended**: 2026-03-25
