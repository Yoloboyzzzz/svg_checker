# Tasks: SVG Checker React App

**Input**: Design documents from `specs/001-svg-checker-app/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Tests**: Included — Constitution Principle III mandates TDD (tests MUST be written before implementation).

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all task descriptions

## Path Conventions

- Single project: `src/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the Vite + React + TypeScript + Tailwind project and test toolchain.

- [x] T001 Initialize Vite React TypeScript project: run `npm create vite@latest . -- --template react-ts` from repo root, accepting overwrite of existing files
- [x] T002 Install and configure Tailwind CSS v4: run `npm install tailwindcss @tailwindcss/vite`, add `tailwindcss()` plugin to `vite.config.ts`, replace `src/index.css` content with `@import "tailwindcss";`
- [x] T003 [P] Install and configure Vitest + RTL: run `npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/ui`, create `vitest.setup.ts` with `import '@testing-library/jest-dom'`, add `test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'] }` block to `vite.config.ts`, add `"vitest/globals"` to `tsconfig.app.json` compilerOptions.types
- [x] T004 [P] Install DOMPurify: run `npm install dompurify && npm install --save-dev @types/dompurify`
- [x] T005 [P] Create directory structure: `src/types/`, `src/checker/rules/`, `src/utils/`, `src/components/`, `tests/unit/`, `tests/components/`, `tests/fixtures/`
- [x] T006 [P] Create SVG test fixtures in `tests/fixtures/`: `clean.svg` (valid SVG, no violations), `with-groups.svg` (contains at least one `<g>`), `with-compound-paths.svg` (path with `d="M0,0 L10,10 M20,20 L30,30"`), `with-duplicates.svg` (two `<path>` elements with identical `d` and same stroke color), `all-violations.svg` (all three violation types), `malformed.svg` (invalid XML), `empty.svg` (`<svg xmlns="http://www.w3.org/2000/svg"></svg>`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, utilities, and orchestrators that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T007 Create all shared TypeScript interfaces in `src/types/index.ts`: `CheckCategory`, `ViolationDetail`, `CheckResult`, `QualityReport`, `FixedSVG`, `AppState` (discriminated union), `CheckRule` interface — copy exactly from `specs/001-svg-checker-app/data-model.md`
- [x] T008 [P] Implement SVG parse utility in `src/utils/svgParse.ts`: export `parseSVG(svgString: string): Document` that uses `DOMParser` with `"image/svg+xml"`, throws `Error("Invalid SVG: malformed XML")` if `doc.querySelector('parsererror')` is not null
- [x] T009 [P] Implement SVG serialize utility in `src/utils/svgSerialize.ts`: export `serializeSVG(doc: Document): string` that uses `XMLSerializer().serializeToString(doc.documentElement)`
- [x] T010 [P] Implement CSS color normalization utility in `src/utils/colorNormalize.ts`: export `normalizeColor(color: string): string` that creates a temporary `<div>`, sets `div.style.color = color`, appends to body, reads `getComputedStyle(div).color`, removes div, returns the result (always `rgb(r, g, b)` format)
- [x] T011 [P] Implement file download utility in `src/utils/download.ts`: export `downloadSVG(content: string, filename: string): void` using `Blob` → `URL.createObjectURL` → `<a download>` click → `URL.revokeObjectURL` pattern
- [x] T012 Implement analyzer orchestrator in `src/checker/analyzer.ts`: export `createAnalyzer(rules: CheckRule[])` returning an object implementing `SVGAnalyzer` contract; iterate rules, call `rule.check(doc)` for each, compute weighted score as `Math.round(checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0) * 100)`, return `QualityReport` — depends on T007, T008
- [x] T013 Implement fixer orchestrator in `src/checker/fixer.ts`: export `createFixer(rules: CheckRule[], analyzer: SVGAnalyzer)` returning object implementing `SVGFixer` contract; apply fixes **in order** (groups first, then compound-paths, then duplicate-paths) by calling `rule.fix(doc)`, serialize result, re-analyze, return `FixedSVG` with `-fixed` filename suffix — depends on T007, T008, T009, T012
- [x] T014 Create empty rules registry in `src/checker/rules/index.ts`: export `DEFAULT_RULES: CheckRule[] = []` (will be populated in Phase 3), export `DEFAULT_WEIGHTS: Record<CheckCategory, number> = { 'groups': 1/3, 'compound-paths': 1/3, 'duplicate-paths': 1/3 }`

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Upload SVG and View Quality Rating (Priority: P1) 🎯 MVP

**Goal**: User uploads an SVG, sees an inline preview, a weighted quality score, and a per-category issue count.

**Independent Test**: Upload `tests/fixtures/all-violations.svg` → score is 0% and all three categories show failures; upload `tests/fixtures/clean.svg` → score is 100%.

### Tests for User Story 1 ⚠️ Write FIRST — ensure they FAIL before implementing

- [x] T015 [P] [US1] Write failing unit tests for `groupRule.check()` in `tests/unit/groupRule.test.ts`: test that `with-groups.svg` → `pass=false, violationCount≥1`; `clean.svg` → `pass=true, violationCount=0`; `empty.svg` → `pass=true`
- [x] T016 [P] [US1] Write failing unit tests for `compoundPathRule.check()` in `tests/unit/compoundPathRule.test.ts`: test that `with-compound-paths.svg` → `pass=false, violationCount≥1`; `clean.svg` → `pass=true`
- [x] T017 [P] [US1] Write failing unit tests for `duplicatePathRule.check()` in `tests/unit/duplicatePathRule.test.ts`: test that `with-duplicates.svg` → `pass=false, violationCount≥1`; `clean.svg` → `pass=true`; test color normalization (two paths with `#FF0000` and `rgb(255,0,0)` are treated as duplicates)
- [x] T018 [US1] Write failing unit tests for `analyzer.analyze()` in `tests/unit/analyzer.test.ts`: `all-violations.svg` → `score=0`; `clean.svg` → `score=100`; `malformed.svg` → throws error — depends on T015–T017
- [x] T019 [P] [US1] Write failing component test for `DropZone` in `tests/components/DropZone.test.tsx`: test that uploading a non-SVG file calls `onError`; uploading a valid `.svg` calls `onFile` with file content; drag-and-drop triggers same behavior
- [x] T020 [P] [US1] Write failing component test for `QualityScore` in `tests/components/QualityScore.test.tsx`: test that score=100 renders "100%" and a pass indicator; score=0 renders "0%" and a fail indicator; score=67 renders "67%"

### Implementation for User Story 1

- [x] T021 [P] [US1] Implement `groupRule.check()` in `src/checker/rules/groupRule.ts`: use `doc.querySelectorAll('g')` to find all group elements; return `CheckResult` with `category: 'groups'`, `label: 'No Groups'`, `weight: DEFAULT_WEIGHTS['groups']`, `pass: count === 0`, `violationCount: count`, `violations` array with each `<g>` element's index and id — make T015 pass
- [x] T022 [P] [US1] Implement `compoundPathRule.check()` in `src/checker/rules/compoundPathRule.ts`: use `doc.querySelectorAll('path')` then filter paths where `(d.match(/[Mm]/g) ?? []).length > 1`; return `CheckResult` — make T016 pass
- [x] T023 [P] [US1] Implement `duplicatePathRule.check()` in `src/checker/rules/duplicatePathRule.ts`: collect all `<path>` elements, normalize each path's `d` attribute (trim, collapse whitespace, round coordinates to 4dp) and stroke color via `normalizeColor()`, group by `(normalizedD + '|' + normalizedColor)`, flag groups with count > 1 as violations; return `CheckResult` — make T017 pass
- [x] T024 [US1] Register all three rules in `src/checker/rules/index.ts`: `DEFAULT_RULES = [groupRule, compoundPathRule, duplicatePathRule]` in fix-order (groups first) — depends on T021, T022, T023
- [x] T025 [P] [US1] Implement `DropZone` component in `src/components/DropZone.tsx`: accepts `onFile: (content: string, filename: string, fileSize: number) => void` and `onError: (message: string) => void` props; renders a styled drop target (Tailwind) and hidden file input; validates `.svg` extension on drop/select; reads file via `FileReader.readAsText`; rejects non-SVG with error message — make T019 pass
- [x] T026 [P] [US1] Implement `QualityScore` component in `src/components/QualityScore.tsx`: accepts `score: number` prop; renders large percentage number and a circular progress ring or bold badge; green for 100%, amber for 1–99%, red for 0% — make T020 pass
- [x] T027 [P] [US1] Implement `SVGPreview` component in `src/components/SVGPreview.tsx`: accepts `svgString: string` and `label: string` props; sanitizes with `DOMPurify.sanitize(svgString, { USE_PROFILES: { svg: true, svgFilters: true } })` and renders via `dangerouslySetInnerHTML`; constrain preview dimensions with Tailwind (max-h-64, overflow-hidden)
- [x] T028 [US1] Implement `App.tsx` upload → analyze flow: use `AppState` discriminated union; on file upload call `parseSVG` (catch error → `status: 'error'`), then `analyzer.analyze()`, update state to `status: 'analyzed'` with `rawSvg`, `report`, and `sanitizedSvg`; render `DropZone`, `SVGPreview`, `QualityScore`, and per-category issue counts — depends on T021–T027

**Checkpoint**: User Story 1 fully functional — upload + preview + score all working independently.

---

## Phase 4: User Story 2 — Auto-Fix SVG Issues (Priority: P2)

**Goal**: "Fix Issues" button applies all three fixes, updates the preview, and downloads the corrected SVG.

**Independent Test**: Upload `all-violations.svg` → click "Fix Issues" → download the result → re-upload → score = 100%.

### Tests for User Story 2 ⚠️ Write FIRST — ensure they FAIL before implementing

- [x] T029 [P] [US2] Write failing unit tests for `groupRule.fix()` in `tests/unit/groupRule.test.ts` (extend file): fix applied to `with-groups.svg` → re-check → `pass=true`; deeply nested groups all removed; `transform` attribute on `<g>` is inlined onto children
- [x] T030 [P] [US2] Write failing unit tests for `compoundPathRule.fix()` in `tests/unit/compoundPathRule.test.ts`: fix applied to `with-compound-paths.svg` → re-check → `pass=true`; each sub-path becomes a separate `<path>` with all original attributes preserved
- [x] T031 [P] [US2] Write failing unit tests for `duplicatePathRule.fix()` in `tests/unit/duplicatePathRule.test.ts`: fix applied to `with-duplicates.svg` → re-check → `pass=true`; only one of the duplicate paths remains
- [x] T032 [US2] Write failing unit tests for `fixer.fix()` round-trip in `tests/unit/fixer.test.ts`: `fixer.fix(allViolationsSvg)` → `fixed.report.score === 100`; filename has `-fixed` suffix; result is valid parseable SVG — depends on T029–T031
- [x] T033 [US2] Write failing component test for `FixButton` in `tests/components/FixButton.test.tsx`: button renders disabled when `score === 100`; button renders enabled when `score < 100`; click calls `onFix` callback

### Implementation for User Story 2

- [x] T034 [P] [US2] Implement `groupRule.fix()` in `src/checker/rules/groupRule.ts`: recursively find all `<g>` elements bottom-up; for each `<g>` with a `transform` attribute, read the group's transform, compose it onto each child element's existing transform using `SVGElement.transform.baseVal`; move children to parent; remove empty `<g>` — make T029 pass
- [x] T035 [P] [US2] Implement `compoundPathRule.fix()` in `src/checker/rules/compoundPathRule.ts`: for each compound path, split `d` on `/(?=[Mm])/`, create a new `<path>` element per segment copying all attributes from the original, insert after original, remove original — make T030 pass
- [x] T036 [P] [US2] Implement `duplicatePathRule.fix()` in `src/checker/rules/duplicatePathRule.ts`: re-run the grouping logic from `check()`; for each duplicate group, keep the first element and call `element.parentNode.removeChild(element)` on all subsequent duplicates — make T031 pass
- [x] T037 [US2] Wire fix order in `src/checker/fixer.ts`: call `groupRule.fix(doc)` → `compoundPathRule.fix(doc)` → `duplicatePathRule.fix(doc)` on the cloned document, then serialize and re-analyze — make T032 pass; depends on T034, T035, T036
- [x] T038 [P] [US2] Implement `FixButton` component in `src/components/FixButton.tsx`: accepts `score: number` and `onFix: () => void` props; renders a button disabled (and visually muted) when `score === 100`, otherwise enabled with primary Tailwind styling — make T033 pass
- [x] T039 [US2] Extend `App.tsx` with fix flow: on `FixButton` click, call `fixer.fix(rawSvg, filename, fileSize)`, update state to `status: 'fixed'` with both original and fixed SVG data, update `SVGPreview` to show fixed SVG, call `downloadSVG(fixed.content, fixed.filename)` — depends on T037, T038

**Checkpoint**: User Stories 1 AND 2 both independently functional.

---

## Phase 5: User Story 3 — Detailed Per-Check Breakdown (Priority: P3)

**Goal**: Each check category shows a collapsible panel with violation count and affected element identifiers.

**Independent Test**: Upload `all-violations.svg` → expand each category panel → violation counts and element IDs/indices match actual SVG content.

### Tests for User Story 3 ⚠️ Write FIRST — ensure they FAIL before implementing

- [x] T040 [US3] Write failing component test for `CheckCard` in `tests/components/CheckCard.test.tsx`: collapsed by default; click header → panel expands showing violation list; when `pass=true` renders pass indicator; when `violationCount=0` shows "No issues found"

### Implementation for User Story 3

- [x] T041 [US3] Implement `CheckCard` component in `src/components/CheckCard.tsx`: accepts `result: CheckResult` prop; renders category label, pass/fail badge, violation count; collapsible body (React `useState` for open/closed) lists each `ViolationDetail` showing `elementId ?? \`#\${elementIndex}\`` and description — make T040 pass
- [x] T042 [US3] Integrate three `CheckCard` components into `App.tsx` replacing the simple per-category issue count (one `CheckCard` per `report.checks` entry); `SVGPreview` updates to show fixed SVG when state is `'fixed'` — depends on T041

**Checkpoint**: All three user stories independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: UX improvements and final validation across all stories.

- [x] T043 [P] Add loading indicator: wrap analysis and fix calls in `App.tsx` with a `status: 'loading'` AppState variant; render a spinner overlay (Tailwind `animate-spin`) during processing to satisfy SC-001 for large files
- [x] T044 [P] Accessibility and layout polish: add `aria-label` to `DropZone` file input, `aria-disabled` to `FixButton` when disabled, `aria-expanded` to `CheckCard` toggle button; verify desktop layout is sensible at 1280px and 1440px viewport widths using Tailwind responsive utilities
- [ ] T045 Run all `quickstart.md` validation scenarios manually: upload each fixture file and confirm acceptance criteria from spec.md scenarios 1–4 for US1, 1–3 for US2, 1–2 for US3
- [x] T046 [P] Update `CLAUDE.md` with actual installed package versions from `package.json` after installation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Requires Phase 2; independent of US2 and US3
- **US2 (Phase 4)**: Requires Phase 3 completion (fix needs working check logic)
- **US3 (Phase 5)**: Requires Phase 3 completion (needs `QualityReport` data shape established)
- **Polish (Phase 6)**: Requires all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no dependencies on other stories
- **US2 (P2)**: Depends on US1 (fix methods extend the same rule modules; fixer depends on analyzer)
- **US3 (P3)**: Depends on US1 (CheckCard consumes `CheckResult` established in US1); independent of US2

### Within Each User Story

- Tests **MUST be written first and confirmed failing** before implementation (Constitution Principle III)
- Rule modules before rule registry
- Rule registry before App.tsx wiring
- Components can be built in parallel with rule logic (different files)
- App.tsx wiring is always last within a story phase

### Parallel Opportunities

Within Phase 2 (after T007): T008, T009, T010, T011 are all parallel
Within Phase 3 tests: T015, T016, T017, T019, T020 are all parallel
Within Phase 3 impl: T021, T022, T023, T025, T026, T027 are all parallel
Within Phase 4 tests: T029, T030, T031 are all parallel
Within Phase 4 impl: T034, T035, T036, T038 are all parallel

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (write first, confirm they fail):
Task: "Write failing tests for groupRule.check() in tests/unit/groupRule.test.ts"        [T015]
Task: "Write failing tests for compoundPathRule.check() in tests/unit/compoundPathRule.test.ts"  [T016]
Task: "Write failing tests for duplicatePathRule.check() in tests/unit/duplicatePathRule.test.ts" [T017]
Task: "Write failing tests for DropZone component in tests/components/DropZone.test.tsx" [T019]
Task: "Write failing tests for QualityScore component in tests/components/QualityScore.test.tsx" [T020]

# Once tests confirmed failing, launch all rule implementations together:
Task: "Implement groupRule.check() in src/checker/rules/groupRule.ts"         [T021]
Task: "Implement compoundPathRule.check() in src/checker/rules/compoundPathRule.ts" [T022]
Task: "Implement duplicatePathRule.check() in src/checker/rules/duplicatePathRule.ts" [T023]
Task: "Implement DropZone component in src/components/DropZone.tsx"            [T025]
Task: "Implement QualityScore component in src/components/QualityScore.tsx"    [T026]
Task: "Implement SVGPreview component in src/components/SVGPreview.tsx"        [T027]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (**CRITICAL — blocks all stories**)
3. Complete Phase 3: US1 (tests first, then implementation)
4. **STOP and VALIDATE**: Upload all fixture files, confirm scores match expectations
5. Deploy/demo the working upload + preview + score flow

### Incremental Delivery

1. Setup + Foundational → project scaffolded and typed
2. US1 complete → upload, preview, score (**MVP**)
3. US2 complete → fix + download working
4. US3 complete → detailed violation breakdown
5. Polish → production-ready

### TDD Cycle Per Rule (Mandatory)

For each check rule (T015→T021, T016→T022, T017→T023):
1. Write test → run `npm test` → **confirm it FAILS** (red)
2. Implement rule → run `npm test` → **confirm it PASSES** (green)
3. Refactor if needed → run `npm test` → **confirm still green**

---

## Notes

- [P] tasks = different files, no shared-state dependencies — safe to parallelize
- [Story] label maps each task to its user story for traceability
- TDD is non-negotiable per Constitution Principle III — never skip the red phase
- Fix order (ungroup → split → dedup) is load-bearing; do not change without updating T037 and the plan
- `normalizeColor()` requires a live DOM — it will not work in a pure Node.js test environment; mock it in unit tests or use the jsdom environment (configured in Vitest)
