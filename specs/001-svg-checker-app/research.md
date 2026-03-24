# Research: SVG Checker React App

**Branch**: `001-svg-checker-app` | **Date**: 2026-03-24

---

## 1. Build Toolchain

**Decision**: Vite 5 + `@vitejs/plugin-react` + TypeScript 5

**Rationale**: Vite is the current standard for React+TS SPAs (Create React App is
deprecated). Provides fast HMR, native ESM, and first-class TypeScript support with
minimal config. `@vitejs/plugin-react` uses Babel for Fast Refresh.

**Alternatives considered**: Create React App (deprecated), Next.js (overkill — no
routing/SSR needed), Parcel (less ecosystem momentum).

---

## 2. Tailwind CSS

**Decision**: Tailwind CSS v4 via `@tailwindcss/vite` Vite plugin

**Rationale**: Tailwind v4 ships a native Vite plugin (`@tailwindcss/vite`) that replaces
the PostCSS pipeline. No `tailwind.config.js` required for basic usage; configuration
lives in CSS via `@theme`. Simpler setup, faster builds.

**Alternatives considered**: Tailwind v3 + PostCSS (still works but v4 is current),
CSS Modules (more verbose), styled-components (runtime overhead).

---

## 3. SVG Parsing

**Decision**: Browser-native `DOMParser` with `"image/svg+xml"` MIME type

**Rationale**: Returns a standard `XMLDocument` DOM tree; all SVG element properties and
methods available. Zero dependencies. Works synchronously. Parse errors surfaced via
`<parsererror>` element in the returned document.

```typescript
const parser = new DOMParser();
const doc = parser.parseFromString(svgString, 'image/svg+xml');
const isError = doc.querySelector('parsererror') !== null;
```

**Alternatives considered**: `xml2js` / `fast-xml-parser` (unnecessary dependency),
regex parsing (unreliable), `<img src>` tag (no DOM access).

---

## 4. Group Detection (Check I)

**Decision**: `doc.querySelectorAll('g')` — count of results is the violation count

**Rationale**: Every `<g>` element is a violation by definition (FR-003a). Native DOM
selector is O(n) and requires no parsing logic.

---

## 5. Compound Path Detection (Check II)

**Decision**: Count paths where the normalized `d` attribute contains more than one
absolute or relative `M`/`m` command.

**Algorithm**:
```typescript
function isCompoundPath(d: string): boolean {
  // Count M/m commands; more than one = compound path
  const matches = d.match(/[Mm]/g);
  return matches !== null && matches.length > 1;
}
```

**Rationale**: Simple, no library needed. Counts `M` (absolute moveto) and `m`
(relative moveto) — each starts a new sub-path.

**Alternatives considered**: Full path command tokenizer (overkill for this check),
SVG path parsing library (adds dependency).

---

## 6. Exact Duplicate Path Detection (Check III)

**Decision**: Normalize `d` attribute strings (lowercase, collapse whitespace, round
coordinates to 4 decimal places), then group paths by `(normalizedD, normalizedColor)`.
Groups with count > 1 are duplicates.

**Normalization algorithm**:
```typescript
function normalizePath(d: string): string {
  return d
    .trim()
    .replace(/\s+/g, ' ')           // collapse whitespace
    .replace(/,\s*/g, ',')          // normalize comma spacing
    .replace(/(-?\d+\.\d{5,})/g,   // round to 4 decimal places
      (m) => parseFloat(m).toFixed(4));
}
```

**Color normalization**: Assign color string to a temporary DOM element's `style.color`,
read back `getComputedStyle().color` — browser normalizes all CSS color formats to
`rgb(r, g, b)`.

```typescript
function normalizeColor(color: string): string {
  const el = document.createElement('div');
  el.style.color = color;
  document.body.appendChild(el);
  const normalized = getComputedStyle(el).color;
  document.body.removeChild(el);
  return normalized; // always "rgb(r, g, b)"
}
```

**Stroke color resolution**: After ungrouping (which inlines inherited styles), read
`stroke` attribute. If absent or `inherit`, treat as no stroke (not a duplicate candidate).

**Alternatives considered**: Canvas pixel comparison (overkill, lossy), exact string
match (fails on whitespace/casing differences between SVG exporters).

---

## 7. Fix Operations

### Ungrouping `<g>` elements

**Decision**: Recursive depth-first traversal; for each `<g>`, inline its `transform`
onto each direct child, then replace the `<g>` with its children in the parent.

**Transform inlining**: Use `element.getCTM()` to get the cumulative transform matrix,
then write it as `transform="matrix(a,b,c,d,e,f)"` on each child — composing with any
existing child transform. Use `SVGGraphicsElement.transform.baseVal` for manipulation.

**Caveat**: `getCTM()` returns coordinates relative to the viewport. For correct
composition, use the group's own transform only (not cumulative). Read the group's
`transform` attribute, parse the matrix, and compose with any child transform.

### Splitting compound paths

**Decision**: For each compound path, split the `d` attribute on `M`/`m` boundaries.
Each sub-path becomes a new `<path>` element inheriting all attributes of the original.

```typescript
function splitCompoundPath(d: string): string[] {
  // Split on M/m, keeping the delimiter
  return d.split(/(?=[Mm])/).filter(s => s.trim() !== '');
}
```

### Merging duplicate paths

**Decision**: For each group of exact duplicates (same normalized `d` + same stroke
color), keep the first element and remove all subsequent duplicates from the DOM.

---

## 8. SVG Preview

**Decision**: Render the SVG as an `<img>` tag using a Blob URL, or inline the SVG
DOM directly. Inline rendering preferred — allows live update after fix without
re-fetching.

**Approach**: Set `dangerouslySetInnerHTML` on a container div with the raw SVG string
(sanitized — strip `<script>`, event handlers, `javascript:` hrefs before display).

**Security note**: SVGs can contain `<script>` tags and event handlers. Before
rendering inline, strip these. Use a simple allowlist approach or `DOMPurify`.

---

## 9. File Download

**Decision**: `Blob` → `URL.createObjectURL` → `<a download>` click pattern.

```typescript
function downloadSVG(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## 10. Testing

**Decision**: Vitest + `@testing-library/react` + `jsdom`

**Rationale**: Purpose-built for Vite projects, fast, ESM-native. jsdom provides DOM
environment for unit testing checker logic without a browser.

**Test strategy**:
- Unit tests for each check rule (pure functions operating on SVG strings)
- Unit tests for fix operations
- Component tests for upload/download interactions
- Test SVG fixtures with known violation counts

---

## 11. Quality Rating Formula

**Decision**: Weighted binary scoring — each of the 3 categories has weight 1/3 (default).
Score = Σ(weight_i if category_i passes). Display as integer 0–100.

```typescript
const score = Math.round(
  checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0) * 100
);
```

---

## Dependency List

| Package | Version | Purpose | Justification |
|---------|---------|---------|---------------|
| `react` | ^18 | UI framework | User requirement |
| `react-dom` | ^18 | DOM renderer | Required with React |
| `typescript` | ^5 | Type safety | User requirement |
| `vite` | ^6 | Build tool | Standard for React+TS SPAs |
| `@vitejs/plugin-react` | ^4 | React HMR | Required by Vite |
| `tailwindcss` | ^4 | Styling | User requirement |
| `@tailwindcss/vite` | ^4 | Tailwind Vite plugin | Required for Tailwind v4 |
| `vitest` | ^3 | Unit testing | Constitution Principle III |
| `@testing-library/react` | ^16 | Component testing | Constitution Principle III |
| `@testing-library/jest-dom` | ^6 | DOM matchers | Part of RTL ecosystem |
| `jsdom` | ^26 | DOM in Node | Required by Vitest |
| `dompurify` | ^3 | SVG sanitization | Security (inline SVG preview) |
| `@types/dompurify` | ^3 | TS types | DOMPurify types |

**No geometry library added**: Exact duplicate detection via string normalization
eliminates the need for a computational geometry library (Constitution Principle IV).
