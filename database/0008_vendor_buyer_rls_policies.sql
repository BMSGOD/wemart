-- ============================================================================
-- Wemart — 0008 VENDOR/BUYER RLS POLICIES + PROFILE LINKAGE
-- database/0008_vendor_buyer_rls_policies.sql
--
-- *** OWNER-EXECUTED — review, then run by hand, once, in the SQL Editor. ***
--
-- REBASED 2026-10-27 on the owner's VERIFIED live schema results (0009 run).
-- CONFIRMED FACTS this file is built on (and nothing beyond them):
--   public.vendors            : id UUID pk, auth_user_id UUID NULL,
--                               business_name TEXT NOT NULL,
--                               display_name TEXT NULL,
--                               account_status TEXT NOT NULL default 'pending'
--   public.buyers             : id UUID pk, auth_user_id UUID NULL,
--                               display_name TEXT NULL, whatsapp_number TEXT NULL,
--                               default_location_id UUID NULL,
--                               default_campus_id UUID NULL
--   public.products           : id UUID, vendor_id UUID required,
--                               listing_status TEXT default 'draft'
--   public.product_variants   : id UUID, product_id UUID required,
--                               is_active BOOLEAN default true
--   public.vendor_locations   : id UUID, vendor_id UUID required,
--                               campus_location_id UUID NULL
--
-- EXPLICITLY NOT CONFIRMED (therefore NOT assumed, NOT invented):
--   * whether any FK to auth.users id / UNIQUE constraint / CHECK exists
--     behind those columns — matching NAMES do not prove OBJECTS (owner
--     directive). The security model below therefore carries its own
--     enforcement: policy USING/WITH CHECK on auth_user_id = auth.uid(),
--     an anti-duplicate subcheck per INSERT policy, and the PART 7 partial
--     unique indexes (flagged owner-decision) that make "no user can claim
--     or double-hold a profile" a database-level guarantee rather than a
--     UI convention.
--   * products columns beyond id/vendor_id/listing_status (price, name,
--     condition, quantity, image_path...) live behind the verified catalog
--     view but their base-table names are unknown ⇒ NO stock/quantity
--     write policies or columns are touched; inventory *writing* is out
--     of scope pending 0009 Part E detail (catalog ownership stays
--     byte-for-byte unchanged).
--   * existing FKs between product_variants/products, products/vendors,
--     vendor_locations/vendors are NOT confirmed — policies derive
--     ownership through JOINs on the confirmed columns only.
--
-- Guarantees:
--   * anon gets NOTHING on these tables (anon grants revoked outright)
--   * authenticated users reach ONLY their own rows, by uid equality
--   * no user can UPDATE/INSERT their way onto another person's profile
--     (WITH CHECK re-asserts auth_user_id = auth.uid() on every write)
--   * orders / payments / order_items untouched (0006 lockdown preserved)
--   * catalog / campus_directory / catalog_search / catalog_near_campus
--     untouched by construction — buyer browsing unchanged
--   * registration trigger is guarded (IF EXISTS) and preserves any
--     pre-existing row — never overwrites, never re-links existing
--     vendors/buyers (existing NULL-auth_user_id rows are linked by the
--     owner manually, see V7 backfill worklist)
--   * idempotent: DROP POLICY IF EXISTS / IF NOT EXISTS indexes /
--     CREATE OR REPLACE FUNCTION; single transaction, failure = full
--     rollback (the earlier preflight abort proved the containment)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- PART 0. PREFLIGHT — refuse to run unless every confirmed column is present.
-- (Facts, still guarded: if the live schema drifts, this aborts cleanly.)
-- ---------------------------------------------------------------------------
DO $preflight$
DECLARE
  req CONSTANT text[] := ARRAY[
    'vendors.auth_user_id', 'vendors.business_name', 'vendors.account_status',
    'buyers.auth_user_id',
    'products.vendor_id', 'products.listing_status',
    'product_variants.product_id', 'product_variants.is_active',
    'vendor_locations.vendor_id', 'vendor_locations.campus_location_id'
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
      RAISE EXCEPTION '0008 preflight: missing confirmed column "%"', kv;
    END IF;
  END LOOP;
END
$preflight$;

-- ---------------------------------------------------------------------------
-- PART 1. VENDORS — own row only (auth_user_id = auth.uid())
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS vendors_select_own ON public.vendors;
CREATE POLICY vendors_select_own ON public.vendors
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- INSERT: the caller may create ONE row linked to their own uid.
-- The NOT EXISTS subcheck (against caller-visible rows under the SELECT
-- policy above) blocks re-registration duplicates at policy level; PART 7
-- additionally makes uniqueness a database-level guarantee.
DROP POLICY IF EXISTS vendors_insert_own ON public.vendors;
CREATE POLICY vendors_insert_own ON public.vendors
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
    )
  );

-- UPDATE: only own rows, and the row cannot be re-pointed at another uid
-- (WITH CHECK re-asserts the binding) — no profile claiming, ever.
DROP POLICY IF EXISTS vendors_update_own ON public.vendors;
CREATE POLICY vendors_update_own ON public.vendors
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- No DELETE policy: vendor rows are history, not disposable content.
-- No anon policy: anonymous visitors keep zero access (default-deny).

-- ---------------------------------------------------------------------------
-- PART 2. PRODUCTS — vendor CRUD scoped through the caller's own vendor row.
-- (catalog view keeps serving PUBLIC display; these govern direct-table access.)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS products_select_own ON public.products;
CREATE POLICY products_select_own ON public.products
  FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT v.id FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS products_insert_own ON public.products;
CREATE POLICY products_insert_own ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT v.id FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
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
  );

DROP POLICY IF EXISTS products_delete_own ON public.products;
CREATE POLICY products_delete_own ON public.products
  FOR DELETE TO authenticated
  USING (
    vendor_id IN (
      SELECT v.id FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- PART 3. BUYERS — own row only, same claiming protection as vendors
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS buyers_select_own ON public.buyers;
CREATE POLICY buyers_select_own ON public.buyers
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS buyers_insert_own ON public.buyers;
CREATE POLICY buyers_insert_own ON public.buyers
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.buyers b
      WHERE b.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS buyers_update_own ON public.buyers;
CREATE POLICY buyers_update_own ON public.buyers
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- PART 4. PRODUCT VARIANTS — ownership derived through the parent product
-- (product_id → products.vendor_id → caller's vendor row; confirmed cols only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS product_variants_select_own ON public.product_variants;
CREATE POLICY product_variants_select_own ON public.product_variants
  FOR SELECT TO authenticated
  USING (
    product_id IN (
      SELECT p.id FROM public.products p
      WHERE p.vendor_id IN (
        SELECT v.id FROM public.vendors v
        WHERE v.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS product_variants_insert_own ON public.product_variants;
CREATE POLICY product_variants_insert_own ON public.product_variants
  FOR INSERT TO authenticated
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM public.products p
      WHERE p.vendor_id IN (
        SELECT v.id FROM public.vendors v
        WHERE v.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS product_variants_update_own ON public.product_variants;
CREATE POLICY product_variants_update_own ON public.product_variants
  FOR UPDATE TO authenticated
  USING (
    product_id IN (
      SELECT p.id FROM public.products p
      WHERE p.vendor_id IN (
        SELECT v.id FROM public.vendors v
        WHERE v.auth_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    product_id IN (
      SELECT p.id FROM public.products p
      WHERE p.vendor_id IN (
        SELECT v.id FROM public.vendors v
        WHERE v.auth_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS product_variants_delete_own ON public.product_variants;
CREATE POLICY product_variants_delete_own ON public.product_variants
  FOR DELETE TO authenticated
  USING (
    product_id IN (
      SELECT p.id FROM public.products p
      WHERE p.vendor_id IN (
        SELECT v.id FROM public.vendors v
        WHERE v.auth_user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- PART 5. VENDOR LOCATIONS — own-row only (confirmed cols: vendor_id,
-- campus_location_id; no location-table writes happen here)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS vendor_locations_select_own ON public.vendor_locations;
CREATE POLICY vendor_locations_select_own ON public.vendor_locations
  FOR SELECT TO authenticated
  USING (
    vendor_id IN (
      SELECT v.id FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vendor_locations_insert_own ON public.vendor_locations;
CREATE POLICY vendor_locations_insert_own ON public.vendor_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    vendor_id IN (
      SELECT v.id FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS vendor_locations_update_own ON public.vendor_locations;
CREATE POLICY vendor_locations_update_own ON public.vendor_locations
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
  );

DROP POLICY IF EXISTS vendor_locations_delete_own ON public.vendor_locations;
CREATE POLICY vendor_locations_delete_own ON public.vendor_locations
  FOR DELETE TO authenticated
  USING (
    vendor_id IN (
      SELECT v.id FROM public.vendors v
      WHERE v.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- PART 6. PROFILE LINKAGE TRIGGER — signup → buyers/vendors row
-- SECURITY DEFINER + fixed search_path; grants nothing by itself.
-- Verified column shape only; guarded (IF EXISTS) so replaying/legacy
-- rows are preserved, never overwritten or re-linked.
-- The frontend (src/lib/auth.tsx) already writes role/full_name/shop_name
-- into user_metadata — this trigger is its sole consumer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_wemart_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_role text;
BEGIN
  v_role := lower(coalesce(NEW.raw_user_meta_data ->> 'role', ''));

  IF v_role = 'buyer' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.buyers b WHERE b.auth_user_id = NEW.id
    ) THEN
      INSERT INTO public.buyers (auth_user_id, display_name)
      VALUES (
        NEW.id,
        NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), '')
      );
    END IF;

  ELSIF v_role = 'vendor' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vendors v WHERE v.auth_user_id = NEW.id
    ) THEN
      INSERT INTO public.vendors (auth_user_id, business_name, display_name, account_status)
      VALUES (
        NEW.id,
        -- business_name is NOT NULL: signup's shop_name, else business_name
        -- metadata, else a safe placeholder the vendor renames in the dashboard
        coalesce(
          NULLIF(trim(NEW.raw_user_meta_data ->> 'shop_name'), ''),
          NULLIF(trim(NEW.raw_user_meta_data ->> 'business_name'), ''),
          'Unnamed store'
        ),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        'pending'
      );
    END IF;
  END IF;

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS on_wemart_auth_user_created ON auth.users;
CREATE TRIGGER on_wemart_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_wemart_user();

-- ---------------------------------------------------------------------------
-- PART 7. UNIQUENESS OF LINKS (OWNER-DECISION — flagged change, not silent):
-- partial unique indexes on the linkage columns. REQUIRED to make "no user
-- can claim or double-hold a profile" a database guarantee: without them the
-- anti-duplication rests on policy subchecks that see only caller-visible
-- rows. NULL rows (existing unlinked vendors/buyers) are untouched by the
-- WHERE guard — every existing record is preserved. If live data already
-- contains two rows sharing one uid, the CREATE fails loudly for review.
-- Strike this part (run the rest) if you want policies without enforcement.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS vendors_auth_user_id_unique_linked
  ON public.vendors (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS buyers_auth_user_id_unique_linked
  ON public.buyers (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- PART 8. WEB-ROLE GRANT HYGIENE (non-permissive; 0005/0006 lessons):
-- * anon loses everything on the five tables (RLS would deny rows anyway,
--   but table-level anon grants are attack surface and buy nothing — the
--   catalog view serves anonymous browsing with its owner's rights).
-- * authenticated keeps its existing grants (RLS scopes the rows) BUT loses
--   TRUNCATE — TRUNCATE is table-level and BYPASSES RLS; 0005 found such
--   grants on the sensitive trio, and the same pattern is presumed possible
--   here until verified otherwise. Revoking is safe + idempotent.
-- * service_role untouched throughout.
-- ---------------------------------------------------------------------------
REVOKE ALL PRIVILEGES ON TABLE
  public.vendors, public.buyers, public.products,
  public.product_variants, public.vendor_locations
FROM anon;

REVOKE TRUNCATE ON TABLE
  public.vendors, public.buyers, public.products,
  public.product_variants, public.vendor_locations
FROM authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION — ONE read-only statement, run AFTER the COMMIT above (own
-- editor session), returns one JSONB with every check's COMPLETE results:
--   V0 required columns present            (expect all 10)
--   V1 policies                            (expect 14, roles={authenticated})
--   V2 trigger on auth.users               (expect 1 active row)
--   V3 function SECURITY DEFINER           (expect true + search_path=public)
--   V4 RLS enabled on all five tables      (expect true ×5)
--   V5 anon grants + TRUNCATE leftovers    (expect [] and [])
--   V6 linkage unique indexes              (expect both, with WHERE guard)
--   V7 backfill worklists: existing vendors/buyers rows whose auth_user_id
--      is NULL (complete lists, no truncation — link these by hand if and
--      when the owner assigns which live row belongs to which email; the
--      policy set never auto-links them)
-- Every query is SELECT/WITH-only; paste the whole JSON back for review.
-- ============================================================================
WITH
v0 AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'table', t.tv, 'column', split_part(t.kv, '.', 2))), '[]'::jsonb) AS j
  FROM unnest(ARRAY[
    'vendors.auth_user_id','vendors.business_name','vendors.account_status',
    'buyers.auth_user_id','products.vendor_id','products.listing_status',
    'product_variants.product_id','product_variants.is_active',
    'vendor_locations.vendor_id','vendor_locations.campus_location_id'
  ]) AS t(kv),
  LATERAL (SELECT split_part(t.kv, '.', 1) AS tv) t2
  WHERE EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name  = split_part(t.kv, '.', 1)
      AND c.column_name = split_part(t.kv, '.', 2)
  )
),
v1 AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'table', tablename, 'policy', policyname,
           'command', cmd, 'roles', roles)), '[]'::jsonb) AS j
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('vendors','buyers','products','product_variants','vendor_locations')
    AND policyname LIKE '%_own'
),
v2 AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'trigger', tgname, 'on_table', tgrelid::regclass::text,
           'enabled', tgenabled)), '[]'::jsonb) AS j
  FROM pg_trigger
  WHERE tgname = 'on_wemart_auth_user_created' AND NOT tgisinternal
),
v3 AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'function', proname, 'security_definer', prosecdef,
           'config', proconfig)), '[]'::jsonb) AS j
  FROM pg_proc
  WHERE proname = 'handle_new_wemart_user'
    AND pronamespace = 'public'::regnamespace
),
v4 AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'table', c.relname, 'rls_enabled', c.relrowsecurity,
           'rls_forced', c.relforcerowsecurity)), '[]'::jsonb) AS j
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('vendors','buyers','products','product_variants','vendor_locations')
),
v5 AS (
  SELECT
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'table', table_name, 'grantee', grantee,
       'privilege', privilege_type)), '[]'::jsonb)
     FROM information_schema.table_privileges
     WHERE table_schema = 'public'
       AND grantee = 'anon'
       AND table_name IN ('vendors','buyers','products','product_variants','vendor_locations')
    ) AS j_anon,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'table', table_name, 'grantee', grantee,
       'privilege', privilege_type)), '[]'::jsonb)
     FROM information_schema.table_privileges
     WHERE table_schema = 'public'
       AND grantee = 'authenticated' AND privilege_type = 'TRUNCATE'
       AND table_name IN ('vendors','buyers','products','product_variants','vendor_locations')
    ) AS j_truncate
),
v6 AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'index', indexname, 'definition', indexdef)), '[]'::jsonb) AS j
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN ('vendors_auth_user_id_unique_linked',
                      'buyers_auth_user_id_unique_linked')
),
v7 AS (
  SELECT
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'vendor_id', v.id, 'business_name', v.business_name,
       'account_status', v.account_status)), '[]'::jsonb)
     FROM public.vendors v
     WHERE v.auth_user_id IS NULL
    ) AS j_unlinked_vendors,
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'buyer_id', b.id, 'display_name', b.display_name)), '[]'::jsonb)
     FROM public.buyers b
     WHERE b.auth_user_id IS NULL
    ) AS j_unlinked_buyers
)
SELECT jsonb_build_object(
  'V0_columns_present',          (SELECT j FROM v0),
  'V1_policies',                 (SELECT j FROM v1),
  'V2_trigger',                  (SELECT j FROM v2),
  'V3_function_flags',           (SELECT j FROM v3),
  'V4_rls_flags',                (SELECT j FROM v4),
  'V5_grants', jsonb_build_object(
      'anon_rows_expected_empty', (SELECT j_anon     FROM v5),
      'truncate_leftovers',       (SELECT j_truncate FROM v5)),
  'V6_unique_indexes',           (SELECT j FROM v6),
  'V7_backfill_worklist', jsonb_build_object(
      'unlinked_vendors', (SELECT j_unlinked_vendors FROM v7),
      'unlinked_buyers',  (SELECT j_unlinked_buyers  FROM v7)),
  -- Browser-check reminders (manual, like 0003's V10):
  --   anon REST probe on vendors/products/buyers → [], never other rows
  --   authenticated self-scope: signed-in [TEST] vendor sees exactly 1 own row
  --   [TEST] signup produces exactly one linked profile row; then clean up
  --   0006 regression: orders/payments/order_items stay permission-denied
  --   catalog browsing unchanged (same offers/counts/grouping)
  'V8_browser_checklist_note', 'manual — see comments above'
) AS verification;

-- V8/V9 (manual):
-- V8 frontend smoke (anon): same offers, counts, grouping, dropdowns, naira.
-- V9 orders/payments/order_items regression: anon + authenticated still
--    permission-denied (0006 lockdown intact — this file never touched them).
