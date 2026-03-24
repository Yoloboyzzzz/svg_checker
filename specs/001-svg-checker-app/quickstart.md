# Quickstart: SVG Checker React App

**Branch**: `001-svg-checker-app`

This document describes how to bootstrap, develop, and validate the app locally.

---

## Prerequisites

- Node.js 20+ (LTS)
- npm 10+ (bundled with Node 20)

---

## Setup

```bash
# From repository root
npm create vite@latest . -- --template react-ts
# When prompted: select "React" + "TypeScript"

# Install Tailwind v4
npm install tailwindcss @tailwindcss/vite

# Install DOMPurify for SVG sanitization
npm install dompurify
npm install --save-dev @types/dompurify

# Install testing tools
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/ui
```

---

## Configure Vite for Tailwind v4

Edit `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

Add to `src/index.css`:

```css
@import "tailwindcss";
```

---

## Configure Vitest

Add to `vite.config.ts` (merge with above):

```typescript
/// <reference types="vitest" />
export default defineConfig({
  // ...plugins above...
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

Add to `tsconfig.app.json` → `compilerOptions.types`:

```json
"types": ["vitest/globals"]
```

---

## Development

```bash
npm run dev        # Start dev server at http://localhost:5173
npm test           # Run all tests (watch mode)
npm run test:ui    # Open Vitest UI
npm run build      # Production build
npm run preview    # Preview production build locally
```

---

## Validation

After completing implementation, verify these acceptance criteria manually:

1. **Upload a clean SVG** (no groups, compound paths, or duplicates) → score shows 100%
2. **Upload an SVG with all three violations** → score shows 0%, all three categories fail
3. **Click "Fix Issues"** → download triggers automatically
4. **Re-upload the fixed SVG** → score shows 100%
5. **Upload a non-SVG file** (e.g., `.png`) → error message shown, no score
6. **Upload an SVG with invalid XML** → parse error message shown, no score, no Fix button
7. **Upload an SVG with `#FF0000` and `rgb(255,0,0)` duplicate paths** → detected as duplicates (color normalization working)

---

## Test Fixtures

Place in `tests/fixtures/`:

| File | Description |
|------|-------------|
| `clean.svg` | Valid SVG with no violations — expect score 100% |
| `with-groups.svg` | Contains at least one `<g>` element |
| `with-compound-paths.svg` | Contains a `<path d="M0,0 L10,10 M20,20 L30,30"/>` |
| `with-duplicates.svg` | Two identical `<path>` elements with the same stroke color |
| `all-violations.svg` | All three violation types present |
| `malformed.svg` | Invalid XML (e.g., unclosed tag) |
| `empty.svg` | `<svg xmlns="http://www.w3.org/2000/svg"></svg>` |
