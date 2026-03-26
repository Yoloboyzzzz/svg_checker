# Research: Fix Incorrect Node Joining and Duplicate Line Removal

**Branch**: `003-fix-join-dedup` | **Date**: 2026-03-26

## Root Cause Analysis

### Bug 1 — Incorrect node joining (`disconnectedLineRule.ts:16`)

**Decision**: Change `EPS` from `0.5` to `0.01`.

**Finding**: The constant `EPS = 0.5` at line 16 of `disconnectedLineRule.ts` defines the tolerance used in `pointsEqual()`. This function is called by every join decision in `chainFrags()`. At 0.5 SVG user units, paths whose endpoints are up to half a unit apart get merged. In typical laser-cutter SVGs where CAD coordinates are precise to 2–3 decimal places, half a unit of tolerance causes large numbers of false-positive joins — the algorithm merges segments that the user intended to remain separate.

**Evidence from code**:
```typescript
// disconnectedLineRule.ts:16
const EPS = 0.5   // ← too large; causes joins across intended gaps
```

**Rationale**: 0.01 user units (the spec-confirmed value) absorbs genuine floating-point rounding from vector editors (e.g. Inkscape exports 5 decimal places) while preventing false joins. 0.01 is 50× smaller than 0.5; no legitimate CAD gap would be this small.

**Alternatives considered**:
- *Exact match (0.0)*: Rejected — real SVGs from vector editors have sub-pixel float noise; exact match would miss valid joins.
- *User-configurable tolerance*: Rejected — adds complexity with no current requirement (Principle IV, YAGNI).
- *0.1*: Possible midpoint, but still 10× the target spec value and leaves some false-join risk.

---

### Bug 2 — Duplicate `<line>` elements not removed (`duplicatePathRule.ts`)

**Decision**: Extend `duplicatePathRule.fix()` and `.check()` to also query and deduplicate `<line>` elements.

**Finding**: `duplicatePathRule` currently only processes `<path>` elements via `doc.querySelectorAll('path')`. The fix pipeline runs dedup *before* the join step. Since the join step converts `<line>` elements to `<path>` elements, any duplicate `<line>` elements survive dedup and reach the join step as-is.

In `chainFrags()`, two identical `<line x1=A y1=B x2=C y2=D>` elements produce a single chain (because `frag.start == chain.start`) with path `M C,D L A,B L C,D` — a doubled-back path that traces the same line twice. This is the "lines on top of each other not removed" symptom.

**Canonical key for `<line>` deduplication**: Represent a line as two ordered endpoint strings (lexicographic min-first), so that a line and its reverse share the same key:
```
lineKey(x1,y1,x2,y2) = sort([`${x1},${y1}`, `${x2},${y2}`]).join('|') + '|transform=' + transform
```
Floating-point coordinates are rounded to 2 decimal places (consistent with 0.01 tolerance) before string formatting.

**Rationale**: Treating reversed copies as duplicates matches spec requirement FR-004. Using a sorted-endpoint key is the simplest geometry-only representation for a straight line segment.

**Alternatives considered**:
- *Convert `<line>` to `<path>` before dedup step*: Would require changing fix ordering (Principle IV violation without justification). Current order (dedup before join) is mandated by the constitution.
- *Handle in `disconnectedLineRule.fix()` before chaining*: Mixes dedup responsibility into the join rule, violating Principle V (modularity).

---

### Bug 3 — Dedup key includes stroke color (`duplicatePathRule.ts:39,69`)

**Decision**: Remove `getStrokeKey(p)` from the duplicate-detection key.

**Finding**: The dedup key is currently:
```typescript
normalizePath(d) + '|' + getStrokeKey(p) + '|' + transform
```
Including stroke means two geometrically identical paths with different stroke colors are NOT considered duplicates. In a laser-cutting workflow, the machine reads coordinates only; stroke color is a user annotation (often used for layer differentiation) and should not prevent duplicate removal.

**Rationale**: Spec clarification Q1 explicitly confirmed geometry-only matching. The resulting key is:
```typescript
normalizePath(d) + '|' + transform
```

**Impact on existing tests**: The test "treats color-equivalent strokes as duplicates (#FF0000 vs red)" remains green because those two paths have identical geometry; the stroke-color normalisation logic (`getStrokeKey`) can be removed entirely without breaking that test. No existing test asserts that different strokes *prevent* dedup.

**Alternatives considered**:
- *Keep stroke in key, make it configurable*: Rejected — YAGNI; adds a configuration option for an unneeded complexity.
- *Normalise then keep stroke*: Still wrong — a red and a blue identical path would not be caught as duplicates.

---

## Summary Table

| # | Location | Change | Impact |
|---|---|---|---|
| 1 | `disconnectedLineRule.ts:16` | `EPS: 0.5 → 0.01` | Eliminates false-positive joins |
| 2 | `duplicatePathRule.ts` | Add `<line>` deduplication | Catches duplicate bare lines before join step |
| 3 | `duplicatePathRule.ts:39,69` | Remove `getStrokeKey()` from key | Geometry-only matching as specified |
