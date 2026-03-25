# Feature Specification: Fix Fixed SVG Compatibility with Inkscape

**Feature Branch**: `002-fix-inkscape-compat`
**Created**: 2026-03-25
**Status**: Draft
**Input**: User description: "currently when I upload certain files and I fix them I get a file that crashes inkscape when I try to open it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fixed SVG Opens Correctly in Inkscape (Priority: P1)

A user uploads an SVG file, clicks Fix, downloads the fixed file, and opens it in
Inkscape. Currently, for certain input files, this results in Inkscape crashing or
refusing to open the file. After this fix, the downloaded file MUST open without errors.

**Why this priority**: The entire purpose of the fix feature is to produce a usable,
better-quality SVG. A file that crashes the target application is worse than useless —
it destroys user trust and defeats the purpose of the tool.

**Independent Test**: Upload a known-crashing SVG, click Fix, download, open in Inkscape.
The file opens successfully and renders without errors.

**Acceptance Scenarios**:

1. **Given** an SVG file that, after fixing, previously produced a crash in Inkscape,
   **When** the user downloads the fixed version,
   **Then** the file opens in Inkscape without crashing or showing a parse error.

2. **Given** any valid SVG file uploaded to the checker,
   **When** the user downloads the fixed version,
   **Then** the fixed file is valid, well-formed SVG that any conformant SVG viewer can open.

3. **Given** a fixed SVG file,
   **When** examined by an SVG validator,
   **Then** it contains no malformed XML, no duplicate `id` attributes, and no structurally
   invalid elements.

---

### User Story 2 - Quality Score Reflects Actual Remaining Issues (Priority: P2)

After the fix pipeline runs, the re-analysis report must accurately reflect the state of
the output file. If the fix introduces new structural problems (e.g., duplicate IDs,
malformed paths), the score must not show 100 while the file is broken.

**Why this priority**: A false "100% clean" score on a broken file misleads users into
trusting the output and stops them from investigating further.

**Independent Test**: Fix a known-crashing file. Confirm that the reported score matches
the actual state of the output (no silent new violations introduced by the fix itself).

**Acceptance Scenarios**:

1. **Given** an SVG that the fix pipeline processes,
   **When** the post-fix analysis report is shown,
   **Then** the score reflects only real, unfixed violations — the fix MUST NOT introduce
   new violations that go undetected by the checker.

2. **Given** a file containing paths whose IDs would collide after compound-path splitting,
   **When** the fix is applied,
   **Then** no two resulting elements share the same `id` attribute value.

---

### Edge Cases

- What happens when the input SVG has paths with `id` attributes and the fixer clones
  those paths (e.g., during compound-path splitting)? Duplicate IDs must not appear in
  the output.
- What happens when a path's `d` attribute is empty or contains only whitespace after
  a fix step? Empty/degenerate paths must not appear in the output.
- What happens when the fixer re-serializes the SVG and the serialized form differs
  from what Inkscape expects (e.g., namespace declarations, XML declaration line)?
- What happens when a group carries a `transform` that, after ungrouping, would produce
  a path with a redundant or contradictory transform chain?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The fixed SVG output MUST be well-formed XML that any conformant SVG 1.1
  parser can read without errors.
- **FR-002**: The fixed SVG output MUST NOT contain duplicate `id` attribute values across
  any two elements.
- **FR-003**: The fixed SVG output MUST NOT contain degenerate or empty `d` attributes on
  `<path>` elements.
- **FR-004**: When a compound path is split into sub-paths, only the first sub-path MUST
  retain the original `id`; all subsequent sub-paths MUST have their `id` attribute
  removed entirely (not renamed or suffixed).
- **FR-005**: The fix pipeline MUST NOT produce a structurally invalid SVG that causes
  crashes in Inkscape 1.x.
- **FR-006**: The post-fix quality report MUST accurately reflect any violations that
  remain in the output file; the fix MUST NOT silently introduce new violations.
- **FR-007**: The fixed SVG output MUST include a valid SVG namespace declaration
  (`xmlns="http://www.w3.org/2000/svg"`) on the root `<svg>` element. The serializer
  MUST NOT strip, duplicate, or malform namespace declarations or the XML encoding
  declaration in a way that causes conformant SVG parsers to reject the file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of fixed SVG files that previously caused Inkscape to crash now open
  successfully in Inkscape without errors.
- **SC-002**: 0 fixed SVG files contain duplicate `id` attribute values.
- **SC-003**: 0 fixed SVG files contain empty or malformed `<path d="">` elements.
- **SC-004**: The post-fix quality score shown to the user matches the score obtained by
  re-uploading the fixed file — no discrepancy between reported and actual quality.
- **SC-005**: All existing passing tests continue to pass after the fix (no regressions).

## Clarifications

### Session 2026-03-25

- Q: When splitting a compound path, what should happen to the `id` on sub-paths beyond the first? → A: Remove the `id` attribute entirely from all sub-paths beyond the first (Option A).
- Q: Should XML serialization correctness (namespace declarations, encoding) be in scope? → A: Yes, in scope — added as FR-007.
- Q: Is a real crashing SVG file available as a test fixture? → A: Not yet; use synthetic fixtures targeting known root causes (duplicate IDs, empty paths, namespace stripping). Real reproducer may be added later.

## Assumptions

- The primary SVG consumer that must be kept compatible is Inkscape 1.x; other viewers
  (browsers, Adobe Illustrator) are best-effort but not the primary acceptance target.
- "Crashes Inkscape" is assumed to include both hard crashes and Inkscape refusing to open
  the file with an error dialog.
- The root cause is most likely one or more of: duplicate `id` attributes introduced by
  compound-path splitting, empty `d` attributes left after deduplication, or invalid XML
  produced by the serializer.
- Fixing this issue does not require changes to the visual output of the SVG — only
  structural/attribute correctness.
- Input files are assumed to be syntactically valid SVG before uploading (the checker
  already rejects malformed XML).
- Test coverage for SC-001 will initially use synthetic SVG fixtures that trigger each
  known root cause (duplicate IDs, empty paths, malformed namespace). A real crashing
  file may be added as an additional fixture when available.
