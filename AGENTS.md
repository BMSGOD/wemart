# AGENTS.md

## What this is

Mobile-first campus marketplace (buy/sell on university campuses). **Static build only — no backend.** Data is hardcoded sample data; there are no API calls, env vars, or secrets anywhere yet.

- Stack: Vite 8 + React 19 + TypeScript 6, Tailwind CSS **v4** (plugin `@tailwindcss/vite` in `vite.config.ts`; styling entry is `@import "tailwindcss"` in `src/index.css` — there is **no `tailwind.config.*` file and none should be added**)
- Deploy target: Cloudflare Pages (`npm run build` → `dist/`, SPA fallback in `public/_redirects`)

## Commands

```bash
npm run dev       # dev server
npm run build     # tsc -b && vite build — typecheck AND build in one step
npm run preview   # serve dist/ to verify the production build
npm run lint      # oxlint (used in CI, no eslint/prettier — don't add style configs)
```

There is no test framework by design in v1. Don't add one without prompting.

## Structure

- `src/types.ts` — `Product`, `Campus`, `Category`; `CATEGORIES` array is the single source for category lists
- `src/data/` — sample data. Product `campus` field must be a `Campus.id` from `src/data/campuses.ts`; product `category` must be one of `CATEGORIES`. Typos here silently filter out items instead of erroring — the compiler does not catch these string mismatches
- `src/components/` — `App.tsx` composes filters (campus + search + category, all AND-combined via `useMemo`). Adding a filter means: state in `App.tsx`, logic in the same `useMemo`, component in `components/`
- Prices are Ghana cedis (`GHS` via `Intl.NumberFormat` in `ProductCard`)
- UI is emoji placeholders, not images — real image assets don't exist yet
- Single page, no router. Only add `react-router` (or similar) if a page beyond home is needed; the `_redirects` file already supports it

## Rules

- **Never put secret keys anywhere in `src/` — everything becomes public in the `dist/` bundle.** If an API key is ever needed, keep it behind a Cloudflare Worker/proxy, not the front end. `VITE_`-prefixed env vars are also public
- Mobile-first: design for phones first, add `sm:`/`lg:` breakpoints upward (existing components follow this)
- Widget validation currently catches nothing; `npm run build` passing is the only automated verification. Run it before declaring work done
