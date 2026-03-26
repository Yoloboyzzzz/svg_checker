# Feature Specification: Fix Incorrect Node Joining and Duplicate Line Removal

**Feature Branch**: `003-fix-join-dedup`
**Created**: 2026-03-26
**Status**: Draft
**Input**: User description: "The software still joines nodes incorrectly an it does not correctly remove lines that are on top of eachother."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct Node Joining (Priority: P1)

A user uploads an SVG file containing paths whose endpoints are at the same coordinates. When they run the "join connected segments" fix, the tool correctly identifies and joins only path segments whose endpoints genuinely coincide (same position), without merging unrelated paths or creating incorrect geometry.

**Why this priority**: Incorrect node joining corrupts the SVG geometry, producing broken paths that render differently than intended. This is the highest-risk defect as it silently damages the user's artwork.

**Independent Test**: Can be fully tested by uploading an SVG with known path endpoints and verifying that joined segments produce the correct combined path geometry.

**Acceptance Scenarios**:

1. **Given** an SVG with two path segments whose endpoints share the exact same coordinates, **When** the join fix is applied, **Then** the segments are merged into a single continuous path without altering any other geometry.
2. **Given** an SVG with two path segments whose endpoints are close but not coincident, **When** the join fix is applied, **Then** those segments are NOT joined (no false positives).
3. **Given** an SVG with three or more paths where only two are adjacent, **When** the join fix is applied, **Then** only the adjacent pair is joined and the third path remains unchanged.
4. **Given** an SVG with no joinable segments, **When** the join fix is applied, **Then** no paths are modified and the output is identical to the input.

---

### User Story 2 - Duplicate Line Removal (Priority: P2)

A user uploads an SVG file that contains two or more lines or path segments drawn on top of each other (same start point, same end point, same shape). When they run the "deduplicate" fix, the tool removes the redundant copies so that only one instance of each unique line/segment remains.

**Why this priority**: Duplicate lines cause visual artefacts in laser cutting and pen plotting workflows (double-cutting/drawing), wasting time and materials. Correct removal is essential for the tool's primary use case.

**Independent Test**: Can be fully tested by uploading an SVG containing an intentionally duplicated line and verifying that exactly one copy remains after the fix.

**Acceptance Scenarios**:

1. **Given** an SVG with two identical lines (same coordinates, same shape), **When** the deduplication fix is applied, **Then** one of the duplicates is removed and exactly one copy of the line remains.
2. **Given** an SVG with a line and a reversed copy of it (start/end swapped), **When** the deduplication fix is applied, **Then** the reversed duplicate is also recognised and removed.
3. **Given** an SVG with two lines that overlap partially but are not identical, **When** the deduplication fix is applied, **Then** neither line is removed (no false positives).
4. **Given** an SVG with no duplicate lines, **When** the deduplication fix is applied, **Then** no lines are removed and the output is identical to the input.
5. **Given** an SVG with three identical copies of a line, **When** the deduplication fix is applied, **Then** only one copy remains (all extras removed, not just one).

---

### Edge Cases

- What happens when a path has zero length (start equals end)? It should not be joined to other paths and should be handled gracefully.
- How does the system handle paths with floating-point coordinate imprecision (e.g., `0.0000001` vs `0.0`)? A small tolerance threshold must be defined and documented.
- What happens when an SVG contains grouped elements that contain duplicate or joinable paths inside the group? The fix must operate correctly after ungrouping (which precedes joining/deduplication in the fix order).
- How does the system handle compound paths? They must be split before join/dedup operations are attempted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST identify path segments as joinable only when their endpoints are within the defined coordinate tolerance of each other (default: exact match or ≤ 0.01 user units).
- **FR-002**: The system MUST NOT join path segments whose endpoints are outside the defined tolerance, regardless of visual proximity on screen.
- **FR-003**: The system MUST join adjacent segments in the correct direction, preserving the winding order and continuity of the resulting combined path.
- **FR-004**: The system MUST identify two path/line elements as duplicates when they trace the same geometric shape, regardless of direction (i.e., a reversed copy counts as a duplicate). This applies to all path types: straight lines, bezier curves, and arcs. Visual attributes such as stroke colour, fill, and width are ignored during duplicate comparison — only path coordinates determine identity.
- **FR-005**: The system MUST remove all duplicate copies of a line/path, leaving exactly one instance when multiple identical copies exist.
- **FR-006**: The system MUST NOT remove any path or line that is not a true duplicate of another element in the same SVG.
- **FR-007**: The system MUST apply fixes in the correct order: ungroup → split compound paths → deduplicate → join connected segments.
- **FR-008**: The system MUST report the number of join operations and duplicate removals performed, so the user can verify the results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of SVG test fixtures with known joinable segments produce correctly joined output paths (zero incorrect joins, zero missed joins).
- **SC-002**: 100% of SVG test fixtures with known duplicate lines produce output with exactly the correct number of lines remaining (zero false removals, zero missed duplicates).
- **SC-003**: No existing passing tests regress after the fix is applied.
- **SC-004**: The fix correctly handles all documented edge cases (zero-length paths, near-coincident coordinates, reversed duplicates) without error or crash.
- **SC-005**: Users report that processed SVGs are correct when opened in a vector editor, with no unexpected missing or added geometry.

## Clarifications

### Session 2026-03-26

- Q: What makes two paths "the same" for deduplication — geometry only, or geometry + visual attributes? → A: Geometry only (same coordinates = duplicate; stroke, fill, and other style attributes are ignored).
- Q: Are bezier curves and arcs in scope for deduplication, or only straight lines? → A: All path types — straight lines, bezier curves, and arcs are all checked for duplicates.
- Q: What coordinate tolerance should define "same position" for joining and deduplication? → A: 0.01 SVG user units (fixed constant, not user-configurable).

## Assumptions

- The coordinate tolerance for "same position" is exactly 0.01 SVG user units (fixed constant, not user-configurable); coordinates within this distance are considered coincident for both joining and deduplication.
- "Lines on top of each other" means geometrically identical paths, including reversed copies (start/end swapped), not merely visually overlapping shapes with different paths.
- The fix ordering (ungroup → split → deduplicate → join) is already defined and will not change; only the correctness of the deduplication and join steps is in scope.
- Fixes are applied to the full SVG document after ungrouping and compound-path splitting have already been performed correctly by their respective steps.
- The user is working with SVG files intended for laser cutting, pen plotting, or similar fabrication workflows where duplicate lines and incorrect joins directly cause physical problems.
