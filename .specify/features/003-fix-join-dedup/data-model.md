# Data Model: Fix Incorrect Node Joining and Duplicate Line Removal

**Branch**: `003-fix-join-dedup` | **Date**: 2026-03-26

## Key Entities

### `PathFrag` (internal, `disconnectedLineRule.ts`)

Represents a single parsed segment extracted from the SVG DOM, ready for chaining.

| Field | Type | Meaning |
|---|---|---|
| `start` | `Point` | First endpoint of the segment (absolute SVG coordinates) |
| `end` | `Point` | Last endpoint of the segment (absolute SVG coordinates) |
| `forwardD` | `string` | Path commands (no leading `M`) from `start` → `end` |
| `reverseD` | `string` | Path commands (no leading `M`) from `end` → `start` |
| `el` | `Element` | Reference to the original DOM element (for attribute copying and removal) |

**Constraint changed by this fix**: `pointsEqual(a, b)` uses `EPS = 0.01` (was `0.5`). Two points are "the same" iff `|a.x - b.x| < 0.01 AND |a.y - b.y| < 0.01`.

---

### `Chain` (internal, `disconnectedLineRule.ts`)

A sequence of connected `PathFrag` entries that have been joined into a single continuous path.

| Field | Type | Meaning |
|---|---|---|
| `start` | `Point` | First point of the complete chain |
| `end` | `Point` | Last point of the complete chain |
| `parts` | `string[]` | Ordered list of path command fragments (joined to build the `d` attribute) |

**Invariant**: `chain.parts` always covers the geometry from `chain.start` to `chain.end`. The final `d` is `M chain.start.x,chain.start.y ${chain.parts.join(' ')}`.

---

### Dedup Key — `<path>` (internal, `duplicatePathRule.ts`)

The string key used to identify geometrically identical `<path>` elements.

**Before fix:**
```
normalizePath(d) + '|' + getStrokeKey(el) + '|' + transform
```

**After fix:**
```
normalizePath(d) + '|' + transform
```

`normalizePath` normalises whitespace, comma-spacing, and rounds floating-point numbers to 4 decimal places. `transform` is the raw attribute value (empty string if absent).

---

### Dedup Key — `<line>` (new, `duplicatePathRule.ts`)

The string key used to identify geometrically identical `<line>` elements, including reversed copies.

**Format:**
```
sorted([round(x1)+','+round(y1), round(x2)+','+round(y2)]).join('|') + '|transform=' + transform
```

Where `round(n)` rounds to 2 decimal places. Sorting the two endpoints ensures `<line x1=0 y1=0 x2=10 y2=10>` and `<line x1=10 y1=10 x2=0 y2=0>` produce the same key.

---

### `EPS` Constant

| Property | Value |
|---|---|
| Location | `disconnectedLineRule.ts:16` |
| Old value | `0.5` |
| New value | `0.01` |
| Unit | SVG user units |
| Used by | `pointsEqual()` → `sharesEndpoint()`, `chainFrags()` |
| Meaning | Maximum distance between two coordinates for them to be treated as coincident |
