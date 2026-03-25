# SVG Checker — Development Guidelines

Auto-generated from feature plan. Last updated: 2026-03-24

## Active Technologies

- **React 19** (`^19.2.4`) + **TypeScript 6** (`^6.0.2`) — UI framework and type system
- **Vite 8** (`^8.0.2`) + `@vitejs/plugin-react` (`^6.0.1`) — build tool and dev server
- **Tailwind CSS v4** (`^4.2.2`) + `@tailwindcss/vite` (`^4.2.2`) — styling (Vite plugin, no PostCSS config needed)
- **DOMPurify 3** (`^3.3.3`) — SVG sanitization before inline rendering
- **Vitest 4** (`^4.1.1`) + **React Testing Library 16** (`^16.3.2`) + **jsdom 29** (`^29.0.1`) — testing

## Project Structure

```text
src/
├── types/index.ts           # All shared TypeScript interfaces
├── checker/
│   ├── rules/               # One file per check rule + index.ts registry
│   ├── analyzer.ts          # Orchestrates checks → QualityReport
│   └── fixer.ts             # Orchestrates fixes → FixedSVG
├── utils/                   # Pure helpers (parse, serialize, color, download)
├── components/              # React components
└── App.tsx                  # Root component (owns AppState)

tests/
├── fixtures/                # SVG test files with known violation counts
├── unit/                    # Pure logic tests (no React)
└── components/              # RTL component tests
```

## Commands

```bash
npm run dev          # Dev server at http://localhost:5173
npm test             # Vitest watch mode
npm run test:ui      # Vitest UI
npm run build        # Production build
npm run preview      # Preview prod build
```

## Code Style

- **TypeScript strict mode** — no `any`, no implicit returns
- **Pure functions** for all checker logic — `check()` MUST NOT mutate the DOM
- **Fix ordering**: ungroup → split compound paths → deduplicate → join connected segments (always this order)
- **No inline styles** — use Tailwind utility classes only
- **DOMPurify before any `dangerouslySetInnerHTML`** — no exceptions

## Adding a New Check Rule

1. Create `src/checker/rules/myRule.ts` implementing the `CheckRule` interface
2. Add it to the `DEFAULT_RULES` array in `src/checker/rules/index.ts`
3. Write unit tests in `tests/unit/myRule.test.ts` with positive + negative SVG fixtures
4. No changes needed in `analyzer.ts` or `fixer.ts`

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
