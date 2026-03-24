# Data Model: SVG Checker React App

**Branch**: `001-svg-checker-app` | **Date**: 2026-03-24

All types live in `src/types/index.ts`. This is a pure frontend app — no database or
persistence layer. All state is in-memory during a single browser session.

---

## Core Types

### `CheckCategory`

```typescript
type CheckCategory = 'groups' | 'compound-paths' | 'duplicate-paths';
```

The three check categories, used as a discriminant across all check-related types.

---

### `ViolationDetail`

```typescript
interface ViolationDetail {
  /** Index of the element within its category (0-based) */
  elementIndex: number;
  /** Value of the element's `id` attribute, or null if absent */
  elementId: string | null;
  /** Human-readable description of the violation */
  description: string;
}
```

One entry per individual violation found within a category.

---

### `CheckResult`

```typescript
interface CheckResult {
  /** Which of the three checks this result belongs to */
  category: CheckCategory;
  /** Display label shown in the UI */
  label: string;
  /**
   * Weight in the quality score (0–1).
   * Defaults to 1/3 for each category; must sum to 1 across all checks.
   */
  weight: number;
  /** True if zero violations were found */
  pass: boolean;
  /** Total count of violations found */
  violationCount: number;
  /** Details for each individual violation */
  violations: ViolationDetail[];
}
```

---

### `QualityReport`

```typescript
interface QualityReport {
  /** Original filename of the uploaded SVG */
  filename: string;
  /** Raw file size in bytes */
  fileSize: number;
  /**
   * Weighted quality score: 0–100 (integer).
   * score = Math.round(Σ(check.weight * 100) for each passing check)
   */
  score: number;
  /** Results for all three check categories, always length 3 */
  checks: [CheckResult, CheckResult, CheckResult];
}
```

---

### `FixedSVG`

```typescript
interface FixedSVG {
  /** The full SVG markup string after all fixes applied */
  content: string;
  /** Suggested download filename: original name with `-fixed` suffix */
  filename: string;
  /**
   * Re-analysis report after fixing.
   * All three checks should pass (score = 100) if fix was complete.
   */
  report: QualityReport;
}
```

---

### `AppState`

```typescript
type AppState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'analyzed';
      rawSvg: string;
      report: QualityReport;
      sanitizedSvg: string; // DOMPurify-cleaned SVG for safe inline preview
    }
  | {
      status: 'fixed';
      rawSvg: string;
      report: QualityReport;
      sanitizedSvg: string;
      fixed: FixedSVG;
      fixedSanitizedSvg: string;
    };
```

Discriminated union representing the full UI state machine. Components render based
on `status`.

---

## State Transitions

```
idle
  ──[valid SVG uploaded]──► analyzed
  ──[invalid file / parse error]──► error

error
  ──[new file uploaded]──► analyzed | error

analyzed
  ──[Fix Issues clicked]──► fixed
  ──[new file uploaded]──► analyzed | error

fixed
  ──[new file uploaded]──► analyzed | error
  ──[Download triggered]──► fixed (no state change)
```

---

## Check Rule Interface

```typescript
interface CheckRule {
  category: CheckCategory;
  label: string;
  defaultWeight: number;
  /** Analyse the parsed SVG document; return a CheckResult */
  check(doc: Document): CheckResult;
  /** Apply the fix for this category to the document in-place */
  fix(doc: Document): void;
}
```

Each rule is a self-contained object satisfying this interface (Constitution Principle V).
The analyzer and fixer consume an array of `CheckRule[]` — adding/removing a rule
requires only changing the rules array, not the core dispatcher.

---

## Entities Summary

| Entity | Location | Purpose |
|--------|----------|---------|
| `CheckCategory` | `src/types/index.ts` | Discriminant for all check types |
| `ViolationDetail` | `src/types/index.ts` | Single violation metadata |
| `CheckResult` | `src/types/index.ts` | Per-category analysis output |
| `QualityReport` | `src/types/index.ts` | Full analysis result |
| `FixedSVG` | `src/types/index.ts` | Fix output with re-analysis |
| `AppState` | `src/types/index.ts` | UI state machine |
| `CheckRule` | `src/types/index.ts` | Contract for each check module |
