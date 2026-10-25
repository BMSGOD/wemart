# AGENTS.md

> Binding rules of engagement live in **`PROTOCOL.md`** — read it first, especially: run the verification gates (`npm run build && npm run lint`) after each meaningful change, fix root causes instead of suppressing errors, and **never commit/push/deploy without explicit user authorization**.

## What this is

Mobile-first **Nigerian** campus marketplace (buy/sell on university campuses, prices in naira). **Static build only — no backend.** Data is hardcoded sample data; there are no API calls, env vars, or secrets anywhere yet; no Supabase client is installed.

- Stack: Vite 8 + React 19 + TypeScript 6, Tailwind CSS **v4** (plugin `@tailwindcss/vite` in `vite.config.ts`; styling entry is `@import "tailwindcss"` in `src/index.css` — there is **no `tailwind.config.*` file and none should be added**)
- Deploy target: Cloudflare **Workers** static assets (`npx wrangler deploy`; config in `wrangler.toml` with `not_found_handling = "single-page-application"`). `npm run build` → `dist/`. There is **no `public/_redirects` file** — a catch-all SPA rule like `/* /index.html 200` fails Workers validation with "Infinite loop detected"; never recreate it. (Cloudflare *Pages* would still work via `npx wrangler pages deploy dist`, where `_redirects` is the fallback — but the current pipeline is Workers)

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
- `src/components/` — `App.tsx` composes filters (campus + search + category, all AND-combined via one `searchProducts` call in a `useMemo`). Adding a filter means: state in `App.tsx`, inside `catalogQuery`, component in `components/`. `Header.tsx` owns the sticky header (logo, campus selector, cart); `BottomNav.tsx` owns the mobile bottom nav — there is no hamburger menu
- Product fields: `campus` must be a `Campus.id`, `category` one of `CATEGORIES`, `condition` is `'new' | 'like-new' | 'used'`, `availability` is `'available' | 'reserved' | 'sold'`, `featured` picks items for the Featured row. Typos in these string fields silently filter out items instead of erroring — the compiler does not catch them
- Prices are Nigerian naira (`NGN` via `Intl.NumberFormat('en-NG')` in `ProductCard`)
- UI is emoji placeholders in cards — real image assets don't exist yet; brand assets live in `public/` (`wemart-logo.png`, favicons)
- Single page, no router. Only add `react-router` (or similar) if a page beyond home is needed; the SPA fallback comes from `wrangler.toml` (`not_found_handling`), so direct-opened/refreshed URLs resolve on the deployed site

## Design

**Brand tokens** (defined via `@theme` in `src/index.css`; never hardcode hex values in components):

| Token | Value | Use |
|---|---|---|
| `orange` | `#EF5B2D` | Primary buttons, price starbursts, active category chips, search icon |
| `orange-deep` | `#C9411A` | Hover state of primary buttons; any orange text on white |
| `orange-tint` | `#FDEBE6` | Card image placeholders, decorative starbursts, chip hover |
| `ink` | `#181311` | Nearly all text; hard offset shadows |
| `gray-cart` | `#ECECEC` | Cart drawer / neutral filled surfaces |
| `surface` | `#F7F5F3` | Page background |
| `border` | `#D9D4CF` | All card/button borders |
| `green` | `#1B7F46` | In-stock marker, verified-vendor check icon |

Fonts: single self-hosted stack, `font-sans: "Helvetica Neue", Helvetica, Arimo, Arial, sans-serif` (used for everything; headings are bold). `@fontsource/arimo` provides the bundled fallback (imported weights 400 and 700 in `src/index.css` — self-hosted via Vite; **never load fonts from a CDN**; there is no separate display font).

Rules (all intentional — keep consistent):
- **No decorative stars; the logo is the only star.** The `wemart-logo.png` in the header (and the favicons) are the only star assets; there is no starburst component or SVG/CSS star anywhere in the UI.
- **Hard offset shadow** `3px 3px 0 0 ink`, no blur, no soft grey shadows, no gradients — via the `hard-shadow` utility. Applied to primary buttons (always) and product cards (on hover/press only).
- **One radius for cards and buttons: 8px** (`rounded-lg`). Pill shape only for category chips.
- **Primary button**: `bg-orange text-ink`; hover `bg-orange-deep text-white`. The hard shadow stays on hover and collapses on press (`active:translate + shadow-none`). **Text on orange backgrounds is always Ink `#181311`, never white.** Any orange text on white uses `orange-deep`.
- **Layout**: sticky header (logo, campus selector, cart); compact hero with headline "Discover on Wemart.", supporting line, large campus picker, search box, "Sell an item" primary button — all above the fold on a phone; horizontally scrolling category chips; product grid 2 columns on phones, 3–4 on wider screens; mobile-only bottom nav (Home, Browse, Sell, Orders, Me).
- **Product cards**: CSS emoji placeholder (no external image URLs), name, **plain bold price in ink under the name**, condition tag, vendor shop name with a small green check icon for verified vendors, availability marker — green "In stock" for available, neutral for reserved/sold.
- **A11y/perf**: global visible `:focus-visible` outline (ink); `prefers-reduced-motion` disables transitions/animations; the page stays light for mobile data (no image URLs, self-hosted subsets only).
- The cart is intentionally an empty-state panel — **no fake checkout flows** (see Rules).

## Rules

- **Frontend first; do not connect Supabase yet.** The provider will finalize the DB schema and security policies first. Also do not create databases or project scaffolds
- **Do not implement payment processing or pretend transactions are real.** No fake checkout flows
- **Never put secret keys anywhere in `src/` — everything becomes public in the `dist/` bundle.** If an API key is ever needed, keep it behind a Cloudflare Worker/proxy, not the front end. `VITE_`-prefixed env vars are also public
- Mobile-first: design for phones first, add `sm:`/`lg:` breakpoints upward (existing components follow this)
- `npm run build && npm run lint` from the repo root are the verification gates (build runs `tsc` typecheck + bundle; lint is `oxlint`). Run both before declaring work done

## Environment gotchas

- **Check your working directory before writing anything.** OpenCode sessions on this machine sometimes start in `C:\Program Files\Git` — that is the Git for Windows *install directory*, not a repo. This project lives at `C:\Users\PAP AMNESTY\Wemart`. Never create or edit files in the install dir
- `LF will be replaced by CRLF` warnings when staging are normal here (`core.autocrlf=true` on Windows). Do not add `.gitattributes` or churn line endings to "fix" them unless asked
- Commit identity is repo-local only (`git config user.*`, not global) — don't assume a global git identity exists
