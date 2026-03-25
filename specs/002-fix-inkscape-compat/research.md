# Research: Fix Fixed SVG Crashing Inkscape

**Branch**: `002-fix-inkscape-compat` | **Date**: 2026-03-25

## Investigation Summary

Three root causes were identified by reading the existing fix pipeline code directly.
No external research sources were required — the bugs are self-contained in the codebase.

---

## Root Cause 1 — Degenerate M-only sub-paths after compound-path splitting

**Decision**: Filter out sub-paths that contain only `M`/`m` commands (no draw commands)
during compound-path splitting.

**Finding**: `splitCompoundPath` splits on every `M`/`m` boundary. A compound path like
`M 100,100 L 200,100 m 50,50 m 10,10` produces three sub-paths, two of which are
`M 250,150` and `M 260,160` — moveto-only paths that draw nothing. These are currently
passed through the pipeline and appear in the fixed output. Inkscape may crash or misbehave
on `<path d="M 250,150"/>` because there is no draw command following the moveto.

**Evidence**: `tests/unit/compoundPathRule.test.ts` line 78–93 explicitly asserts that
three paths are produced, including the two M-only degenerate sub-paths. This test behavior
needs to change.

**Rationale for fix**: Drop sub-paths that contain only moveto commands during splitting.
A path with no draw instructions has no visual content and no legitimate use as a standalone
element after splitting.

**Alternatives considered**:
- Keep them and add a separate post-pipeline cleanup pass — rejected (more code, same effect,
  violates YAGNI/Simplicity principle).
- Warn the user but not remove — rejected (a degenerate path in the output is always wrong
  for a quality-fixing tool).

---

## Root Cause 2 — ID stripping for compound-path sub-paths (FR-004)

**Decision**: No code change required; test coverage must be added.

**Finding**: `compoundPathRule.fix()` at line 146 already calls
`newPath.removeAttribute('id')` for `i > 0`. The first sub-path (`i === 0`) keeps the
original `id`; all subsequent sub-paths have their `id` removed. FR-004 is already
implemented correctly.

**Evidence**: Code review of `src/checker/rules/compoundPathRule.ts` lines 143–148.

**Rationale**: A test asserting this behavior is missing. The existing tests do not cover
a compound path with an `id` attribute. A regression test must be added.

**Alternatives considered**: None — the implementation is correct, only test coverage
is missing.

---

## Root Cause 3 — XML serialization namespace handling

**Decision**: Add a post-serialization guard to ensure `xmlns="http://www.w3.org/2000/svg"`
is present on the root `<svg>` element of the serialized output string.

**Finding**: `serializeSVG` calls `new XMLSerializer().serializeToString(doc.documentElement)`.
In standard browsers this preserves namespace declarations correctly. However:

1. Elements created with `createElementNS('http://www.w3.org/2000/svg', 'path')` in
   `disconnectedLineRule.fix()` are in the SVG namespace. Some browser/jsdom versions of
   `XMLSerializer` emit a redundant `xmlns="http://www.w3.org/2000/svg"` attribute on
   each such element, which is valid but produces unexpected verbose output.

2. If an edge case causes `xmlns` to be absent from the root `<svg>` element in the
   serialized string (e.g., a browser quirk), Inkscape treats the file as non-SVG and
   refuses to open it — which matches the reported symptom exactly.

3. Inkscape-specific namespace declarations (`xmlns:inkscape`, `xmlns:sodipodi`, etc.)
   that are attributes of the `<svg>` element are preserved correctly by `XMLSerializer`
   since they are regular attributes in the DOM.

**Rationale for fix**: Add a lightweight post-serialization check in `serializeSVG` that
verifies the output starts with a `<svg` element bearing `xmlns="http://www.w3.org/2000/svg"`.
If missing (edge case), inject it. This is a defensive guard, not a known constant bug.

**Alternatives considered**:
- Parse the serialized string with DOMParser and re-serialize — rejected (unnecessarily
  expensive and circular).
- Use a third-party serializer — rejected (adds a dependency, violates YAGNI).

---

## Root Cause 4 — Empty `d` attributes (FR-003)

**Decision**: The degenerate-path filter from Root Cause 1 partially covers this. Add
an explicit guard in `fixer.ts` to remove any `<path>` with an empty or whitespace-only
`d` attribute after the full fix pipeline completes.

**Finding**: No existing code path in the pipeline produces a truly empty `d=""`. However,
if an upstream SVG already contains `<path d=""/>` or `<path/>` (no `d`), these pass
through all four fix steps unchanged and appear in the output. An explicit removal step
is cheap insurance.

**Rationale**: Belt-and-suspenders. The fix pipeline should never emit a `<path>` with
no meaningful `d`.

---

## Files Affected

| File | Change Type | Reason |
|------|-------------|--------|
| `src/checker/rules/compoundPathRule.ts` | Modify | Filter degenerate M-only sub-paths |
| `src/checker/fixer.ts` | Modify | Post-pipeline empty-d path removal |
| `src/utils/svgSerialize.ts` | Modify | Namespace guard on serialized output |
| `tests/unit/compoundPathRule.test.ts` | Modify + add | Update M-only test; add ID test |
| `tests/unit/fixer.test.ts` | Add | Integration tests for pipeline correctness |
| `tests/fixtures/with-id-compound-path.svg` | New | FR-004 regression fixture |
| `tests/fixtures/with-degenerate-subpaths.svg` | New | Root cause 1 fixture |
