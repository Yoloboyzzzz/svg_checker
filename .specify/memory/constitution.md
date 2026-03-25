<!--
  SYNC IMPACT REPORT
  ==================
  Version change: (none) → 1.0.0  (initial ratification)
  Bump rationale: MAJOR — first concrete version from blank template.

  Modified principles:   N/A (first version)
  Added sections:
    - Core Principles (I–V)
    - Technology & Quality Standards
    - Development Workflow
    - Governance

  Removed sections:      N/A

  Templates reviewed & status:
    ✅ .specify/templates/plan-template.md   — "Constitution Check" gate aligns with principles
    ✅ .specify/templates/spec-template.md   — FR/SC structure compatible; no changes needed
    ✅ .specify/templates/tasks-template.md  — phase/story model compatible; no changes needed
    ✅ .specify/templates/agent-file-template.md — generic; no principle refs to update

  Deferred TODOs:        None — all placeholders resolved.
-->

# SVG Checker Constitution

## Core Principles

### I. Correctness-First

Every check MUST produce accurate results. False positives mislead users; false negatives
hide real problems. Both are bugs. New checks MUST include test cases that cover the
expected detection boundary (valid SVG that passes, invalid SVG that fails).

**Rationale**: An SVG checker that cries wolf or silently misses issues erodes user trust
faster than having fewer checks.

### II. CLI Interface

The primary interface MUST be command-line. The tool MUST follow the Unix text-stream
convention: structured results to stdout, errors and diagnostics to stderr. Both
human-readable and machine-readable (JSON) output formats MUST be supported via a flag
(e.g., `--format json`). Exit codes MUST be meaningful: 0 = pass, 1 = violations found,
2 = tool/input error.

**Rationale**: CLI-first enables scripting, CI integration, and editor plugin wrappers
without coupling the core logic to any particular interface.

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

- **Language**: Python 3.11+ (default; override in plan.md if another language is chosen
  before the first feature is implemented — after that the language is locked).
- **Testing framework**: pytest with 100% branch coverage required for all rule modules.
- **Linting/formatting**: ruff (lint) + black (format); enforced in CI.
- **SVG parsing**: rely on stdlib `xml.etree.ElementTree` or `lxml`; do NOT import a
  full browser rendering engine.
- **Output schema**: JSON output MUST be versioned (a top-level `"schema_version"` field)
  so downstream consumers can detect breaking changes.
- **Performance**: Single-file checks MUST complete in < 500 ms on a 10 MB SVG on
  commodity hardware; batch mode SHOULD stream results rather than accumulating in memory.

## Development Workflow

- Every feature MUST start with a `spec.md` (user stories + acceptance criteria).
- A `plan.md` MUST be completed and pass the Constitution Check before any code is
  written.
- `tasks.md` drives implementation; tasks are checked off as they are completed.
- Pull requests MUST reference the task ID(s) they close.
- No PR merges to `main` without passing CI (lint + tests).
- Breaking changes to the CLI contract or JSON output schema require a MAJOR version bump
  of the tool itself (separate from this constitution's version).

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

**Version**: 1.0.0 | **Ratified**: 2026-03-24 | **Last Amended**: 2026-03-24
