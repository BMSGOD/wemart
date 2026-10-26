-- ============================================================================
-- Wemart — 0010 PRE-EXECUTION CHECKS (READ-ONLY, safe anytime)
-- database/0010_pre_execution_checks.sql
--
-- ONE copy-ready statement for the owner's SQL Editor, run BEFORE (and
-- ideally after) 0008. Closes the remaining unknowns from the verified
-- schema paste WITHOUT inventing anything:
--   V-A  every CHECK constraint on the five auth-phase tables
--        (listing_status / account_status value rules appear here)
--   V-B  every FK between these tables (products→vendors etc. proven, not guessed)
--   V-C  existing triggers on auth.users (0008's linkage trigger presence)
--   V-D  duplicate linkage scan: rows sharing one auth_user_id (expect 0)
--        + unlinked-row counts (backfill worklist sizes)
--   V-E  live DISTINCT values of listing_status / account_status
--        (needed before any publish/unpublish UI — 'draft' only confirmed)
--   V-F  current RLS policies on the five tables (before/after comparison)
-- Every sub-query is SELECT-only; results return as ONE JSONB object.
-- ============================================================================

WITH
va AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'table', t.relname, 'constraint', c.conname,
           'definition', pg_get_constraintdef(c.oid))), '[]'::jsonb) AS j
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND c.contype = 'c'
    AND t.relname IN ('vendors','buyers','products','product_variants','vendor_locations')
),
vb AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'from_table', c.conrelid::regclass::text,
           'constraint', c.conname,
           'to_table',   c.confrelid::regclass::text)), '[]'::jsonb) AS j
  FROM pg_constraint c
  JOIN pg_namespace n ON n.oid = c.conrelnamespace
  WHERE n.nspname = 'public'
    AND c.contype = 'f'
    AND c.conrelid::regclass::text IN ('vendors','buyers','products','product_variants','vendor_locations')
),
vc AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'trigger', tgname, 'on_table', tgrelid::regclass::text,
           'enabled', tgenabled)), '[]'::jsonb) AS j
  FROM pg_trigger
  WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal
),
vd AS (
  SELECT
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
             'auth_user_id', x.auth_user_id, 'vendor_rows', x.cnt)), '[]'::jsonb)
     FROM (
       SELECT v.auth_user_id, count(*) AS cnt
       FROM public.vendors v
       WHERE v.auth_user_id IS NOT NULL
       GROUP BY v.auth_user_id
       HAVING count(*) > 1
     ) x) AS j_duplicate_vendor_links,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
             'auth_user_id', x.auth_user_id, 'buyer_rows', x.cnt)), '[]'::jsonb)
     FROM (
       SELECT b.auth_user_id, count(*) AS cnt
       FROM public.buyers b
       WHERE b.auth_user_id IS NOT NULL
       GROUP BY b.auth_user_id
       HAVING count(*) > 1
     ) x) AS j_duplicate_buyer_links,
    (SELECT count(*) FROM public.vendors  WHERE auth_user_id IS NULL) AS j_unlinked_vendors,
    (SELECT count(*) FROM public.buyers   WHERE auth_user_id IS NULL) AS j_unlinked_buyers
),
ve AS (
  SELECT
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
             'listing_status', p.listing_status, 'count', p.cnt)), '[]'::jsonb)
     FROM (
       SELECT listing_status, count(*) AS cnt
       FROM public.products
       GROUP BY listing_status
     ) p) AS j_listing_status_values,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
             'account_status', v.account_status, 'count', v.cnt)), '[]'::jsonb)
     FROM (
       SELECT account_status, count(*) AS cnt
       FROM public.vendors
       GROUP BY account_status
     ) v) AS j_vendor_account_status_values
),
vf AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'table', tablename, 'policy', policyname,
           'command', cmd, 'roles', roles)), '[]'::jsonb) AS j
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('vendors','buyers','products','product_variants','vendor_locations')
)
SELECT jsonb_build_object(
  'VA_check_constraints',              (SELECT j FROM va),
  'VB_foreign_keys',                   (SELECT j FROM vb),
  'VC_auth_triggers',                  (SELECT j FROM vc),
  'VD_duplicates', jsonb_build_object(
      'duplicate_vendor_links_expect_empty', (SELECT j_duplicate_vendor_links FROM vd),
      'duplicate_buyer_links_expect_empty',  (SELECT j_duplicate_buyer_links  FROM vd),
      'unlinked_vendors', (SELECT j_unlinked_vendors FROM vd),
      'unlinked_buyers',  (SELECT j_unlinked_buyers  FROM vd)),
  'VE_live_values', jsonb_build_object(
      'listing_status',    (SELECT j_listing_status_values       FROM ve),
      'account_status',    (SELECT j_vendor_account_status_values FROM ve)),
  'VF_current_policies',              (SELECT j FROM vf)
) AS pre_execution_checks_0010;
