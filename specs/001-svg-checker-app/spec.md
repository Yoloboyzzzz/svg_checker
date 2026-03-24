# Feature Specification: SVG Checker & Fixer App

**Feature Branch**: `001-svg-checker-app`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "A completely frontend-based React/TypeScript/Tailwind app where users upload an SVG file, it rates the file based on specific parameters, and provides a button to auto-fix the issues."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload SVG and View Quality Rating (Priority: P1)

A user uploads an SVG file and immediately sees a quality score alongside a breakdown of
detected issues across the three check categories (groups, combines, overlapping same-color
nodes). The rating gives them a clear picture of whether their SVG needs cleaning.

**Why this priority**: Without upload and analysis, nothing else in the app is functional.
This is the core value proposition.

**Independent Test**: Upload a known SVG file with groups, combined paths, and overlapping
nodes — verify that the app shows a rating below 100% and lists each violation type with
counts.

**Acceptance Scenarios**:

1. **Given** the app is open with no file loaded, **When** the user drags and drops (or uses
   a file picker to select) a valid `.svg` file, **Then** the app displays the filename,
   a visual preview of the SVG, a percentage quality score, and a list of detected issues
   grouped by category.

2. **Given** an SVG with zero violations, **When** it is uploaded, **Then** the rating shows
   100% / "Pass" and the issue list is empty.

3. **Given** a non-SVG file (e.g., `.png`, `.pdf`), **When** the user attempts to upload it,
   **Then** the app rejects the file with a clear error message and does not show any rating.

4. **Given** a `.svg` file containing malformed or unparseable XML, **When** it is uploaded,
   **Then** the app displays a user-friendly error ("This SVG contains invalid XML and cannot
   be analysed"), does not show a quality score, and does not show the Fix Issues button.

---

### User Story 2 - Auto-Fix SVG Issues (Priority: P2)

After viewing the issues, the user clicks a single "Fix Issues" button. The app applies all
auto-fixable corrections to the SVG and offers the cleaned file for download.

**Why this priority**: The rating alone is informational; the fix action is what saves the
user time compared to manually editing the SVG.

**Independent Test**: Upload an SVG with at least one violation, click "Fix Issues", download
the result, then re-upload the downloaded file and confirm the rating improves (ideally 100%).

**Acceptance Scenarios**:

1. **Given** a rated SVG with at least one fixable issue, **When** the user clicks "Fix Issues",
   **Then** the fixed SVG is generated in the browser (no server round-trip) and a download is
   triggered automatically for the corrected `.svg` file.

2. **Given** the fixed file is downloaded and re-uploaded, **When** the app re-rates it,
   **Then** all previously flagged issues are gone and the score is 100%.

3. **Given** an SVG that already scores 100%, **When** the user views it, **Then** the
   "Fix Issues" button is disabled or hidden so the user cannot trigger a no-op download.

---

### User Story 3 - Detailed Per-Check Breakdown (Priority: P3)

Each quality category shows a collapsible panel with specifics: how many violations were
found, what they are, and where in the SVG they occur (e.g., element ID or path index).

**Why this priority**: Adds transparency and helps users understand and learn from the
feedback, but the core workflow (upload + fix) is fully usable without it.

**Independent Test**: Upload an SVG with known violations; expand each category panel and
verify the violation count and element identifiers match what is actually in the SVG file.

**Acceptance Scenarios**:

1. **Given** an analyzed SVG with groups, **When** the user expands the "Groups" category
   panel, **Then** they see the count of `<g>` elements and a list of their IDs (or indices
   if no ID is present).

2. **Given** an analyzed SVG with overlapping same-color lines, **When** the user expands
   the "Overlapping Nodes" panel, **Then** they see the number of affected node pairs and
   a description of which paths are involved.

---

### Edge Cases

- What happens when the uploaded SVG file has valid extension but malformed XML?
  → App displays a user-friendly parse error and blocks analysis entirely (no score, no Fix button).
- What happens when the uploaded SVG is empty (0-byte or `<svg></svg>`)?
  → App should show rating 100% (no violations) or a "Nothing to check" notice.
- What happens when the SVG is very large (e.g., > 5 MB)?
  → App should process it without crashing; a loading indicator MUST be shown during
  analysis if processing takes noticeable time.
- What happens when `<g>` elements are deeply nested?
  → All nested groups count as violations; fix MUST unwrap them all recursively.
- What happens when two duplicate paths have slightly different color representations
  (e.g., `#FF0000` vs `rgb(255,0,0)` vs `red`)?
  → Colors MUST be normalized before comparison so equivalent colors are treated as equal.
  Only paths with matching normalized colors AND identical path data are flagged as duplicates.
- What if a path has no explicit stroke/fill color (inheriting from a parent group)?
  → After groups are unwrapped, inherited styles MUST be inlined before overlap detection.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST run entirely in the browser with no backend server required.
- **FR-002**: Users MUST be able to upload an SVG file via drag-and-drop or a file picker
  button.
- **FR-003**: The app MUST parse the uploaded SVG and detect the following three issue types:
  - **FR-003a**: Presence of `<g>` (group) elements anywhere in the SVG tree.
  - **FR-003b**: Presence of combined paths (multiple sub-paths within a single `<path>`
    `d` attribute using `M` commands that create disconnected shapes, i.e., compound paths).
  - **FR-003c**: Two or more line/path nodes of the same stroke color whose path data
    (`d` attribute) is exactly identical or near-identical (within a small floating-point
    tolerance) — i.e., true geometric duplicates. Only exact/coincident duplicates are
    flagged; partial overlaps and bounding-box intersections are out of scope.
- **FR-004**: The app MUST display a quality rating (0–100%) calculated from a weighted
  combination of the three check categories. Each category carries a configurable weight;
  default weights are equal (33.3% each). A category passes if zero violations are found;
  its weighted contribution is included in the score only when it passes. The final score
  is the sum of the weights of all passing categories.
- **FR-005**: The app MUST provide a single "Fix Issues" button that applies all three fix
  types simultaneously (no per-category selection). When clicked:
  - Ungroups all `<g>` elements (moves children to parent, preserving applied transforms
    by inlining them onto each child).
  - Splits combined/compound paths into individual `<path>` elements.
  - Merges overlapping same-color line nodes into a single unified path.
- **FR-006**: After fixing, the app MUST offer the corrected SVG as a downloadable file
  with the original filename suffixed with `-fixed` (e.g., `icon-fixed.svg`).
- **FR-007**: The UI MUST be built with React and TypeScript, styled exclusively with
  Tailwind CSS.
- **FR-008**: The app MUST display a per-category issue count and description for each of
  the three check types.
- **FR-010**: The app MUST render a visual preview of the uploaded SVG file inline in the
  UI. The preview MUST be shown using the browser's native SVG rendering (no rasterisation).
  It MUST update to show the fixed SVG after the user clicks "Fix Issues".
- **FR-009**: Color comparison for overlapping-node detection MUST normalize CSS color
  values (named colors, hex, rgb()) before comparing.

### Key Entities

- **SVGDocument**: The parsed representation of the uploaded file; source of truth for
  all analysis and fix operations.
- **CheckResult**: Per-category analysis result containing: category name, pass/fail
  status, violation count, and list of affected element identifiers.
- **QualityRating**: Aggregate score (0–100%) derived from all CheckResults.
- **FixedSVGDocument**: The transformed SVGDocument after all auto-fixes are applied;
  used to generate the downloadable output.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can upload an SVG, view a quality rating, and download a fixed SVG
  in under 30 seconds for files up to 1 MB.
- **SC-002**: Re-uploading a fixed SVG always yields a 100% rating for the three
  supported check types.
- **SC-003**: The fix operation produces a valid, renderable SVG — browsers MUST be able
  to display the fixed file without errors.
- **SC-004**: The app works without any network requests after the initial page load
  (fully offline-capable once loaded).
- **SC-005**: All three check categories show correct violation counts when tested against
  SVGs with known, manually verified issue counts.

---

## Assumptions

- The target user is a designer or developer who works with SVG files and wants a quick
  way to clean them up before use in production (e.g., web, laser cutting, print).
- Mobile support is out of scope for v1; the app is designed for desktop browsers.
- Only SVG 1.1 / SVG 2 content-type files are in scope; embedded foreign objects
  (`<foreignObject>`) are preserved as-is and not analyzed.
- The three check types defined by the user are the complete scope for v1; no additional
  checks are added unless explicitly requested.
- "Combines" (FR-003b) refers to compound paths — a single `<path>` element whose `d`
  attribute contains multiple `M` (moveto) commands, creating disconnected sub-paths.
- "Overlapping nodes" (FR-003c) refers specifically to line/stroke paths (not filled
  shapes) that share the same stroke color and have exactly identical path data (true
  duplicates). Partial overlaps and bounding-box intersections are out of scope.
- The app will be a single-page application (SPA) with no routing required.
- No user authentication, persistence, or history features are needed for v1.

---

## Clarifications

### Session 2026-03-24

- Q: What constitutes "overlapping" paths for FR-003c — exact duplicates, shared segments, or bounding-box overlap? → A: Exact / coincident duplicates only (identical or near-identical `d` attribute within floating-point tolerance).
- Q: How is the quality rating (FR-004) calculated — binary 3-check proportion, violation-count weighted, or weighted category score? → A: Weighted category score; each of the 3 categories has a configurable weight (default equal at 33.3% each); score = sum of weights of passing categories.
- Q: Should the app render a visual preview of the uploaded SVG in the UI? → A: Yes — native browser SVG rendering inline; preview updates to show the fixed SVG after fix is applied (FR-010).
- Q: What happens when a `.svg` file contains malformed/unparseable XML? → A: Display a user-friendly error message, block analysis entirely — no score and no Fix Issues button shown.
- Q: Should fixes be selectable per category or applied all-at-once? → A: All-at-once — single "Fix Issues" button applies all three fix types simultaneously; no per-category toggles.
