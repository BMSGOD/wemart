-- ============================================================================
-- Wemart — 0006 SECURITY HARDENING: lock down order/payment tables
-- database/0006_rls_sensitive_lockdown.sql
--
-- *** OWNER-EXECUTED MIGRATION — DO NOT RUN WITHOUT FINAL EXPLICIT
-- *** APPROVAL. Nothing in this repo executes SQL. Run by hand in the
-- *** Supabase SQL Editor after review.
--
-- CONFIRMED FACTS (owner-run inspection 0005, 2026-10-26):
--   * orders / payments / order_items have rowsecurity = true.
--   * NONE of the three has any RLS policy (pg_policies: 0 rows).
--     → row-level access is already denied to anon/authenticated.
--   * BUT both anon and authenticated hold SELECT, INSERT, UPDATE,
--     DELETE, REFERENCES, TRIGGER, TRUNCATE on all three tables.
--     TRUNCATE is the dangerous one: it is a TABLE-level operation and
--     RLS does NOT apply to it. (PostgREST does not expose TRUNCATE over
--     HTTP today, but any future RPC/edge function running with the anon
--     or authenticated role would inherit the grant. Defense-in-depth:
--     remove what no web role should have.)
--
-- THIS MIGRATION:
--   * Revokes ALL privileges on the three tables from anon and
--     authenticated. Effect on the live API: the previously "allowed but
--     empty" reads become a proper permission error (HTTP 4xx, like
--     buyers/vendors already do) — strictly better; and since no policy
--     ever granted rows, NO working feature changes.
--   * Leaves service_role untouched (trusted backend keeps full access
--     for future order creation / payment verification).
--   * Leaves the postgres owner and all grants on every other object
--     (products, catalog, views, RPC) untouched → public product
--     browsing is unaffected BY CONSTRUCTION; browsers never query these
--     three tables from src/ (AGENTS.md data rules).
--   * Idempotent: REVOKE with no matching grant is a no-op, no error.
--   * WRAPPED IN ONE TRANSACTION: any mid-run error rolls everything back.
--
-- RLS POLICIES FOR THE FUTURE (documented here; DO NOT create now —
-- they belong to their own phases with real auth in place):
--   * Phase 3 buyer accounts: buyers get `authenticated` roles linked to
--     the buyers table.
--       orders:   SELECT via `customer_id = auth.uid()`-style predicate;
--                 INSERT (own basket checkout, status 'pending' only);
--                 UPDATE own order while unpaid;
--                 no DELETE (cancellation is a status update).
--       order_items: SELECT via the parent order predicate (deny rows
--                 whose order isn't the buyer's);
--       payments: NO buyer policy initially — payment rows are created
--                 and verified server-side (service_role / edge
--                 functions); buyers view their own payment state later
--                 through a dedicated, least-column view.
--   * Phase 2 vendor dashboard: vendor sees orders/order_items that
--     contain at least one of their products (join via vendor_locations →
--     catalog path; scope limited to the vendor's own vendor_id).
--   * NEVER create policies PERMISSIVE for 'anon' on these tables.
--   * Every future policy starts with `USING (false)` and is opened
--     deliberately per-operation (default-deny mindset).
-- ============================================================================

BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.orders
  FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.payments
  FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.order_items
  FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION (read-only; run after COMMIT and share ALL output)
-- ============================================================================
-- V1 — grants on the three tables (expect 0 rows for anon/authenticated;
--      any remaining row naming service_role or postgres is EXPECTED and
--      correct)
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'payments', 'order_items')
ORDER BY table_name, grantee;

-- V2 — RLS stays ON (expect all three true — untouched by this migration)
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'payments', 'order_items')
ORDER BY tablename;

-- V3 — policies still absent (expect 0 rows; the future policies above
--      are the ones that will eventually appear here)
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'payments', 'order_items');

-- V4 — public browsing unaffected:
--   * browser: reload the site → same offers, same counts (or REST:
--     the verified catalog_search smoke call returns the same rows);
--   * REST probe (anon key): GET /rest/v1/orders now returns a
--     permission error (42501) instead of 200-empty — the desired,
--     stricter surface;
--   * buyers/vendors/vendor_locations probes keep behaving as before.
