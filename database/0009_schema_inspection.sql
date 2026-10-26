-- ============================================================================
-- Wemart — 0009 SCHEMA INSPECTION (auth phase, READ-ONLY, safe anytime)
-- database/0009_schema_inspection.sql
--
-- PURPOSE: the frontend auth batch (vendor/buyer profiles, product &
-- inventory management) must be built against REAL column names. No live
-- schema dump exists in this repo, and database/0008_* policies draft
-- assumed `vendors.user_id` / `products.vendor_id` etc. Run THIS file
-- first (pure SELECTs), share the output, and 0008 gets finalized from
-- facts — then reviewed and only then executed by the owner.
--
-- Zero writes, zero grants, zero policy changes; works under the current
-- zero-policy RLS (system catalogs are always readable by table owners).
-- ============================================================================

-- A. Columns of every table the auth phase touches --------------------------
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_variants', 'vendors',
                     'vendor_locations', 'buyers')
ORDER BY table_name, ordinal_position;

-- B. Keys / constraints on the same tables ----------------------------------
SELECT tc.table_name,
       tc.constraint_name, tc.constraint_type,
       kcu.column_name,
       ccu.table_name AS references_table,
       ccu.column_name AS references_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('products', 'product_variants', 'vendors',
                        'vendor_locations', 'buyers')
ORDER BY tc.table_name, tc.constraint_type, kcu.ordinal_position;

-- C. RLS flags / policies / grants on those tables (current state) -----------
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname = 'public' AND p.tablename = c.relname
       ) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('products', 'product_variants', 'vendors',
                    'vendor_locations', 'buyers')
ORDER BY c.relname;

-- D. Web-role grants on those tables (must stay minimal / none) --------------
SELECT table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND table_name IN ('products', 'product_variants', 'vendors',
                     'vendor_locations', 'buyers')
ORDER BY table_name, grantee;

-- E. Catalog view columns (what buyers currently see as pre-joined vendor info)
SELECT ordinal_position, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_view = true
  AND table_name = 'catalog'
ORDER BY ordinal_position;

-- F. auth-side triggers on auth.users (none expected — 0008 would add one) ---
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
ORDER BY trigger_name;

-- G. One-row sample proof of linkage columns (no PII) ------------------------
-- If C shows zero policies, SECURITY DEFINER blocks this for web roles —
-- run it as the project owner account (dashboard) instead.
SELECT
  (SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendors'
    ORDER BY ordinal_position LIMIT 1) AS vendors_columns_start,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='vendors') AS vendors_column_count,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products') AS products_column_count,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema='public' AND table_name='buyers') AS buyers_column_count;
