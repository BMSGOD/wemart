# AGENTS.md

> Binding rules of engagement live in **`PROTOCOL.md`** — read it first, especially: run the verification gates (`npm run build && npm run lint`) after each meaningful change, fix root causes instead of suppressing errors, and **never commit/push/deploy without explicit user authorization**.

## What this is

Mobile-first **Nigerian** campus marketplace (buy/sell on university campuses, prices in naira). **Frontend connected to Supabase (read-only)**: when `VITE_SUPABASE_URL` + `VITE_SUPABASE_KEY` are set (`.env.local`, never committed), all listings come from the `catalog` database **view** (one row per offer), location pickers from the `campus_directory` view, and categories from their own small query; when either variable is missing the app shows a friendly "**Wemart is being set up**" screen (`SetupNotice.tsx`) instead of attempting broken calls. Location model is **STATE → CAMPUS only** (two linked selects, no city/region tier). Prices are in naira and render **as-is, never divided**. **Publishable (anon) key ONLY — never a service_role or secret key in the bundle.** No login, cart or checkout yet.

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

- `src/types.ts` — `Product` (with `campusName`, `campusStateId`, `campusStateName`), `Campus`, `CampusDirectoryEntry` (campus + parent state), `CategoryRef`, `Condition` (`'new' | 'used' | 'refurbished' | 'other'` live DB values; `'like-new'` exists only in sample data), `Availability`. No derived `CATEGORIES` constant — category chips load from the DB
- **Location model: STATE → CAMPUS only.** Dropdowns come from the `campus_directory` view (`campus_id, campus_name, state_id, state_name`) — never from `locations` directly. Filtering rules: campus chosen → `eq('campus_id', …)`; state only → `eq('campus_state_id', …)`; nothing → everything. The `catalog` view's `city`/`state` columns are IGNORED
- `src/data/api.ts` — the **ONLY** data-access layer. `getCampusDirectory()` (campus_directory view), `getCategories()` (categories where `is_active = true`, with `parent_category_id` + `sort_order` — the 8-top taxonomy comes from `database/0004_category_taxonomy.sql` once reviewed and run), `getCatalog({campusId, stateId, categoryIds, condition, minPrice, maxPrice, inStock, search, excludeIds, sort, limit=24, offset=0})` reading **only the `catalog` view**: `eq`/`in`/`gte`/`lte`/`gt` filters with a top-level category expanded to `IN (top + children)`, `ilike` on `product_name` with `%`/`_`/`\` escaped, `.not('offer_id','in',…)` exclusions, stable sort chains (price sorts keep `listed_at`/`offer_id` tiebreakers), paged via `range()`, `count: 'exact'` totals, plus `getNearCampus()` calling the `catalog_near_campus` RPC (same campus → same state → others, newest first; no category parameter — when search/category/condition/price/stock/sort filters are active the expanded view falls back to the campus_state view filter) and `getRecommended({...})` for empty-result fallback pools. All snake_case→camelCase mapping lives in `rowToProduct`/`rowToCampus`, in this one file. Images are resolved via `supabase.storage.from('product-images').getPublicUrl(image_path)`
- `src/data/products.ts`, `campuses.ts`, `sample-data.ts` — **retained for reference only; nothing renders them anymore** (the DB path + setup screen replaced the sample-data fallback)
- `src/lib/supabase.ts` — the single place the Supabase browser client is created. Reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_KEY` (publishable/anon key ONLY — never a service_role or secret key). When unset, `isSupabaseConfigured` is false and `App` renders the setup screen
- `database/0001_product_discovery_review.sql` — REVIEW-ONLY historical draft (Parts A/A2 read-only inspection queries, minimum-safe RLS policies, and a `product_discovery` view sketch). SUPERSEDED: the live project now serves discovery through the verified `catalog` view, which is what the frontend reads. The inspection queries (Part A/A2) are still useful read-only tools; the DDL drafts must not be run without re-review against the live `catalog` definition
- `database/0002_national_location_directory.sql` — PHASE 1 seed, REVIEW-RUN REQUIRED (manually): all 36 states + FCT and ~90 federal/state university main campuses, parented directly to their state (same relationship shape as the live rows so `campus_directory`/`catalog` semantics are untouched). Idempotent (NOT EXISTS guards); uses only the 'state'/'campus' location types; Part 0 holds read-only inspection queries (constraint + view definitions) that must be run first. Uncertain rows/campus facts are flagged `-- REVIEW` inline against the NUC-based list
- `database/0003_university_tier_DRAFT.sql` — PHASE 2 DRAFT, DO NOT RUN: the state → university → campus three-tier migration (CHECK-constraint swap, university rows, campus re-parenting, `campus_directory` rebuild). Gated on the Part 0 inspection output — especially the live `catalog` view definition, which this repo cannot read through the REST API
- `database/0004_category_taxonomy.sql` — category restructure, REVIEW-RUN REQUIRED (manually, idempotent): keeps every existing category id via renames/re-parents ("Footwear" becomes "Shoes & Footwear" under "Fashion & Accessories", "Gadgets" becomes "Electronics & Gadgets", "Services" becomes "Other") and inserts the missing subcategories — products keep their category_id untouched. Final: 8 top-level rows, max 5 children each
- `src/components/` — `App.tsx` composes filters (state + campus + search + category, AND-combined into one `getCatalog` call), owns the 300ms debounce, the localStorage-persisted location choice (`wemart.location.v1`), and pagination ("Load more") state. Adding a filter means: state in `App.tsx`, inside `filters`/`mode`, component in `components/`. `LocationSelects.tsx` renders the two linked State/Campus dropdowns (header compact + hero); `Header.tsx` owns the sticky header (logo, location selectors, cart); `BottomNav.tsx` owns the mobile bottom nav — there is no hamburger menu
- Product fields come from the `catalog` view: `condition` is `'new' | 'used' | 'refurbished' | 'other'` (unknown values collapse to `'other'` in `api.ts`), availability is derived from `available_quantity` (> 0 → "In stock", else "Sold out"), and one card = one **offer** (multi-variant products can appear as several cards). Cards show the campus + state name ("ABU, Kaduna") — no city/location tier. There is **no verified or featured flag yet** — the green vendor check icon was removed
- Prices are Nigerian naira directly from the view (`Intl.NumberFormat('en-NG')`, NGN, 0 fraction digits — `price` is naira, not kobo; **no division**)
- UI cards show a real Storage photo when the row has `image_path` — otherwise the CSS emoji placeholder; brand assets live in `public/` (`wemart-logo.png`, favicons)
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
- **Layout**: sticky header (logo, compact State + Campus selects, cart); compact hero with headline "Discover on Wemart.", supporting line, search box + "Filters" button (badge = count of active filters), removable active-filter chips ("Clear all" link), "Sell an item" primary button — all above the fold on a phone; horizontally scrolling top-level category chips plus a sub-category chip row when the chosen top-level category has children; product grid 2 columns on phones, 3–4 on wider screens; mobile-only bottom nav (Home, Browse, Sell, Orders, Me).
- **Product cards**: real Storage photo when `image_path` exists (lazy, width/height set, broken URLs degrade to the placeholder), otherwise CSS emoji placeholder; product name (+ variant name when present), **plain bold price in ink under the name**, condition tag (New / Used / Refurbished / Other), vendor shop name, actual located campus + state name ("ABU, Kaduna") — offers with neither campus nor state show no location line rather than a fabricated one; availability marker — green "In stock" for in-stock, neutral "Sold out" otherwise. No verified check icon (no flag exists yet). Empty views always put the honest message FIRST: search/category/condition/price/stock filter empty says **"Sorry, this item is currently unavailable."**, an empty campus says "Sorry, no products are currently available on this campus yet.", an empty state says **"Sorry, no products are currently available in {State}."** and a truly empty catalog says "No items here yet. Be the first to sell on this campus." — with a "Clear filters" action when filters are active. ONLY after that message, and ONLY when the result grid is empty, may a recommendations strip appear, clearly labelled and separated: **"Recommended Products"** (after an unavailable search/category/filter) or **"Recommended Products from Other Locations"** (after an empty location), with available-inventory offers ranked by the location hierarchy (selected campus → same state → nationwide) then cheapest price first — never blended into the results grid, never shown alongside non-empty results, and every card carrying its true location. Under a campus's results sits the opt-in link "Also show other campuses in {state}" (campus → same state → others, `catalog_near_campus` RPC; disabled into a plain campus filter whenever search/category/condition/price/stock/sort filters are active so location filters are never violated); its results are labelled "Also showing other campuses in {state}"
- **A11y/perf**: global visible `:focus-visible` outline (ink); `prefers-reduced-motion` disables transitions/animations; the page stays light for mobile data (no image URLs, self-hosted subsets only).
- The cart is intentionally an empty-state panel — **no fake checkout flows** (see Rules).

## Rules

- **Data rules (binding for any future change):**
  - Prices are naira. Render `price` as-is through `Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 })` — **no division, no kobo conversion**
  - Products are read ONLY from the `catalog` **view** (one row per offer) via `src/data/api.ts`. State/campus options come from the `campus_directory` **view**; the national directory itself is seeded by `database/0002_national_location_directory.sql` (run manually, idempotent). SQL migrations and seeds are NEVER applied automatically from this repo — every file in `database/` is review-first and must be run by hand in the Supabase SQL editor after review
  - **Never read `vendors`, `vendor_locations`, `buyers`, `orders` or `payments` from the browser.** Public vendor display info arrives pre-joined in the view
  - There are no verified or featured flags yet; do not invent them in the UI
  - Use the **publishable (anon) key only. The service_role key must never appear in `src/`, `.env.example`, or any `VITE_` variable** — that would leak admin access in the public bundle
- **Supabase is connected (read-only) but live data is UNVERIFIED end-to-end.** The frontend reads only the `catalog` view + `locations`/`categories`; do not claim live listings work in a report until a real query returns data in a deployed session. Never run destructive SQL on the live project from this repo; never disable RLS
- **Do not implement payment processing or pretend transactions are real.** No fake checkout flows
- **Never put secret keys anywhere in `src/` — everything becomes public in the `dist/` bundle.** If an API key is ever needed, keep it behind a Cloudflare Worker/proxy, not the front end. `VITE_`-prefixed env vars are also public
- Mobile-first: design for phones first, add `sm:`/`lg:` breakpoints upward (existing components follow this)
- `npm run build && npm run lint` from the repo root are the verification gates (build runs `tsc` typecheck + bundle; lint is `oxlint`). Run both before declaring work done

## Environment gotchas

- **Check your working directory before writing anything.** OpenCode sessions on this machine sometimes start in `C:\Program Files\Git` — that is the Git for Windows *install directory*, not a repo. This project lives at `C:\Users\PAP AMNESTY\Wemart`. Never create or edit files in the install dir
- `LF will be replaced by CRLF` warnings when staging are normal here (`core.autocrlf=true` on Windows). Do not add `.gitattributes` or churn line endings to "fix" them unless asked
- Commit identity is repo-local only (`git config user.*`, not global) — don't assume a global git identity exists
