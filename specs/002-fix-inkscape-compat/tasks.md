---
description: "Task list for Fix Fixed SVG Crashing Inkscape"
---

# Tasks: Fix Fixed SVG Crashing Inkscape

**Input**: Design documents from `specs/002-fix-inkscape-compat/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅

**Tests**: Included — Constitution Principle III (TDD) is NON-NEGOTIABLE. Tests MUST be
written and confirmed RED before each implementation task.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1 = Inkscape compatibility, US2 = Score accuracy)
- File paths relative to repo root

---

## Phase 1: Setup

**Purpose**: No new setup required — existing project structure is unchanged.
This feature modifies files within the existing `src/` and `tests/` trees.

*(No tasks — all infrastructure already in place.)*

---

## Phase 2: Foundational (Test Fixtures — blocks US1 and US2 tests)

**Purpose**: SVG fixture files shared by US1 and US2 test tasks. Both fixtures must exist
before any test tasks can be written or run.

- [X] T001 Create `tests/fixtures/with-id-compound-path.svg` — an SVG with a single compound path that has `id="mypath"` and three sub-paths (e.g., `M 10,10 L 30,10 M 40,40 L 60,40 M 70,70 L 90,90`)
- [X] T002 [P] Create `tests/fixtures/with-degenerate-subpaths.svg` — an SVG with a compound path that produces M-only sub-paths when split (e.g., `M 100,100 L 200,100 m 50,50 m 10,10`); used to verify degenerate sub-paths are dropped

**Checkpoint**: Both fixture files exist and are valid SVG — test tasks can now be written.

---

## Phase 3: User Story 1 — Fixed SVG Opens Correctly in Inkscape (Priority: P1) 🎯 MVP

**Goal**: The fix pipeline must not produce SVG output that causes Inkscape to crash or
refuse to open the file. Three root causes addressed: degenerate M-only sub-paths,
empty `d` attributes, and missing SVG namespace declaration.

**Independent Test**: Fix `with-degenerate-subpaths.svg`; open the output in Inkscape without
error. Equivalent in-test proxy: run the fixer and assert the output has no degenerate paths
and a valid xmlns declaration.

### Tests for User Story 1 (write first — must be RED before implementation) ⚠️

> **NOTE: Confirm tests FAIL for the right reason before moving to implementation.**

- [X] T003 [P] [US1] In `tests/unit/compoundPathRule.test.ts`, update the existing test `'handles three sub-paths with chained relative m offsets'`: change `expect(paths.length).toBe(3)` to `expect(paths.length).toBe(1)` and remove the assertions on paths[1] and paths[2] — this makes the test RED until T007 is implemented
- [X] T004 [P] [US1] In `tests/unit/compoundPathRule.test.ts`, add test `'retains id on first sub-path only, removes id from subsequent sub-paths'` using `tests/fixtures/with-id-compound-path.svg`: assert that after fix, only the first resulting path has `id="mypath"` and the others have no id attribute
- [X] T005 [P] [US1] Create `tests/unit/svgSerialize.test.ts`: add test `'serializeSVG always includes xmlns on root svg element'` — parse an SVG, manipulate it (add an element via createElementNS), serialize, assert the result string contains `xmlns="http://www.w3.org/2000/svg"` on the opening `<svg` tag
- [X] T006 [P] [US1] In `tests/unit/fixer.test.ts`, add test `'fixer removes paths with empty or missing d attribute from output'` — create an inline SVG with `<path d="" stroke="#000"/>` and `<path stroke="#000"/>`, run `fixer.fix()`, assert no path elements with empty or absent `d` remain in the output

### Implementation for User Story 1

- [X] T007 [US1] In `src/checker/rules/compoundPathRule.ts`, add a `hasDrawCommands(d: string): boolean` helper (returns true if `d` contains any of `LlHhVvCcSsQqTtAa`), then in `fix()` wrap the `parent.insertBefore` call to skip sub-paths where `hasDrawCommands` returns false — this drops M-only degenerate sub-paths
- [X] T008 [US1] In `src/checker/fixer.ts`, after the ordered fix loop and before `serializeSVG(doc)`, add a cleanup pass: `doc.querySelectorAll('path')` → remove any path where `getAttribute('d') ?? ''` trimmed is empty
- [X] T009 [US1] In `src/utils/svgSerialize.ts`, after `XMLSerializer().serializeToString(doc.documentElement)`, add a guard: if the result does not contain `xmlns="http://www.w3.org/2000/svg"`, inject it into the opening `<svg` tag via string replacement

**Checkpoint**: Tests T003, T005, and T006 now pass (GREEN). T004 was already GREEN
(existing id-stripping code was correct). US1 is fully functional and independently testable.

---

## Phase 4: User Story 2 — Quality Score Reflects Actual Remaining Issues (Priority: P2)

**Goal**: The post-fix quality score must not silently misreport the state of the output.
Specifically, the fix pipeline must not introduce new violations that go undetected.

**Independent Test**: Fix `with-id-compound-path.svg`; verify the output has no duplicate
`id` attributes and the reported score matches what re-uploading the fixed file would show.

### Tests for User Story 2 (write first — must be RED or GREEN as noted) ⚠️

- [X] T010 [P] [US2] In `tests/unit/fixer.test.ts`, add test `'fixing a compound path with id produces no duplicate id attributes in output'` using `tests/fixtures/with-id-compound-path.svg`: run `fixer.fix()`, parse the output, collect all `id` attribute values, assert no value appears more than once (this test is expected to be GREEN already — confirms the existing removeAttribute code works; acts as a regression guard)
- [X] T011 [P] [US2] In `tests/unit/fixer.test.ts`, add test `'fixing degenerate-subpaths fixture produces a 100-score report with no empty paths'` using `tests/fixtures/with-degenerate-subpaths.svg`: run `fixer.fix()`, assert `result.report.score === 100` and that the output contains no `<path>` element with an empty or M-only `d` attribute (this test is RED until T007 is implemented)

### Implementation for User Story 2

- [X] T012 [US2] Verify T010 and T011 pass with the US1 implementation (T007–T009). No additional production code is expected — US2 correctness is a consequence of US1 fixes. If either test is still RED, identify the gap and add targeted fix here.

**Checkpoint**: All US2 tests pass. Score accuracy is verified by automated tests.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup.

- [X] T013 Run `npm test` — confirm all tests pass including the updated T003 expectation; SC-005 (no regressions) must hold across the full test suite

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — can start immediately
- **User Story 1 (Phase 3)**: Depends on Phase 2 (fixtures must exist before tests can reference them)
  - Tests (T003–T006): Can start after Phase 2; all parallelizable [P]
  - Implementation (T007–T009): T007 must be done before T008 (T009 is independent)
- **User Story 2 (Phase 4)**: Tests (T010–T011) can start after Phase 2; T012 depends on T007
- **Polish (Phase 5)**: Depends on all story phases complete

### Within Each User Story

1. Write tests → confirm RED (or confirm existing tests are GREEN) → implement → confirm GREEN
2. T003 (red test) must precede T007 (implementation)
3. T006 (red test) must precede T008 (implementation)
4. T011 (red test) must precede or accompany T007 (implementation)
5. T012 is a verification step — run after T007, T008, T009

### Parallel Opportunities

All four US1 test tasks (T003, T004, T005, T006) can be written in parallel (different files).
T007, T008, T009 touch different files and can be implemented in parallel after tests are RED.
T010 and T011 can be written in parallel.

---

## Parallel Example: User Story 1 Tests

```bash
# Write all four US1 tests simultaneously (different files):
Task T003: "Update three-sub-paths test in tests/unit/compoundPathRule.test.ts"
Task T004: "Add id-retention test in tests/unit/compoundPathRule.test.ts"
Task T005: "Create tests/unit/svgSerialize.test.ts with namespace test"
Task T006: "Add empty-d test in tests/unit/fixer.test.ts"

# Then implement simultaneously (different files):
Task T007: "Add hasDrawCommands filter in src/checker/rules/compoundPathRule.ts"
Task T008: "Add empty-d cleanup in src/checker/fixer.ts"
Task T009: "Add namespace guard in src/utils/svgSerialize.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Create fixtures
2. Write US1 tests (T003–T006) — verify RED where expected
3. Implement T007, T008, T009 — verify all US1 tests go GREEN
4. **STOP and VALIDATE**: Run `npm test`, confirm no regressions
5. US1 alone resolves the Inkscape crash — deliverable without US2

### Incremental Delivery

1. Fixtures → US1 tests → US1 implementation → validate → US2 tests → US2 verify → polish
2. Each step independently confirms no regressions via `npm test`

---

## Notes

- [P] tasks = different files, no cross-task dependencies
- Constitution Principle III (TDD): tests MUST be written and confirmed RED before implementation
- T004 and T010 are expected to start GREEN (existing code is correct); they serve as regression guards
- T003 is a deliberate test CHANGE — the old assertion was wrong per the new spec; update it before implementing T007
- No new npm dependencies are introduced by this feature
- The `hasDrawCommands` helper in T007 is a private module function, not exported — no interface changes
