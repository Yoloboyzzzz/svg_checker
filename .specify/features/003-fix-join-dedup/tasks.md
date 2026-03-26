# Tasks: Fix Incorrect Node Joining and Duplicate Line Removal

**Input**: Design documents from `.specify/features/003-fix-join-dedup/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Included — Constitution Principle III (TDD) is NON-NEGOTIABLE. All test tasks MUST fail before the corresponding implementation task is started.

**Organization**: Tasks are grouped by user story. US1 and US2 implementation phases can be worked in parallel (different source files).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1 or US2)

---

## Phase 1: Setup (New Test Fixtures)

**Purpose**: Add SVG fixtures that reproduce the two bugs. These are needed before writing any tests.

- [x] T001 Create fixture `tests/fixtures/paths-far-apart.svg` — two path segments whose endpoints are 0.4 units apart (must NOT be joined after fix)
- [x] T002 [P] Create fixture `tests/fixtures/paths-near-coincident.svg` — two path segments whose endpoints are 0.009 units apart (MUST be joined after fix)
- [x] T003 [P] Create fixture `tests/fixtures/with-duplicate-lines.svg` — two identical `<line>` elements with the same x1,y1,x2,y2
- [x] T004 [P] Create fixture `tests/fixtures/with-reversed-duplicate-line.svg` — one `<line>` and its reverse (x1,y1 and x2,y2 swapped)

**Checkpoint**: Four new fixture files exist in `tests/fixtures/`

---

## Phase 2: Foundational (Regression Baseline)

**Purpose**: Confirm all existing tests pass before any code changes are made. This is the baseline — any breakage after Phase 3+ is a regression.

**⚠️ CRITICAL**: No implementation work can begin until this passes cleanly.

- [x] T005 Run `npx vitest run` from repo root and confirm all existing tests pass (zero failures, zero skipped)

**Checkpoint**: Baseline green — user story work can now begin

---

## Phase 3: User Story 1 — Correct Node Joining (Priority: P1) 🎯 MVP

**Goal**: Fix the join tolerance so paths 0.4 units apart are NOT joined, while paths ≤ 0.01 units apart still are joined correctly.

**Independent Test**: Upload an SVG with two paths whose endpoints are 0.4 units apart → apply fix → verify output still has two separate paths.

### Tests for User Story 1 (write FIRST — must FAIL before T008)

- [x] T006 [US1] Add failing test to `tests/unit/disconnectedLineRule.test.ts`: two paths with endpoints 0.4 units apart are NOT joined by `fix()` (uses fixture `paths-far-apart.svg` or inline SVG)
- [x] T007 [US1] Add failing test to `tests/unit/disconnectedLineRule.test.ts`: two paths with endpoints 0.009 units apart ARE joined by `fix()` into one path (uses fixture `paths-near-coincident.svg` or inline SVG)

> **Confirm T006 and T007 FAIL before proceeding to T008.**

### Implementation for User Story 1

- [x] T008 [US1] In `src/checker/rules/disconnectedLineRule.ts` line 16: change `const EPS = 0.5` to `const EPS = 0.01`

- [x] T009 [US1] Run `npx vitest run tests/unit/disconnectedLineRule.test.ts` and confirm T006 and T007 now pass with no regressions in that file

**Checkpoint**: User Story 1 fully functional. US2 can now start (or was already running in parallel).

---

## Phase 4: User Story 2 — Duplicate Line Removal (Priority: P2)

**Goal**: Fix the deduplication rule so that (a) geometrically identical paths with different stroke colors are considered duplicates, and (b) duplicate `<line>` elements are detected and removed before the join step.

**Independent Test**: Upload an SVG with two overlapping identical lines → apply fix → verify only one line remains in output.

### Tests for User Story 2 (write FIRST — must FAIL before T013)

- [x] T010 [P] [US2] Add failing test to `tests/unit/duplicatePathRule.test.ts`: two `<path>` elements with identical geometry but different stroke colors (`#ff0000` vs `#0000ff`) are detected as duplicates by `check()` and removed by `fix()`
- [x] T011 [P] [US2] Add failing test to `tests/unit/duplicatePathRule.test.ts`: two identical `<line>` elements are detected as duplicates by `check()` (uses fixture `with-duplicate-lines.svg` or inline SVG)
- [x] T012 [P] [US2] Add failing test to `tests/unit/duplicatePathRule.test.ts`: a `<line>` and its reverse (`x1,y1` ↔ `x2,y2` swapped) are detected as duplicates by `check()` and one is removed by `fix()` (uses fixture `with-reversed-duplicate-line.svg` or inline SVG)

> **Confirm T010, T011, T012 FAIL before proceeding to T013.**

### Implementation for User Story 2

- [x] T013 [US2] In `src/checker/rules/duplicatePathRule.ts`: remove `getStrokeKey(p)` from the duplicate key in both `check()` (line 39) and `fix()` (line 69). New key format: `normalizePath(d) + '|' + transform`

- [x] T014 [US2] In `src/checker/rules/duplicatePathRule.ts`: add a `normalizeLineKey(el: Element): string` helper that rounds coordinates to 2 decimal places and sorts the two endpoints lexicographically, returning `"x1,y1|x2,y2|transform=..."` (sorted so reversed copies match)

- [x] T015 [US2] In `src/checker/rules/duplicatePathRule.ts`: extend `check()` to also query `doc.querySelectorAll('line')`, filter out elements inside defs, and use `normalizeLineKey()` to detect duplicate `<line>` elements alongside `<path>` elements

- [x] T016 [US2] In `src/checker/rules/duplicatePathRule.ts`: extend `fix()` to also query `doc.querySelectorAll('line')`, filter out elements inside defs, and remove duplicate `<line>` elements using the same `normalizeLineKey()` key

- [x] T017 [US2] Run `npx vitest run tests/unit/duplicatePathRule.test.ts` and confirm T010, T011, T012 now pass with no regressions in that file

**Checkpoint**: User Stories 1 and 2 both functional. Duplicate lines removed before join step; joined correctly with tight tolerance.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Full regression verification and coverage check.

- [x] T018 Run `npx vitest run` (full suite) — confirm 100% green across all test files
- [x] T019 [P] Verify 100% branch coverage for `src/checker/rules/disconnectedLineRule.ts` (Constitution requirement — run `npx vitest run --coverage` and inspect the report)
- [x] T020 [P] Verify 100% branch coverage for `src/checker/rules/duplicatePathRule.ts` (Constitution requirement)
- [x] T021 Run `npm run build` and confirm production build succeeds with no TypeScript errors

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion
- **US1 (Phase 3)**: Depends on Phase 2 baseline green
- **US2 (Phase 4)**: Depends on Phase 2 baseline green — **can run in parallel with Phase 3**
- **Polish (Phase 5)**: Depends on Phase 3 AND Phase 4 completion

### User Story Dependencies

- **US1 (P1)**: Independent — only touches `disconnectedLineRule.ts` and its test file
- **US2 (P2)**: Independent — only touches `duplicatePathRule.ts` and its test file
- US1 and US2 share NO source files and can be implemented in parallel after Phase 2

### Within Each User Story

1. Write all tests for the story → confirm they FAIL
2. Implement the fix
3. Confirm tests pass + no regressions

### Parallel Opportunities

- T001, T002, T003, T004 — all fixture files are independent, write in parallel
- T006 and T010 — tests for different files, write in parallel
- T007 and T011/T012 — tests for different files, write in parallel
- T008 (EPS fix) and T013/T014/T015/T016 (dedup fixes) — different files, implement in parallel
- T019 and T020 — coverage checks for different files, run in parallel

---

## Parallel Example: Both User Stories Together

```text
# After Phase 2 (baseline confirmed green):

Parallel stream A (US1):
  T006 → T007 → [confirm FAIL] → T008 → T009

Parallel stream B (US2):
  T010 → T011 → T012 → [confirm FAIL] → T013 → T014 → T015 → T016 → T017

# Then Phase 5 (after both streams complete):
  T018 → T019 + T020 (parallel) → T021
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Create fixtures (T001–T004)
2. Complete Phase 2: Baseline check (T005)
3. Complete Phase 3: US1 — EPS fix (T006–T009)
4. **STOP and VALIDATE**: Run full test suite; confirm US1 acceptance scenarios pass
5. Proceed to US2 if time allows

### Incremental Delivery

1. Setup + Foundational → baseline confirmed
2. US1: change one constant, two new tests → deliverable increment (join correctness)
3. US2: three targeted changes, three new tests → deliverable increment (dedup correctness)
4. Polish: coverage + build check → ready for PR

---

## Notes

- TDD order is MANDATORY (Constitution Principle III): each test batch MUST fail before its implementation task
- `EPS` is a module-level constant — changing it affects ALL join decisions; verify no existing join tests regress
- The `normalizeLineKey()` helper in T014 is a new private function; keep it alongside `normalizePath()` in `duplicatePathRule.ts`
- After T013 removes stroke from the path dedup key, the existing test "treats color-equivalent strokes as duplicates" still passes (same geometry = same key regardless)
- Commit after T009 (US1 complete) and after T017 (US2 complete) to keep history clean
