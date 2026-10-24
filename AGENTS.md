# AGENTS.md

## What this is

Mobile-first campus marketplace (buy/sell on university campuses). **Static build only — no backend.** Data is hardcoded sample data; there are no API calls, env vars, or secrets anywhere yet.

- Stack: Vite 8 + React 19 + TypeScript 6, Tailwind CSS **v4** (plugin `@tailwindcss/vite` in `vite.config.ts`; styling entry is `@import "tailwindcss"` in `src/index.css` — there is **no `tailwind.config.*` file and none should be added**)
- Deploy target: Cloudflare Pages (`npm run build` → `dist/`, SPA fallback in `public/_redirects`; deploy with `npx wrangler pages deploy dist`)

## Commands

```bash
npm run dev       # dev server
npm run build     # tsc -b && vite build — typecheck AND build in one step
npm run preview   # serve dist/ to verify the production build
npm run lint      # oxlint (no eslint/prettier — don't add style configs)
```

There is no test framework and **no CI** (no `.github/`) by design in v1. Don't add either without prompting.

## Structure

- `src/types.ts` — `Product`, `Campus`, `Category`, `Condition`, `Availability`; `CATEGORIES` array is the single source for category lists
- `src/data/` — **sample data only.** `data/sample-data.ts` re-exports `campuses.ts` + `products.ts`; **only `src/lib/catalog.ts` may import sample data.** Components must call `searchProducts` / `getFeatured` from the catalog layer — never read the data arrays directly. When Supabase is integrated later (schema + policies finalized first), only `catalog.ts` changes
- `src/components/` — `App.tsx` composes filters (campus + search + category, all AND-combined via one `searchProducts` call in a `useMemo`). Adding a filter means: state in `App.tsx`, inside `catalogQuery`, component in `components/`. `Header.tsx` owns the mobile hamburger nav
- Product fields: `campus` must be a `Campus.id`, `category` one of `CATEGORIES`, `condition` is `'new' | 'like-new' | 'used'`, `availability` is `'available' | 'reserved' | 'sold'`, `featured` picks items for the Featured row. Typos in these string fields silently filter out items instead of erroring — the compiler does not catch them
- Prices are Nigerian naira (`NGN` via `Intl.NumberFormat('en-NG')` in `ProductCard`)
- UI is emoji placeholders, not images — real image assets don't exist yet
- Single page, no router. Only add `react-router` (or similar) if a page beyond home is needed; the `_redirects` file already supports it

## Rules

- **Frontend first; do not connect Supabase yet.** The provider will finalize the DB schema and security policies first. Also do not create databases or project scaffolds
- **Do not implement payment processing or pretend transactions are real.** No fake checkout flows
- **Never put secret keys anywhere in `src/` — everything becomes public in the `dist/` bundle.** If an API key is ever needed, keep it behind a Cloudflare Worker/proxy, not the front end. `VITE_`-prefixed env vars are also public
- Mobile-first: design for phones first, add `sm:`/`lg:` breakpoints upward (existing components follow this)
- `npm run build` passing is the only automated verification (it runs `tsc` typecheck + bundle). Run it before declaring work done

## Environment gotchas

- **Check your working directory before writing anything.** OpenCode sessions on this machine sometimes start in `C:\Program Files\Git` — that is the Git for Windows *install directory*, not a repo. This project lives at `C:\Users\PAP AMNESTY\Wemart`. Never create or edit files in the install dir
- `LF will be replaced by CRLF` warnings when staging are normal here (`core.autocrlf=true` on Windows). Do not add `.gitattributes` or churn line endings to "fix" them unless asked
- Commit identity is repo-local only (`git config user.*`, not global) — don't assume a global git identity exists
