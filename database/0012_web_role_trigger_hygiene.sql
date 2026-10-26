-- ============================================================================
-- Wemart — 0012 WEB-ROLE TRIGGER-PRIVILEGE HYGIENE (post-0008 patch)
-- database/0012_web_role_trigger_hygiene.sql
--
-- *** OWNER-EXECUTED — run by hand, once, in the SQL Editor. ***

-- RECONCILIATION CONTEXT (2026-10-27, after the owner ran 0008):
--   0008 Part 8 revoked INSERT/UPDATE/DELETE/REFERENCES/TRUNCATE from anon
--   and INSERT/UPDATE/DELETE/REFERENCES/TRUNCATE from authenticated — but
--   the TRIGGER table privilege was NOT in either list, so the pre-existing
--   broad grants (0010 finding) still leave TRIGGER on all five tables for
--   both web roles. 0008's own verification JSON shows these leftover rows.
--
-- IMPACT (honest assessment):
--   * TRIGGER does NOT bypass RLS and does not read or change data by
--     itself. It authorizes CREATE TRIGGER on the table; exploiting it
--     further needs a suitable SECURITY DEFINER function writable by the
--     role, which none of the five tables have (0008's trigger function is
--     postgres-owned; creation attempts by anon/authenticated otherwise
--     fail on function-execution and trigger-arity grounds).
--   * It is nonetheless OUTSIDE the hardened guarantee ("web roles keep
--     nothing to write or administer, anon only SELECT"), so it is revoked.
--
-- WHAT THIS PATCH DOES (minimal, idempotent, single transaction):
--   1. REVOKE TRIGGER on the five 0008 tables from anon + authenticated.
--   2. Defensively revoke anon/authenticated PUBLIC write + TRIGGER grants
--      on the same five tables (0010 never dumped the PUBLIC grantee; if
--      PUBLIC holds nothing this is a no-op). SELECT is NOT touched for any
--      role — the four public SELECT policies keep serving catalog browsing.
--   3. Read-only verification tail (V1–V5) pasted back as JSON.
--
-- PRESERVED (unchanged by construction):
--   * public catalog browsing (4 public SELECT policies + anon SELECT grant)
--   * vendor/buyer signup + email verification (0008 trigger untouched)
--   * owner-only profile access (18 own-row policies + column ACLs)
--   * existing vendors/products data and the 2 legacy NULL-auth vendors
--   * orders/payments/order_items lockdown (0006) — not referenced here
-- ============================================================================

BEGIN;

-- 1. TRIGGER off both web roles on the five policy-covered tables
REVOKE TRIGGER ON TABLE
  public.vendors, public.buyers, public.products,
  public.product_variants, public.vendor_locations
FROM anon;

REVOKE TRIGGER ON TABLE
  public.vendors, public.buyers, public.products,
  public.product_variants, public.vendor_locations
FROM authenticated;

-- 2. Defensive PUBLIC sweep — writes + TRIGGER only, never SELECT
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.vendors, public.buyers, public.products,
  public.product_variants, public.vendor_locations
FROM PUBLIC;

COMMIT;

-- ============================================================================
-- VERIFICATION — ONE read-only statement, own editor session, after COMMIT.
-- Expected:
--   V1 remaining table grants: anon → SELECT on EXACTLY the four
--      policy-covered tables (vendors, vendor_locations, products,
--      product_variants; NOT buyers) + authenticated → SELECT ×5,
--      INSERT ×3 (content tables), UPDATE ×3, DELETE ×3 — NOTHING else
--      (no TRIGGER, no TRUNCATE for either role; and NO 'public'-grantee
--      rows at all for these five tables).
--   V2 TRIGGER must be false for anon + authenticated on every table
--      (2 roles × 5 tables = 10 rows). PUBLIC is a PostgreSQL privilege
--      group/LABEL, not a login role, so it is NOT passed into
--      has_table_privilege(); PUBLIC coverage comes from V1 instead,
--      where grantee is a plain TEXT grantee value in
--      information_schema.table_privileges (as 'public') — V1 must show
--      ZERO public grantee rows for these five tables.
--   V3 column ACLs unchanged (the 0008 hardening): vendors UPDATE only
--      business_name+display_name; buyers UPDATE only display_name+
--      whatsapp_number+default_location_id+default_campus_id; insert columns
--      as granted; account_status/auth_user_id/id negatives all true.
--   V4 policies: 18 own-row (authenticated) + 4 public SELECT preserved.
--   V5 RLS flags: enabled ×5, forced=false ×5.
-- ============================================================================
WITH
v1 AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'grantee', grantee, 'table', table_name, 'privilege', privilege_type)),
           '[]'::jsonb) AS j
  FROM information_schema.table_privileges
  WHERE table_schema = 'public'
    AND table_name IN ('vendors','buyers','products','product_variants','vendor_locations')
    AND grantee IN ('anon','authenticated','public')
),
v2 AS (
  -- has_table_privilege resolves ROLE names only: anon + authenticated.
  -- PUBLIC (a privilege group, not a login role) is deliberately excluded
  -- here — its coverage lives in V1's table_privileges listing.
  SELECT jsonb_agg(jsonb_build_object(
           'role', r.role, 'table', tv.tname,
           'trigger', has_table_privilege(r.role, tv.qualified, 'TRIGGER'))
         ORDER BY r.role, tv.tname) AS j
  FROM unnest(ARRAY['anon','authenticated']) AS r(role),
       (VALUES ('vendors','public.vendors'),('buyers','public.buyers'),
               ('products','public.products'),
               ('product_variants','public.product_variants'),
               ('vendor_locations','public.vendor_locations')) AS tv(tname,qualified)
  -- Cross guard: if PUBLIC somehow holds a TRIGGER privilege it shows up
  -- in V1 anyway (table_privileges grants are plain text values).
),
v3 AS (
  SELECT jsonb_build_object(
    'vendors_update_columns',
      (SELECT coalesce(jsonb_agg(DISTINCT column_name ORDER BY column_name), '[]'::jsonb)
       FROM information_schema.column_privileges
       WHERE grantee = 'authenticated' AND table_schema = 'public'
         AND table_name = 'vendors' AND privilege_type = 'UPDATE'),
    'buyers_update_columns',
      (SELECT coalesce(jsonb_agg(DISTINCT column_name ORDER BY column_name), '[]'::jsonb)
       FROM information_schema.column_privileges
       WHERE grantee = 'authenticated' AND table_schema = 'public'
         AND table_name = 'buyers' AND privilege_type = 'UPDATE'),
    'vendors_insert_columns_expect_auth_user_id_business_name_display_name',
      (SELECT coalesce(jsonb_agg(DISTINCT column_name ORDER BY column_name), '[]'::jsonb)
       FROM information_schema.column_privileges
       WHERE grantee = 'authenticated' AND table_schema = 'public'
         AND table_name = 'vendors' AND privilege_type = 'INSERT'),
    'buyers_insert_columns_expect_auth_user_id_display_name',
      (SELECT coalesce(jsonb_agg(DISTINCT column_name ORDER BY column_name), '[]'::jsonb)
       FROM information_schema.column_privileges
       WHERE grantee = 'authenticated' AND table_schema = 'public'
         AND table_name = 'buyers' AND privilege_type = 'INSERT'),
    'denied_must_all_be_true',
      (SELECT jsonb_build_object(
         'vendors_update_account_status',
           NOT has_column_privilege('authenticated', 'public.vendors', 'account_status', 'UPDATE'),
         'vendors_update_auth_user_id',
           NOT has_column_privilege('authenticated', 'public.vendors', 'auth_user_id', 'UPDATE'),
         'vendors_update_id',
           NOT has_column_privilege('authenticated', 'public.vendors', 'id', 'UPDATE'),
         'vendors_insert_account_status',
           NOT has_column_privilege('authenticated', 'public.vendors', 'account_status', 'INSERT'),
         'buyers_update_auth_user_id',
           NOT has_column_privilege('authenticated', 'public.buyers', 'auth_user_id', 'UPDATE'),
         'buyers_update_id',
           NOT has_column_privilege('authenticated', 'public.buyers', 'id', 'UPDATE')))
) AS j
),
v4 AS (
  SELECT
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'table', tablename, 'policy', policyname, 'command', cmd, 'roles', roles
       ) ORDER BY tablename, policyname), '[]'::jsonb)
     FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('vendors','buyers','products','product_variants','vendor_locations')
    ) AS j_all,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'table', tablename, 'policy', policyname, 'roles', roles)), '[]'::jsonb)
     FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('vendors','buyers','products','product_variants','vendor_locations')
       AND policyname NOT LIKE '%_own'
    ) AS j_public
),
v5 AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'table', c.relname, 'rls_enabled', c.relrowsecurity,
           'rls_forced', c.relforcerowsecurity)), '[]'::jsonb) AS j
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('vendors','buyers','products','product_variants','vendor_locations')
)
SELECT jsonb_build_object(
  'V1_remaining_table_grants', (SELECT j FROM v1),
  'V2_trigger_privilege_must_all_be_false', (SELECT j FROM v2),
  'V3_column_acls', (SELECT j FROM v3),
  'V4_policies', jsonb_build_object('all', (SELECT j_all FROM v4),
                                    'public_select_unexpected_count', (SELECT j_public FROM v4)),
  'V5_rls_flags', (SELECT j FROM v5),
  -- Manual browser probes (V6, like 0008's V8):
  --   anon catalog browsing identical (same offers/counts/grouping);
  --   signup still creates the linked profile row; signed-in vendor sees
  --   only own rows; account_status PATCH still 42501.
  'V6_browser_checklist_note', 'manual — see comments above'
) AS verification;
