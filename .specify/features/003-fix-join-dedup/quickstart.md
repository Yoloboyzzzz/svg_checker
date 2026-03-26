# Quickstart: Fix Incorrect Node Joining and Duplicate Line Removal

**Branch**: `003-fix-join-dedup` | **Date**: 2026-03-26

## TDD Order (Constitution Principle III)

Write the failing test → confirm it fails for the right reason → implement the fix → confirm green → move to next.

---

## Step 1 — Reproduce Bug 1: False-positive joins (EPS too large)

Add this test to `tests/unit/disconnectedLineRule.test.ts`:

```typescript
it('does NOT join paths whose endpoints are 0.4 units apart (no false-positive join)', async () => {
  const { disconnectedLineRule } = await import('../../src/checker/rules/disconnectedLineRule')
  // Two line segments with endpoints 0.4 units apart — should NOT be joined
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">
    <path style="stroke:#000" d="M 0,0 L 10,0"/>
    <path style="stroke:#000" d="M 10.4,0 L 20,0"/>
  </svg>`
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, 'image/svg+xml')
  disconnectedLineRule.fix(doc)
  expect(doc.querySelectorAll('path').length).toBe(2)  // still two separate paths
})
```

**Expected result before fix**: FAIL (EPS = 0.5 joins them into one path).
**Fix**: Change `const EPS = 0.5` → `const EPS = 0.01` in `disconnectedLineRule.ts`.
**Expected result after fix**: PASS.

---

## Step 2 — Reproduce Bug 2: Duplicate `<line>` elements survive

Add this test to `tests/unit/duplicatePathRule.test.ts`:

```typescript
it('removes a duplicate <line> element leaving exactly one', async () => {
  const { duplicatePathRule } = await import('../../src/checker/rules/duplicatePathRule')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="0" x2="100" y2="100"/>
    <line x1="0" y1="0" x2="100" y2="100"/>
  </svg>`
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, 'image/svg+xml')
  expect(duplicatePathRule.check(doc).pass).toBe(false)
  duplicatePathRule.fix(doc)
  expect(doc.querySelectorAll('line').length).toBe(1)
})

it('removes a reversed duplicate <line> element', async () => {
  const { duplicatePathRule } = await import('../../src/checker/rules/duplicatePathRule')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="0" x2="100" y2="100"/>
    <line x1="100" y1="100" x2="0" y2="0"/>
  </svg>`
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, 'image/svg+xml')
  duplicatePathRule.fix(doc)
  expect(doc.querySelectorAll('line').length).toBe(1)
})
```

**Expected result before fix**: FAIL (dedup rule ignores `<line>` elements).
**Fix**: Extend `duplicatePathRule.check()` and `.fix()` to also query `line` elements, using a sorted-endpoint key.
**Expected result after fix**: PASS.

---

## Step 3 — Reproduce Bug 3: Different-stroke identical paths not deduplicated

Add this test to `tests/unit/duplicatePathRule.test.ts`:

```typescript
it('treats paths with different strokes but same geometry as duplicates', async () => {
  const { duplicatePathRule } = await import('../../src/checker/rules/duplicatePathRule')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M 0,0 L 50,50" stroke="#ff0000"/>
    <path d="M 0,0 L 50,50" stroke="#0000ff"/>
  </svg>`
  const parser = new DOMParser()
  const doc = parser.parseFromString(svg, 'image/svg+xml')
  expect(duplicatePathRule.check(doc).pass).toBe(false)
  duplicatePathRule.fix(doc)
  expect(doc.querySelectorAll('path').length).toBe(1)
})
```

**Expected result before fix**: FAIL (stroke is included in key so different strokes prevent dedup).
**Fix**: Remove `getStrokeKey(p)` from the key in both `check()` and `fix()` in `duplicatePathRule.ts`.
**Expected result after fix**: PASS.

---

## Running Tests

```bash
npm test                          # watch mode
npm run test:ui                   # visual UI
npx vitest run --reporter=verbose # single run, all results
```

## Regression Check

After all three fixes, run the full test suite and confirm no previously-passing tests regress:

```bash
npx vitest run
```

All tests must be green before opening a PR.
