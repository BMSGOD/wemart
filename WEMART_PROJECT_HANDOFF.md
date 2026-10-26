# WEMART — PROJECT HANDOFF & CONTEXT SUMMARY

> Generated 2026-10-25 from the actual repository files (AGENTS.md, package.json, src/, database/, wrangler.toml, git state) plus REST verifications run against the live Supabase project with the **anon key only**.
> This document is the handoff source of truth when it agrees with the code. Where the owner provided database facts that could not be re-verified from the repo, they are marked **[owner-verified]**.
> **No application code, SQL, commits or deployments were changed to produce this document.**
>
> ---
>
> ## AUTH-PHASE UPDATE (2026-10-26) — supersedes sections 6–11 below where they disagree
>
> Sections 2–10 of this document were written before the auth phase and are stale in parts (e.g. "no auth in code", phase statuses). The live state:
>
> **Done — frontend (auth phase, build+lint+vitest green, not yet exercised against live Supabase):**
> - `src/lib/auth.tsx` — Supabase Auth façade: sign-up (buyer/vendor roles in `user_metadata`), sign-in/out, email verify/resend, password reset/recovery; names the 0008 trigger's metadata contract (`role`, `full_name`, `shop_name`).
> - `src/lib/router.tsx` — dependency-free pathname router (`/auth/*`, `/verify`, `/reset-password`, `/sell`, `/account`); deep links survive via the wrangler SPA fallback.
> - `src/pages/AuthPages.tsx` (register/verify/login/reset), `src/pages/HomePage.tsx` (v1 catalog engine moved verbatim; storefront redesign committed on branch `frontend-tweaks` in worktree `Wemart-frontend`), `src/pages/VendorDashboardPage.tsx` (profile edit via `business_name`/`display_name` only, store-locations manager over `vendor_locations` × `campus_directory`, pending-account banner, read-only inventory), `src/pages/AccountPages.tsx` (buyer profile via `display_name`/`whatsapp_number`), `src/components/AuthPrompt.tsx` (built but UNWIRED — confirmed schema exposes no vendor contact field).
> - `src/data/vendor.ts` — guarded own-row data layer; every write names verified columns only; maps 42501 → "policies-pending" sentinel; `listVendorProducts(vendorId)` scopes inventory reads to the caller's vendor id (reconciled to the preserved public SELECT policies).
> - Tests: `npm test` (vitest + RTL + jsdom) — 23/23 pass; still NOT live-verified end-to-end.
>
> **SQL state:** 0006 executed+verified (V4 browser probe still not owner-confirmed). 0007 executed. 0003 finalized (84 UUID bonds), not yet executed. 0004 reviewed but not run. **0010 pre-execution inspection COMPLETED 2026-10-26** — all facts reconciled into **`database/0008_vendor_buyer_rls_policies.sql`, now execution-ready and HARDENED against privilege escalation** (column-level ACLs: vendor `account_status`/`auth_user_id` and buyer `auth_user_id`/`id` are ungranted to the browser; see its header + AGENTS.md row).
>
> **0008 blockers to clear before execution (unknowns that remain, none invented):**
> 1. products base-table columns beyond `id/vendor_id/listing_status` (name/price/quantity/image…) are still unconfirmed ⇒ product-creation/pricing UI stays blocked; no inventory write columns invented.
> 2. Vendor contact/location-address fields: no confirmed columns ⇒ AuthPrompt stays unwired.
> 3. Part 7 partial unique indexes (vendors/buyers `auth_user_id`): needs explicit owner approval; 010 proved no duplicate links exist, so they apply cleanly.
> 4. results of admin email verification settings (Supabase Auth dashboard Site URL + redirect URLs must be set for verify/reset flows).
>
> **Next owner action:** review + approve + run `database/0008_vendor_buyer_rls_policies.sql` in one SQL-Editor session (single transaction, preflight aborts cleanly), then run its read-only verification tail and paste the full JSON; follow the V8/V9 manual checklist ([TEST] vendor/buyer signup → exactly one linked profile row each; anon buyers probe → []; 0006 regression probe; catalog browsing identical). Then re-run 0010 for the after-policies snapshot. Product-creation UI resumes once the products base-table columns are confirmed (0011 column dump).

---

## 1. Project overview

**Wemart** is a mobile-first **Nigerian campus marketplace**: student/graduate vendors sell to buyers on and around Nigerian university campuses. Prices are in **naira, rendered as-is (never divided)**.

- **Buyers** discover products through search, top-level category chips + sub-category chips, a STATE → CAMPUS location picker, condition/price/stock filters and sorting; buyers see truthful campus + state labels on every card and honest empty-state behaviour.
- **Vendors (planned)** will register with store/contact details and manage their own products, inventory, locations and store profile through a dashboard (Phase 2 of the roadmap — not implemented).
- **Communication model (planned)**: buyers contact vendors for meet-ups; the roadmap specifies an optional sign-in/account prompt around WhatsApp vendor contact. **No WhatsApp contact action exists anywhere in the frontend today** (verified: zero `wa.me`/WhatsApp matches in `src/`) — do not assume it exists; Phase 2+ must build it or the owner must supply its current home.
- **Payments (planned)**: Paystack **test mode only**, verified server-side (payment recorded as paid only after backend/webhook verification). Never exposed or faked in the frontend.
- **Roles of the tools**: Supabase = Postgres + REST/RPC + Auth (Auth not yet used in code) + Storage (product images, `product-images` bucket via public URLs). The frontend is a Read-Only React SPA deployed to Cloudflare Workers. OpenCode sessions perform implementation; **binding engagement rules live in `PROTOCOL.md` and `AGENTS.md`** (inspect before editing; verification gates = `npm run build && npm run lint`; never commit/push/apply SQL/deploy without explicit owner approval).

---

## 2. Architecture (verified)

| Layer | Technology | Notes |
|---|---|---|
| Build/dev | Vite 8 + TypeScript 6 (`tsc -b` in `build`), React 19 | `npm run dev`, `npm run build`, `npm run preview` |
| Styling | Tailwind CSS **v4** (`@tailwindcss/vite`) | `@import "tailwindcss"` in `src/index.css`; `@theme` design tokens; **no `tailwind.config.*` exists and none may be added** |
| Lint | `oxlint` (no ESLint/prettier configs) | `.oxlintrc.json` present |
| Fonts | `@fontsource/arimo` self-hosted (400/700) | no CDN fonts |
| Data | `@supabase/supabase-js` **2.118** (single browser client) | publishable/anon key only; `persistSession: false` |
| Deploy | Cloudflare **Workers** static assets (`wrangler.toml`, `not_found_handling = "single-page-application"`) | `npm run build` → `dist/`; pushes to `main` redeploy via Cloudflare GitHub integration; **never create `public/_redirects`** (Workers rejects the `/* /index.html 200` rule as an infinite loop) |
| Tests | None by design in v1 (no test framework, no CI) | "testing" = build + lint + manual REST probes via curl |

### Environment variables (names only — values stay in `.env.local`, gitignored; template in `.env.example`)

- `VITE_SUPABASE_URL` — Supabase project URL. Current project: `https://wlnqaykydrabhysbqtof.supabase.co` (public URL, safe in the bundle).
- `VITE_SUPABASE_KEY` — the **publishable/anon** key. **Never a service_role key; it must never appear in `src/`, `.env.example`, or any `VITE_` var.**

When either variable is missing, `App` renders `SetupNotice` ("Wemart is being set up") instead of making broken calls.

### Directory map

```
AGENTS.md            binding project rules (data rules, design tokens, commands)
PROTOCOL.md          binding engagement rules for agent sessions
wrangler.toml        Cloudflare Workers static-assets config (SPA fallback)
.env.example/.local  env template / real anon credentials (gitignored)
database/            review-first SQL files (0001–0004) — NEVER auto-applied
src/main.tsx         React entry
src/App.tsx          the whole single-page experience: filters, URL sync, fetch,
                     grouped result sections, empty states, recommendations
src/types.ts         Product/CampusDirectoryEntry/CategoryRef/Filters/SortOption
src/data/api.ts      THE ONLY data-access layer (all snake→camel mapping here)
src/lib/supabase.ts  the ONLY place the Supabase client is created
src/components/      Header, LocationSelects, SearchBox, CategoryButtons,
                     FilterSheet, ProductGrid, ProductCard, BottomNav, SetupNotice
src/data/products.ts, campuses.ts, sample-data.ts   reference only — nothing renders them
public/              wemart-logo.png, favicons (the only star assets)
```

---

## 3. Database — what is verified vs assumed

### Verified (REST probes with the anon key, this project)

| Object | Status |
|---|---|
| `campus_directory` view (`campus_id, campus_name, state_id, state_name`) | readable; **[owner-verified]** now holds **~110 campuses across all 36 states + FCT — all states exist even with no vendors** |
| `catalog_search` RPC | callable by anon; params verified end-to-end: `p_campus_id, p_state_id, p_category_ids (uuid[]), p_search, p_condition ('new'|'used'|'refurbished'|'other'), p_min_price, p_max_price, p_in_stock_only, p_sort ('newest'|'price_asc'|'price_desc'), p_limit, p_offset`. Returns catalog-shaped rows **tier-ordered: same campus → same state → everywhere else** (within a tier, ordered by `p_sort`). Confirmed live: `price_asc` ascending, `p_in_stock_only` filters `available_quantity > 0`, search matches product names |
| `categories` | readable; live set is the **old 11-row taxonomy** (8-top restructure in `0004` not yet run) |
| `products` | anon-readable (2 live rows, both test "Classic Trainers") |
| `vendors`, `vendor_locations`, `buyers` | correctly blocked for anon (`42501` / `401` permission denied) |
| `orders`, `payments`, `order_items` | ~~HTTP 200 + empty arrays to anon~~ **RESOLVED 2026-10-26** — owner inspection `0005`: rowsecurity=true on all three, **zero policies**, and full table grants (SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/**TRUNCATE**) to anon+authenticated; hardening migration `0006` prepared (revoke from anon+authenticated, keep service_role) |
| `payouts` | does not exist (`PGRST205`) |
| Auth usage in code | none — zero `signIn/signUp/onAuthStateChange` calls; client has `persistSession: false` |

Row/column caveats: rows may have NULL `campus_id` / `campus_state_id` (cards then show no location line rather than a fabricated one); the `catalog` view's `city`/`state` columns are deliberately IGNORED (STATE → CAMPUS model only).

### Assumed / owner-verified, not re-verifiable from this repo

- The `catalog_search` definition, the `catalog` view definition, the `location_type` CHECK constraint and all RLS policies are **not readable through the REST API** — an owner-run SQL inspection (Part 0) is outstanding.
- "[TEST]" rows (locations, products, offers) are test data presumably created by the owner.

---

## 4. Completed work — verified feature status

Statuses: **Implemented+tested** (code + live verification) / **Implemented** (code + build/lint, not exercised live) / **Pending** (not built).

| Feature | Status | Evidence / notes |
|---|---|---|
| Supabase read-only integration + SetupNotice fallback | Implemented+tested | live catalog rows returned; missing-env path renders setup screen |
| **Product discovery via `catalog_search` RPC** (replaced direct `catalog` view reads) | Implemented+tested | REST probes: filters, sort, paging verified; build+lint green |
| Two-level category chips (top → sub-chips), db-side expanded `IN (top + children)` | Implemented | live round-trip verified with the old taxonomy |
| Strict db-side text search (no client-side filtering) | Implemented+tested | `p_search` matches product names; **category-name matching ("phones") is claimed by the owner but unverifiable with live data — no phone products exist** |
| STATE → CAMPUS pickers (states alphabetical; campuses per state; all campuses optimally grouped via optgroups; "Find your campus" filter box when >10 options; FilterSheet campus panel has the same behaviour) | Implemented | code-verified; full 37-state menu depends on the populated directory [owner-verified] |
| URL param sync + localStorage location persistence (`wemart.location.v1`) | Implemented | ?state/?campus/?cat/?sub/?q/?cond/?min/?max/?stock/?sort |
| Active filter chips + "Clear all" | Implemented | chips row is OUTSIDE the empty section by design |
| Grouped result sections (matching first): "{label} at {campus}" / "Also in {state}" / "{label} in {state}" / "In other places"; plain list with no location; empty-scope skipped; "No {label} at/in {place} yet." notice when the chosen place is empty | Implemented | code-verified; multi-tier ordering **not observable with live data** (all rows on one test campus) |
| Empty results: compact **"No matching products found"** + *"We couldn't find a product matching your current search. Explore other available items below."* — no buttons inside it | Implemented | code-verified; NOT verified in a real browser |
| "New arrivals" strip hidden whenever the current view is empty (fixes unrelated items appearing above the empty message) | Implemented | code-verified |
| **"Recommended Products"** directly below the empty message: ONE `getRecommended` call (location filters + `p_in_stock_only` only; no category/search/condition/price), RPC tier ordering = proximity, `price_asc` = cheapest within each tier, cheapest-first globally with no location; up to 12 cards; genuine listings only; no duplicates possible (strip hidden, grid empty) | Implemented+tested (ordering) | REST probes confirm ascending + in-stock-only; **browser rendering not verified** |
| Truthful end-state (recommendation pool empty → message only, no empty heading) | Implemented | gate: section renders only when `suggestions.length > 0` |
| Loading skeletons; error state with Retry; 300ms search debounce; stale-response cancellation | Implemented | code-verified |
| "Load more" pagination (offset continuation of the ordered list; `{n}+` count while more pages may exist) | Implemented | `count:'exact'` no longer possible over RPC — total is "loaded so far" |
| Category taxonomy restructure (8 top-levels) | **Pending SQL** | `database/0004` written, not run; frontend auto-adapts once the DB changes |
| Responsive design (2-col phone grid, `sm:`/`lg:` breakpoints, sticky header, mobile bottom nav, reduced-motion & focus-visible a11y) | Implemented | code-verified; no browser screenshot verification |
| Price rendering | Implemented | `Intl.NumberFormat('en-NG', NGN, 0 digits)`; naira as-is everywhere |

**Live product data today (limits all UI verification):** 2 test products / ~3 in-stock offers, all "[TEST] Classic Trainers" on one test campus, no state links, plus `[TEST]` location rows. Any multi-campus/multi-state UI behaviour can currently only be verified at the RPC level.

---

## 5. SQL files — status and next actions (`database/`, all REVIEW-RUN-REQUIRED, never auto-applied)

| File | Purpose | Run? | Dependencies / blockers | Next action |
|---|---|---|---|---|
| `0001_product_discovery_review.sql` | Historical review draft: Part A/A2 **read-only inspection queries** (useful), Part B minimum-safe RLS drafts, Part C `product_discovery` view sketch | Never run as a whole; SUPERSEDED — live discovery uses the verified `catalog` view + `catalog_search` | DDL drafts stale vs live schema | Use Part A/A2 only as read-only tools; do not run DDL without re-review |
| `0002_national_location_directory.sql` | Phase 1 seed: 36 states + FCT + ~90 public university campuses (NUC-based, ~30 inline `-- REVIEW` flags), idempotent NOT EXISTS guards, transactional; Part 0 = read-only inspection; Part 2 = verification | Part 0 **DONE** (0a–0d results recorded below); directory shows ~110 campuses [owner-verified] — whether this exact file produced them still unverified | None outstanding for Phase 1 (seed itself may be re-run idempotently to fill gaps) | Owner confirms whether the live directory came from this file; optionally re-run to fill gaps |
| `0003_university_tier_DRAFT.sql` + **`0003_designB_university_tier.sql` (runnable companion)** | Phase 2 DRAFT — **DO NOT RUN without final owner approval**, finalized around **DESIGN B (owner-approved 2026-10-25, review-only)**: 87 `university` rows parented to states (42 federal incl. NAUB/AFIT/NOUN, 45 state-owned), campuses keep `parent_location_id = state`, new nullable `locations.university_location_id` FK column; views/functions untouched by construction; BEGIN/COMMIT-wrapped; FK-safe commented RECOVERY block; verification V1–V10. The draft is the annotated rationale (its VALUES tuples are schematic — no commas); the runnable script is the executable source of truth. **Owner provisional decisions applied 2026-10-26:** AFIT grouping kept; FUT → `Federal University of Technology, Minna (FUTMINNA)`; LAUTECH/NOUN/UNIMED kept; main campuses only; no invented campuses/links. **RECONCILIATION APPLIED 2026-10-27 (not yet executed):** the owner's 0007 combined run (R1=111 live campuses, R2=6 byte-exact, R3=105, R4=83, R5=0, R6=0) proved the live directory uses a different naming convention than the 0007 proposals (`"Base, City (ABBR)"` vs `"Base (ABBR), City"`), so plain name guards would have left 83/89 links as silent no-ops. §3B was re-based on **verified live campus UUIDs** and **owner decisions 1–7 (2026-10-27)**: 84 executed bonds (T1×6 exact · T2×57 format-reordered · T3×16 abbreviation/token variants incl. AE-FUNAI, ADUSTECH, FUTMINNA, IBBUL, UDUS, YUMSUK, BUK · T4×5 manual/identity variants DOU, COOU↔Uli, FUNAAB↔Abeokuta, TASUED→TASFUED (decision 1: FG adoption Mar 2025 verified) and TECH-U→Abiola Ajimobi Technical University (decision 2: Oyo law May/Aug 2024 verified) — the live rows KEEP their names) + §3R **5 links COMMENTED per decisions 3–7** (NOUN DECLINED — never linked to the Lagos row; UNN Enugu Campus, UNILAG CMUL, UNIMED, FUHSO DEFERRED until separate campus rows exist; FUHSO explicitly never linked to FUHSA Azare). Guards on u.name (byte-identical to §2), s.name (live state name) and `c.parent_location_id = s.id` kept; not one live campus name, state or vendor row modified | **Review-ready, awaiting the owner's explicit approval to run** | None outstanding — all 7 owner decisions are encoded; none can execute from this repo | Owner approves running 0003 (paste-approved above) → runs it in the SQL Editor → shares V1–V10 (V3b expected: 26 unlinked campuses incl. the [TEST] row; V3c expected: 3 universities without live campus — NOUN, UNIMED, FUHSO) |
| `0007_designB_name_reconciliation.sql` + **`0007_designB_reconciliation_combined.sql` (one-statement JSON companion)** | READ-ONLY provenance check (owner decision 9): diffs every live campus against the 89 proposed (state, campus) link pairs — R1 inventory, R2 exact matches, R3 campuses that would stay unassociated, R4 proposals with no live campus, R5 name-matched/wrong-state, R6 duplicate names, R7 near-miss hints. The combined companion runs all seven in ONE statement (CTEs + jsonb + `COALESCE` → `[]`), returning a single `reconciliation` JSON cell. Both contain only SELECTs | **EXECUTED BY OWNER 2026-10-26 — results recorded:** R1 = 111 live campuses (1 `[TEST]` row, kept out of production associations); R2 = 6 byte-exact (FUHSA, FUO, NDU, ABU, AFIT, KASU); R3 = 105; R4 = 83; R5 = 0; R6 = 0; R7 = 31 near-miss hints. Structural findings: naming-convention difference (see 0003 row) + state-label mismatch `Abuja (FCT)` (proposals) vs live `Federal Capital Territory` | None outstanding — consumed by the 0003 §3B UUID re-basing | If the owner later wants NEW universities for live campuses that sit outside the 89 proposals (e.g. FUAMB, FUTIA, AKUM, FUTD, AAUU, FUEZ, TASFUED…), that is a fresh decision, not a migration fix |
| `0004_category_taxonomy.sql` | Phase-ready category restructure: idempotent id-preserving renames/re-parents (Footwear→"Shoes & Footwear" under Fashion, Gadgets→"Electronics & Gadgets", Services→"Other", Furniture→"Home & Living" parent, etc.) + NOT EXISTS inserts → **8 top-level rows, max 5 children each; products keep their category_id** | **Not run** — live categories are still the old 11-row set | Standalone (transaction included; Part 0 inspection comments; Part E verification) | Owner reviews and runs manually; frontend needs **no** code change (chips are DB-driven) |
| `0005_rls_inspection.sql` | Read-only inspection: policies + rowsecurity + grants for `orders`/`payments`/`order_items` (optional D/E extend to all tables) | **A/B/C DONE 2026-10-26** (results in item 6 of the Part 0 record) | None | Optionally run D/E before Phase 2 for a full-table audit |
| `0006_rls_sensitive_lockdown.sql` | Phase 1 security hardening — revoke SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/**TRUNCATE** on the three sensitive tables from `anon`+`authenticated`; `service_role` untouched (future order creation / payment verification); BEGIN/COMMIT-wrapped, idempotent REVOKEs; documented future-policy plan (buyer/vendor Phase 2/3, payments server-side-only, default-deny mindset); verification V1–V4 | **EXECUTED + DB-VERIFIED 2026-10-26 (owner-run):** V1 zero web-role grants ✅ · V2 rowsecurity=true on all three ✅ · V3 zero policies ✅ · **V4 browser/REST check NOT yet confirmed by owner — do not mark complete** | None — independent of 0003/0004; ran before any real order data exists | Owner confirms the V4 browser test (site browses identically; anon REST hit on `orders` returns a permission error instead of 200-empty) |

**Part 0 inspection COMPLETED by the owner 2026-10-25.** Results recorded here (full text in the conversation record; also annotated inline in `0003`):

1. **0a — `location_type` CHECK** (`locations_location_type_check`): allows `state, city, campus, warehouse, pickup_point, other`. `university` NOT allowed → the CHECK swap in `0003` §1 must keep all six existing values (draft's original list wrongly dropped three — since fixed). **This is the only confirmed-safe path to the university tier.**
2. **0b1 — `campus_directory`**: campus LEFT JOIN state directly on `campus.parent_location_id` + state type (one-hop). `campus_directory` must be rebuilt to look through a university parent (draft §4, now with LEFT JOIN + type filter — fixed after inspection).
3. **0b2 — `catalog`**: joins `vendor_locations vl → campus (vl.campus_location_id) → state (campus.parent_location_id)`. Re-parenting campuses WOULD corrupt `campus_state_name` and state filters → `catalog` must be rebuilt with a COALESCE-through-university pattern **using the live full definition**. The owner produced a behavioural summary only — the literal `pg_get_viewdef` SQL text is still needed to author the rebuild.
4. **0c — `vendor_locations`**: 14 columns incl. both `location_id` (FK, ON DELETE SET NULL) and `campus_location_id` (FK → locations(id), no cascade). Campus ids never change under re-parenting and nothing is deleted → **vendor links are confirmed safe**; Phase 2 vendor scopes can build on `campus_location_id`.
5. **0d — duplicates**: no rows — clean. `0002`'s NOT EXISTS idempotency is reliable.
6. **RLS inventory (0e) — RESOLVED 2026-10-26** via `0005_rls_inspection.sql`: orders/payments/order_items have **rowsecurity=true, zero policies** (row access already default-denied), but hold **full table-level grants** to anon+authenticated — including TRUNCATE, which **RLS does not protect**. Hardening prepared as `0006_rls_sensitive_lockdown.sql` (revoke ALL from anon+authenticated; service_role untouched) — awaiting owner approval to run.
7. **0005 full-audit parts D/E remain optional** (policies/grants for every table) — useful before Phase 2 but not blocking.

**Inspection 0f COMPLETED 2026-10-25** — the literal definitions of `catalog_search` and `catalog_near_campus` were captured (exact-signature regprocedure lookup fails on argument order; the pg_proc listing fallback is the canonical method). **Key finding: both functions read ONLY the two views** (`catalog` + `campus_directory`) for their state knowledge — no direct `parent_location_id` reads — and the location params are used **only for ORDER BY tiering, never row filtering** (matching the App's "In other places" grouping; `src/data/api.ts` verified). Consequences:
- The functions need **zero changes** if the views keep their contracts (`campus_state_id` and `campus_directory.state_id` must always be the real state).
- `RETURNS SETOF catalog` pins the catalog view's column names/order/types forever — its rebuild is the single riskiest operation in the whole roadmap.
- **Design decision pending owner input:** DESIGN A = true re-parent (draft §3+§4 + a full catalog rebuild written from the literal viewdef — still not supplied); **DESIGN B = RECOMMENDED** — campuses keep `parent_location_id = state`, universities are `location_type='university'` rows linked to campuses via a new nullable `locations.university_location_id uuid REFERENCES locations(id)` column. DESIGN B touches no view and no function — zero impact on discovery. Draft §3/§5 annotated accordingly.

---

## 6. Development roadmap (binding order) and status

**Phase 1 — Audit existing Supabase integration and security** — *audit + hardening COMPLETE 2026-10-26* (env vars, client, readable/blocked tables, RPC verification, deploy config, Part 0 inspection, 0f function definitions, 0005 RLS inventory; **0006 lockdown executed and DB-verified** — V1–V3 green). **Remaining:** owner's V4 browser confirmation of 0006; confirm the seeded directory provenance. *Next milestone:* owner V4 confirmation → Phase 2 may open on approval.

**Phase 2 — Vendor registration + vendor dashboard** — *nothing implemented.* Depends on: Supabase Auth (unused so far; keep the same client), vendor tables/Roles, `vendor_locations` link rules (from Part 0), email verification (Phase 5 provider). Security: only vendor-owned rows via RLS; no service-role keys; never read sensitive tables from the browser. Also decide where the **WhatsApp vendor contact** lives (does not exist today). *Next milestone:* owner decision on WhatsApp contact + Part 0 output → auth schema review → registration flow.

**Phase 3 — Buyer registration + accounts** — *nothing implemented.* Same Supabase Auth project; link identities to the existing `buyers` table (currently anon-locked, RLS policies unknown); no duplicate profiles; browsing stays public without registration; the optional, dismissible account prompt must sit around vendor contact (WhatsApp) — contact itself must never require registration. *Next milestone:* after Phase 2 works.

**Phase 4 — Test the buyer experience** — *not started.* Manual E2E: register/verify/sign-in-out, browse+filters as guest, prompt appears/dismisses to WhatsApp, no cross-account data access, vendor isolation. No automated tests exist; keep build+lint gates and manual checklists.

**Phase 5 — Email workflows** — *nothing set up.* Email verify, welcome, recovery via Supabase Auth; choose a free-tier provider (e.g. Resend) with server-side credentials only (never in `VITE_`/bundle); consent + unsubscribe structure for future marketing. *Next milestone:* owner picks a provider and creates the account.

**Phase 6 — Checkout, orders, Paystack (test mode)** — *not started.* Server-side price/stock validation, totals from trusted data, duplicate-order and stock-safety guards, Paystack **test keys only**, backend/webhook verification before marking paid, handle failed payments/closed stock. Secret keys only behind a server (e.g. Cloudflare Worker/proxy). Confirm provider support for a *marketplace* split/settlement model **before** production. *Next milestone:* only after Phases 2–5 are done and reported (binding phase-gate).

---

## 7. Security considerations (binding)

- Publishable/anon key only; service_role keys never in `src/`, `.env.*` templates, or any `VITE_` var; `dist/` is public.
- Browser access is read-only: `catalog_search` RPC + `campus_directory` + `categories`; **never** query `vendors`, `vendor_locations`, `buyers`, `orders`, `payments` from the browser.
- Never disable RLS; no destructive SQL from the repo; all `database/*.sql` review-first, manually run.
- Payment truth only from server verification (never screenshots/front-end claims); no fake checkout flows.
- SQL migrations are never applied automatically from this repo.
- **0006 EXECUTED 2026-10-26:** the grants revoke is done and DB-verified (V1–V3 passed — owned below); only the V4 browser/REST probe awaits owner confirmation.

---

## 8. Known issues / open items (evidence-backed)

1. ~~RLS/view/constraint definitions unreadable via REST~~ → **resolved** (Part 0 + 0f + `0005`, 2026-10-25/26).
2. ~~orders/payments/order_items return 200-empty to anon~~ → **resolved and fixed 2026-10-26**: root cause was no policies + broad grants; `0006` executed by the owner (V1: zero web-role grants · V2: RLS on · V3: zero policies, all passed). V4 browser/REST probe pending owner confirmation.
3. `0004` category taxonomy not yet run → live chips still the old 11-row taxonomy.
4. ~30 `-- REVIEW` flags in `0002` (uncertain campus facts/renames vs NUC list) — not cross-checked; no NUC gazette access from the coding environment.
5. Live data is tiny (2 test products / ~3 offers, one `[TEST]` campus, NULL campus/state links on some rows) → multi-campus grouping, "Load more" across tiers, and full 110-campus dropdowns are verified at RPC/data level or [owner-verified], not visually.
6. **No WhatsApp contact functionality exists in the frontend** (verified by grep) — the roadmap assumes it; Phase 2+ must resolve.
7. No vendor auth, no buyer auth, no email provider, no Paystack — all pending by design.
8. UI not verified in a real browser (no browser automation this session) — empty-results layout and grouping verified by code review + REST data checks only.
9. RPC returns no exact count → result count shows "{n}+" until the last page loads (intentional, not a bug).
10. `catalog_search` p_search category-name matching ("phones") unverifiable with current data.

---

## 9. Test results (latest verification, this session)

- `npm run build` → **pass** (tsc typecheck + vite bundle).
- `npm run lint` (`oxlint`) → **pass**, zero warnings.
- REST RPC probes (anon key): search+`price_asc`+in-stock → 3 rows ascending ₦17,000/₦24,500/₦25,000; `p_category_ids` array round-trip; offset paging; `p_in_stock_only` excludes sold-out; Food-category query → 0 rows (empty-state scenario), recommendation query for that same view → 3 rows.
- No test framework exists by design; no CI.

---

## 10. Git status (recorded, not modified)

- Branch `main`, **in sync with `origin/main`**; HEAD `5f9d82b` ("Route all product queries through catalog_search; grouped result sections and full location pickers").
- Recent history: `5f9d82b` catalog_search + grouped results + pickers · `3a5db0c` filter sheet, directory seeds, taxonomy SQL · `5a89115` STATE→CAMPUS selects · `3d5c454` Supabase catalog connection.
- **Dirty, uncommitted (COMPLETE, build+lint green):** `AGENTS.md`, `src/App.tsx`, `src/data/api.ts` — the compact empty-results message ("No matching products found" + "Recommended Products" below it), buttons removed from the empty section, `getRecommended` ordering (in-stock + `price_asc` within proximity tiers), and the "New arrivals hidden when view is empty" fix.
- Clean otherwise; no untracked files. `.env.local` is gitignored (never commit). `LF/CRLF` warnings on staging are normal (Windows `core.autocrlf=true`).
- **Preserve for next session:** do NOT reset/stash these files. Either the owner reviews+commits them, or the next session verifies the diffs (`git diff`) against §4 of this document and commits with approval. Repo-local commit identity exists (`user.name`/`user.email` configured).

---

## 11. Immediate next actions (owner)

1. ~~Run the `0002` Part 0 inspection queries~~ → **DONE 2026-10-25/26** (0a–0f + 0005 recorded in this document).
2. ~~Approve + run `0006_rls_sensitive_lockdown.sql`~~ → **DONE 2026-10-26** (owner-run, V1–V3 verified; only the V4 browser/REST probe awaits owner confirmation).
3. Confirm the point-6 university-review items (AFIT, FUT naming, LAUTECH, NOUN scope) + live campus-name provenance → **approve + run `0003_designB_university_tier.sql`**, then share V1–V10 for reconciliation.
4. Review + run `0004` (category taxonomy); verify the 8-top chips appear.
5. Review and commit the pending uncommitted files (empty-results work + the new documentation/SQL files) so `main` is clean before Phase 2.
4. Decide the WhatsApp vendor-contact plan (build where?) and choose the email provider (Phase 5).

---

## 12. Instructions for a fresh OpenCode session

1. Read `AGENTS.md` and `PROTOCOL.md` (binding), then `WEMART_PROJECT_HANDOFF.md` (this file).
2. Check `git status` and `git diff` to confirm the 3 uncommitted files are still present and intact — do not discard, reset or stash anything.
3. Re-verify key claims against the code (api.ts → `catalog_search`, App.tsx → empty-state / recommendations / groups) before editing anything.
4. Preserve all working functionality and the design system (brand tokens in `src/index.css`; no Tailwind config file; no `_redirects`).
5. Hit the same stopping point: gates green, SQL pending owner review — **never** apply SQL, commit, push, or start the next phase without explicit owner approval.
6. Never print or paste the anon/service keys; never disable RLS; never add a test framework or CI unprompted; never load fonts/images from CDNs.

---

## 13. Ready-to-copy starter prompt for the next session

```text
Read AGENTS.md, PROTOCOL.md and WEMART_PROJECT_HANDOFF.md first, then run
git status and git diff to confirm the three uncommitted files
(AGENTS.md, src/App.tsx, src/data/api.ts) are intact. Verify the handoff
claims against the actual code before trusting them (src/data/api.ts for
the catalog_search integration, src/App.tsx for the empty-results and
recommendations behaviour). Preserve all existing working functionality,
the design system, filters, and the Supabase read-only integration.

The project stopping point: build + lint pass; three files uncommitted
awaiting review; replace/view the catalog_search RPC work is done; the
outstanding database work is the owner-run inspection (0002 Part 0 in
database/0002_national_location_directory.sql) plus the review-run of
database/0004_category_taxonomy.sql; the development roadmap is
Phases 2-6 (vendor auth, buyer auth, buyer testing, email, Paystack test
mode) which must NOT start without my approval.

Your first tasks in order:
1. Surface the exact Part 0 inspection queries I need to run in the
   Supabase SQL editor and explain what each output unblocks.
2. Help me review and commit the uncommitted empty-results work.
3. Prepare (but do not run) the anon-SELECT lockdown review for the
   orders/payments/order_items tables.

Rules for this session: do not expose any keys (publishable anon key
only, never service_role), never disable RLS, never apply or auto-run
SQL migrations, never create public/_redirects, never add a test
framework or CI, and never commit or push anything without my explicit
approval. Run npm run build && npm run lint after any change and report
honestly what is verified versus assumed.
```
