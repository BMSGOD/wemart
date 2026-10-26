-- ============================================================================
-- Wemart — 0008 VENDOR/BUYER RLS POLICIES + PROFILE LINKAGE
-- database/0008_vendor_buyer_rls_policies.sql
--
-- *** EXECUTED BY THE OWNER 2026-10-27 — V0–V8 VERIFICATION RECONCILED. ***
-- Post-run findings: preflight + V0–V8 passed (18 policies, trigger live,
-- RLS non-forced ×5, column ACLs proven, 2 legacy NULL vendors preserved).
-- ONE leftover from the Part 8 revocation lists: the TRIGGER table
-- privilege was not revoked from anon/authenticated (no RLS bypass —
-- hygiene) → revoked in database/0012_web_role_trigger_hygiene.sql
-- (awaiting owner run). Post-run, the V5 anon list legitimately keeps:
-- SELECT on the four policy-covered tables (browsing) and TRIGGER until
-- 0012 runs.
-- *** OWNER-EXECUTED — review, then run by hand, once, in the SQL Editor. ***
--
-- REBASED 2026-10-27 on the owner's VERIFIED live schema results (0009 run).
-- RECONCILED 2026-10-26 with the COMPLETED 0010 pre-execution inspection:
--   * four PUBLIC SELECT policies already exist (vendors, vendor_locations,
--     products, product_variants) → this file never drops them; public
--     marketplace browsing continues exactly as-is. Consequently anon keeps
--     its table-level SELECT grant (Part 8) so the public policies' semantics
--     are preserved under any view configuration, while EVERY write privilege
--     is stripped from anon at the table level.
--   * no duplicate vendor/buyer auth links exist (matches detector), so the
--     PART 7 partial unique indexes apply cleanly with zero rows to clean up.
--   * no auth-side triggers were reported → the PART 6 trigger creates the
--     linkage path without colliding with any existing automation.
--   * listing_status CHECK allows draft/active/paused/sold_out/removed and
--     vendor account_status CHECK allows pending/active/suspended/closed —
--     confirmed value vocabularies; this file writes only 'pending' at signup.
--   * two LEGACY vendors with auth_user_id NULL remain untouched: no policy
--     below matches them for any write (uid equality can't equal NULL), the
--     trigger only inserts rows for NEW uids, and PART 7's WHERE guard skips
--     NULLs — they are never claimed, re-linked or overwritten by a signup.
--     V7 lists them for any manual owner linking.
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
--   * anon gets NOTHING to write on these tables (write privileges revoked
--     outright; anon keeps only its preserved SELECT)
--   * authenticated users reach ONLY their own rows, by uid equality
--   * no user can UPDATE/INSERT their way onto another person's profile
--     (WITH CHECK re-asserts auth_user_id = auth.uid() on every write)
--   * NO SELF-SERVICE ESCALATION (hardened 2026-10-26): UPDATE on the two
--     profile tables is granted COLUMN-level only — vendors cannot touch
--     account_status/auth_user_id/id, buyers cannot touch auth_user_id/id;
--     INSERT on those two tables is column-scoped too, so a self-registered
--     vendor can never mint an 'active' row (account_status is server-set:
--     trigger 'pending', or the column's DEFAULT 'pending'). PostgreSQL
--     column ACLs are the enforcement — RLS cannot restrict columns.
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
  idcols CONSTANT text[] := ARRAY[
    'vendors.id', 'buyers.id',
    'products.id', 'product_variants.id', 'vendor_locations.id'
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
  -- The trigger and the column-scoped profile INSERTs omit `id`, so every
  -- id column must mint its own UUID (defaults were NEVER verified live —
  -- V0b reports them post-run). A missing default aborts HERE, before any
  -- change, instead of silently breaking every signup at runtime.
  FOREACH kv IN ARRAY idcols LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name  = split_part(kv, '.', 1)
        AND column_name = split_part(kv, '.', 2)
        AND column_default IS NOT NULL
    ) THEN
      RAISE EXCEPTION
        '0008 preflight: "%" has no column default — profile INSERTs cannot mint ids automatically', kv;
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
-- PART 8. WEB-ROLE GRANT HYGIENE — COLUMN-SCOPED (hardened 2026-10-26).
-- Privilege-escalation fix on top of the 0010 reconciliation:
-- * PostgreSQL RLS cannot restrict WHICH columns an UPDATE may touch —
--   column ACLs can. So the blanket table UPDATE grant is replaced with
--   column-level privileges:
--     - vendors: UPDATE(business_name, display_name) ONLY. account_status,
--       id and auth_user_id are NOT granted — a browser user cannot
--       self-approve ('pending' → 'active') or re-bind their row, and no
--       UNKNOWN admin column is writable (0010/0009 never dumped the full
--       column lists; ungranted = locked).
--     - buyers: UPDATE(display_name, whatsapp_number, default_location_id,
--       default_campus_id) ONLY — auth_user_id/id ungranted, and any
--       yet-unknown sensitive column stays locked until it is verified.
--     - products / product_variants / vendor_locations: whole-row UPDATE
--       stays (vendor-owned content rows; cross-vendor takeover is already
--       impossible via the WITH CHECK ownership joins).
-- * INSERT on the two profile tables is column-scoped as well so a
--   first-time self-registration cannot mint account_status='active':
--   vendors INSERT(auth_user_id, business_name, display_name) and buyers
--   INSERT(auth_user_id, display_name) — the column DEFAULT 'pending'
--   (verified) fills account_status. If the id column lacks a usable
--   default these inserts fail safe (loud error, no escalation); the
--   signup trigger path (SECURITY DEFINER, ungranted columns included)
--   is the primary creation path and is unaffected.
-- * INSERT/DELETE grants exist only where a policy governs them:
--   products/product_variants/vendor_locations (DELETE + INSERT) and the
--   column-scoped profile INSERTs above; vendors/buyers get NO DELETE
--   grant at all (policies for DELETE do not exist there).
-- * service_role untouched throughout.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE ON TABLE
  public.vendors, public.buyers, public.products,
  public.product_variants, public.vendor_locations
FROM anon;

REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRUNCATE ON TABLE
  public.vendors, public.buyers, public.products,
  public.product_variants, public.vendor_locations
FROM authenticated;

-- Read + write guards (RLS still scopes every statement to own rows)
GRANT SELECT ON TABLE
  public.vendors, public.buyers, public.products,
  public.product_variants, public.vendor_locations
TO authenticated;

-- INSERT where policies govern it
GRANT INSERT ON TABLE
  public.products, public.product_variants, public.vendor_locations
TO authenticated;
GRANT INSERT (auth_user_id, business_name, display_name) ON TABLE
  public.vendors
TO authenticated;
GRANT INSERT (auth_user_id, display_name) ON TABLE
  public.buyers
TO authenticated;

-- UPDATE: column-level on profiles (the hardening), whole-row on the
-- vendor-content tables
GRANT UPDATE (business_name, display_name) ON TABLE
  public.vendors
TO authenticated;
GRANT UPDATE (display_name, whatsapp_number, default_location_id, default_campus_id) ON TABLE
  public.buyers
TO authenticated;
GRANT UPDATE ON TABLE
  public.products, public.product_variants, public.vendor_locations
TO authenticated;

-- DELETE where policies govern it (not granted on vendors/buyers)
GRANT DELETE ON TABLE
  public.products, public.product_variants, public.vendor_locations
TO authenticated;

COMMIT;

-- ============================================================================
-- VERIFICATION — ONE read-only statement, run AFTER the COMMIT above (own
-- editor session), returns one JSONB with every check's COMPLETE results:
--   V0 required columns present            (expect all 10)
--   V0b id-column defaults                 (expect 5 rows, each non-null,
--                                          e.g. gen_random_uuid())
--   V1 policies                            (expect 18, roles={authenticated})
--   V2 trigger on auth.users               (expect 1 active row)
--   V3 function SECURITY DEFINER           (expect true + search_path=public)
--   V4 RLS enabled on all five tables      (expect true ×5)
--      rls_forced MUST be false ×5: the signup trigger's SECURITY DEFINER
--      inserts rely on the table-owner exemption (relforcerowsecurity=true
--      would strip that exemption and make every signup fail loudly).
--   V5 anon grants + TRUNCATE leftovers (anon: SELECT on the four
--      policy-covered tables is EXPECTED and preserved — browse; TRIGGER
--      rows are the known 0008 leftover, revoked by 0012; authenticated
--      TRUNCATE must be empty; an anon SELECT grant on buyers is inert,
--      RLS denies it — no policy)
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
v0b AS (
  -- Post-run proof for the preflight's id-default assumption: every entry
  -- must carry a non-null "default" (e.g. gen_random_uuid()).
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'column', t.kv, 'default', c.column_default)), '[]'::jsonb) AS j
  FROM unnest(ARRAY[
    'vendors.id','buyers.id','products.id','product_variants.id','vendor_locations.id'
  ]) AS t(kv)
  LEFT JOIN information_schema.columns c
    ON c.table_schema = 'public'
   AND c.table_name  = split_part(t.kv, '.', 1)
   AND c.column_name = split_part(t.kv, '.', 2)
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
v5b AS (
  SELECT 'authenticated_row_privileges' AS k,
    coalesce(jsonb_agg(jsonb_build_object(
      'table', tv.table,
      'insert',  has_table_privilege('authenticated', tv.table, 'INSERT'),
      'update',  has_table_privilege('authenticated', tv.table, 'UPDATE'),
      'delete',  has_table_privilege('authenticated', tv.table, 'DELETE'),
      'select',  has_table_privilege('authenticated', tv.table, 'SELECT'))),
    '[]'::jsonb) AS j
  FROM (VALUES ('public.vendors'), ('public.buyers'), ('public.products'),
               ('public.product_variants'), ('public.vendor_locations'))
       AS tv(table)
),
v5c AS (
  -- Column-level ACL proof (the escalation hardening): positives must be
  -- exactly the editable profile columns; negatives MUST all be false.
  SELECT 'authenticated_column_privileges' AS k, jsonb_build_object(
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
    'denied_checks_must_all_be_false',
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
           NOT has_column_privilege('authenticated', 'public.buyers', 'id', 'UPDATE'),
         'buyers_insert_auth_user_id_granted_for_trigger_path_expect_true',
           has_column_privilege('authenticated', 'public.buyers', 'auth_user_id', 'INSERT')))
) AS j
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
  'V0b_id_defaults_all_non_null', (SELECT j FROM v0b),
  'V1_policies',                 (SELECT j FROM v1),
  'V2_trigger',                  (SELECT j FROM v2),
  'V3_function_flags',           (SELECT j FROM v3),
  'V4_rls_flags',                (SELECT j FROM v4),
  'V5_grants', jsonb_build_object(
      'anon_rows_expected_empty', (SELECT j_anon     FROM v5),
      'truncate_leftovers',       (SELECT j_truncate FROM v5),
      'authenticated_row_privileges',      (SELECT j FROM v5b),
      'authenticated_column_privileges',   (SELECT j FROM v5c)),
  'V6_unique_indexes',           (SELECT j FROM v6),
  'V7_backfill_worklist', jsonb_build_object(
      'unlinked_vendors', (SELECT j_unlinked_vendors FROM v7),
      'unlinked_buyers',  (SELECT j_unlinked_buyers  FROM v7)),
  -- Browser-check reminders (manual, like 0003's V10):
  --   anon REST probe on buyers → [], always; on vendors/products/
  --     product_variants/vendor_locations → exactly what the PRE-0008 public
  --     SELECT policies exposed (compare 0010's VF snapshot — must be
  --     IDENTICAL: the four public policies are untouched by this file)
  --   authenticated self-scope: signed-in [TEST] vendor sees exactly 1 own row
  --   [TEST] signup produces exactly one linked profile row; then clean up
  --   ESCALATION NEGATIVE PROBE (browser): as a signed-in vendor, PATCH your
  --     own vendors row with {"account_status":"active"} → MUST fail with a
  --     column-privilege permission error (42501), and account_status must
  --     still read 'pending'. Same expectation for buyers
  --     {"auth_user_id":"<any-uuid>"}. 0006 regression probe unaffected.
  --   0006 regression: orders/payments/order_items stay permission-denied
  --   catalog browsing unchanged (same offers/counts/grouping)
  'V8_browser_checklist_note', 'manual — see comments above'
) AS verification;

-- V8/V9 (manual):
-- V8 frontend smoke (anon): same offers, counts, grouping, dropdowns, naira.
-- V9 orders/payments/order_items regression: anon + authenticated still
--    permission-denied (0006 lockdown intact — this file never touched them).
