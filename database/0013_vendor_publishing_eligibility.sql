-- ============================================================================
-- Wemart — 0013 VENDOR PUBLISHING ELIGIBILITY (server-side gate)
-- database/0013_vendor_publishing_eligibility.sql
--
-- *** OWNER-EXECUTED — run by hand, once, in the SQL Editor (as postgres) ***

-- OWNER-DECIDED PUBLISHING POLICY (2026-10-27 — the launch decision):
--   * NO manual account approval at launch. A vendor who has CONFIRMED
--     THEIR EMAIL may create and publish items immediately.
--   * Suspended / closed vendor accounts can never publish.
--   * No KYC at launch: no ID uploads, no KYC forms, no KYC APIs. KYC comes
--     later, so eligibility lives in ONE staging function
--     (wemart_vendor_can_publish) that the owner extends later — the
--     policies below never need touching when KYC/verification arrives.
--   * vendors.account_status stays 'pending' for new sign-ups (0008
--     trigger unchanged). 'pending' is now purely a lifecycle label — it
--     does NOT block publishing. Only 'suspended'/'closed' do.

-- DESIGN (why this satisfies server-side enforcement):
--   * RLS is the enforcement, not the frontend. The two products policies
--     below keep the 0008 ownership scoping byte-for-byte and ADD one
--     condition: any write whose NEW row has listing_status='active' also
--     requires wemart_vendor_can_publish() = true. draft/paused/sold_out/
--     removed transitions stay open to the owning vendor.
--   * Email confirmation cannot be faked by the client: the helper is
--     SECURITY DEFINER (owner exoneration, same pattern as 0008's signup
--     trigger) and reads auth.users.email_confirmed_at directly, immune to
--     whatever anon/authenticated ACLs exist on auth schema tables.
--   * Suspension/closure cannot be self-edited by ANY user (0008 column
--     ACLs: vendors.account_status is ungranted — only the owner changes
--     it), and the helper re-checks it at every publish attempt.
--   * AUTH_RESULTS: an ineligible 'active' write fails with 42501
--     (row-level-security 42501-error) — the dashboards render an honest
--     explanation; nothing silently reverts.
--   * Edge behaviour, documented: WITH CHECK sees only the NEW row, so a
--     hypothetical vendor who is already 'active' but unconfirmed can
--     still pause/withdraw (any target other than 'active'), edit other
--     fields of a paused row, and republish only after confirming.
--     This is the safe direction: unconfirmed vendors lose only
--     (re-)publishing, never the ability to unpublish.

-- UNCHANGED BY CONSTRUCTION:
--   * catalog / campus_directory / catalog_search and all browsing
--   * the four public SELECT policies + anon SELECT on the four tables
--   * 0006 orders/payments/order_items lockdown (zero references here)
--   * the 2 legacy NULL-auth vendor rows and all existing products
--   * 0008's other 16 policies (only the two products-*own policies are
--     dropped and re-created with the extra condition)

-- EXECUTION ORDER: 0008 (done) → 0012 (TRIGGER hygiene, if not yet run)
--                  → 0013 (this file)

-- First, the preflight: refuse cleanly if the 0008 baseline is missing.
DO $preflight$
DECLARE
  req CONSTANT text[] := ARRAY[
    'products.vendor_id', 'products.listing_status', 'vendors.account_status'
  ];
  kv text;
BEGIN
  FOREACH kv IN ARRAY req LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = split_part(kv, '.', 1)
        AND column_name = split_part(kv, '.', 2)
    ) THEN
      RAISE EXCEPTION '0013 preflight: missing confirmed column "%"', kv;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products'
      AND policyname = 'products_update_own'
  ) THEN
    RAISE EXCEPTION '0013 preflight: 0008 products_update_own policy not found — run 0008 first';
  END IF;
END
$preflight$;

BEGIN;

-- ---------------------------------------------------------------------------
-- PART 1. THE ONE ELIGIBILITY FUNCTION — the future KYC/verification hook.
-- Extend THIS function later (e.g. AND EXISTS (... vendors where verified_at
-- is not null ...) or a wemart_verification_status CHECK); the policies
-- themselves stay untouched when that day comes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wemart_vendor_can_publish()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    -- (a) the caller's auth email is confirmed (unfaked server-side)
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
    )
    -- (b) the caller owns a vendor profile that is not suspended/closed
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
        AND v.account_status NOT IN ('suspended', 'closed')
    );
$fn$;

-- EXECUTE hygiene: the default is EXECUTE-to-PUBLIC. The policy evaluates
-- the function in the caller's authenticated context, so ONLY authenticated
-- needs EXECUTE. The function is a pure read-only boolean (no data leaves
-- it), but a tight grant still closes the (harmless) anon call path and
-- documents exactly who may invoke it. Ownership is correct by construction:
-- the owner-editor session creates it AS postgres (the same owner as the
-- five tables), and SECURITY DEFINER therefore runs as the tables' owner —
-- reading auth.users.email_confirmed_at (postgres is superuser) and the
-- caller's vendors row with the account_status re-check. Every relation in
-- the body is SCHEMA-QUALIFIED, so fixed search_path = public leaves no
-- substitution surface.
REVOKE EXECUTE ON FUNCTION public.wemart_vendor_can_publish() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wemart_vendor_can_publish() FROM anon;
GRANT EXECUTE ON FUNCTION public.wemart_vendor_can_publish() TO authenticated;

-- ---------------------------------------------------------------------------
-- PART 2. RE-CREATE the two products write policies with the gate.
-- Ownership scoping is IDENTICAL to 0008; only the publishing condition is
-- added (listing_status other than 'active' → ownership alone suffices).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS products_insert_own ON public.products;
CREATE POLICY products_insert_own ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT v.id FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
    )
    AND (
      listing_status IS DISTINCT FROM 'active'
      OR public.wemart_vendor_can_publish()
    )
  );

DROP POLICY IF EXISTS products_update_own ON public.products;
CREATE POLICY products_update_own ON public.products
  FOR UPDATE TO authenticated
  USING (
    vendor_id IN (
      SELECT v.id FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    vendor_id IN (
      SELECT v.id FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
    )
    AND (
      listing_status IS DISTINCT FROM 'active'
      OR public.wemart_vendor_can_publish()
    )
  );

COMMIT;

-- ============================================================================
-- VERIFICATION — ONE read-only statement, run AFTER COMMIT (own session).
-- Expected:
--   W1 function: exists, SECURITY DEFINER true, search_path public.
--   W2 the two re-created policies still exist as {authenticated} UPDATE/
--      INSERT policies and their with_check text contains BOTH the
--      ownership join AND the eligibility call (ownership untouched).
--   W3 EXECUTE grants restricted: authenticated true, anon FALSE, PUBLIC
--      excluded entirely (the revoke segments above); ownership of the
--      function must read postgres (proowner = postgres's oid) — the W1
--      definition dump lets you confirm both in one paste.
--   W4 informational: vendor rows by account_status (suspended/closed
--      counts are what the probes W6b depend on; may be 0 yet — probe W6b
--      then just verifies 42501-after-suspend via manual approval when you
--      next suspend a [TEST] vendor).
--   W5 the other 16 0008 policies are untouched (count still 18 own rows).
-- Every query is SELECT/WITH-only; paste the whole JSON back for review.
-- ============================================================================
WITH
w1 AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'function', proname,
    'security_definer', prosecdef,
    'config', proconfig,
    'volatile', provolatile,
    'definition', pg_get_functiondef(oid))), '[]'::jsonb) AS j
  FROM pg_proc
  WHERE proname = 'wemart_vendor_can_publish'
    AND pronamespace = 'public'::regnamespace
),
w2 AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table', tablename, 'policy', policyname, 'command', cmd,
    'roles', roles, 'with_check', with_check)), '[]'::jsonb) AS j
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'products'
    AND policyname IN ('products_insert_own', 'products_update_own')
    AND with_check LIKE '%wemart_vendor_can_publish%'
),
w3 AS (
  SELECT jsonb_build_object(
    'authenticated_execute_expected_true', has_function_privilege('authenticated',
      'public.wemart_vendor_can_publish()', 'EXECUTE'),
    'anon_execute_expected_false',
      has_function_privilege('anon', 'public.wemart_vendor_can_publish()', 'EXECUTE'),
    'owner_expected_postgres', (SELECT pg_get_userbyid(proowner) FROM pg_proc
      WHERE proname = 'wemart_vendor_can_publish'
        AND pronamespace = 'public'::regnamespace LIMIT 1)
  ) AS j
),
w4 AS (
  SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb) AS j
  FROM (SELECT coalesce(account_status, '(null)') AS status, count(*) AS n
        FROM public.vendors GROUP BY 1) s
),
w5 AS (
  SELECT count(*) AS own_policy_count,
         count(*) FILTER (WHERE cmd IN ('INSERT','UPDATE')) AS write_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('vendors','buyers','products','product_variants','vendor_locations')
    AND policyname LIKE '%_own'
)
SELECT jsonb_build_object(
  'W1_eligibility_function', (SELECT j FROM w1),
  'W2_gated_policies',       (SELECT j FROM w2),
  'W3_execute_grants',       (SELECT j FROM w3),
  'W4_vendors_by_status',    (SELECT j FROM w4),
  'W5_policy_count_18_expected', (SELECT j FROM w5),
  -- Browser probes (manual, W6):
  --   W6a UNCONFIRMED-email vendor [TEST]: draft→active MUST fail 42501;
  --       draft→paused and draft-shell creation MUST succeed.
  --   W6b suspended/closed vendor: same published expectation (42501).
  --   W6c CONFIRMED vendor: draft→active MUST succeed; the item then shows
  --       in the public catalog like the 2 legacy active products.
  --   W6d cross-vendor probe: PATCH another vendor's product row → 42501
  --       (ownership WITH CHECK unchanged).
  --   W6e anon browsing regression: same offers/counts (no new/draft rows).
  --   W6f 0006 regression: orders/payments/order_items still denied.
  'W6_browser_checklist_note', 'manual — see comments above'
) AS verification;
