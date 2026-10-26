-- ============================================================================
-- 0015 — STORAGE / IMAGE / INVENTORY FACTS  (READ-ONLY, safe anytime)
-- ============================================================================
-- Purpose: the 0011 column dump CONFIRMED that neither `products` nor
-- `product_variants` carries a quantity OR an image column — yet the live
-- `catalog` view exposes `available_quantity` and `image_path` to the
-- browser. Before the vendor UI grows stock counts or photo uploads, the
-- following MUST be established from the live project (this file):
--
--   E1  every public table + columns        → find where images/stock live
--   E2  PK/unique/FK constraints, both directions → junction tables (images)
--   E2b/E2c  FKs INTO products/variants/categories
--   E3  every public VIEW + full definition  → what the catalog view composes
--   E3b  catalog_search / catalog_near_campus function definitions
--   E4  storage.objects RLS policies         → can authenticated vendors
--                                              actually UPLOAD (INSERT) into
--                                              the product-images bucket?
--   E4b storage.objects grants (anon/authenticated)
--   E5  buckets config (product-images)      → size limits / mime types /
--                                              public flag (re-confirms C10)
--   E6  storage.objects columns              → the columns an upload writes
--   E7  exact row counts for known tables + catalog estimates for ALL others
--   E8  up to 50 existing product-images objects (metadata only, no bodies)
--
-- HOW TO RUN: paste the WHOLE statement into the Supabase SQL Editor and run.
-- It is ONE statement returning ONE JSON value. Nothing is created, altered,
-- or dropped; every probe is a catalog or live-table read. Safe to re-run.
-- ============================================================================

BEGIN;

SELECT jsonb_build_object(
  'label',        '0015 storage / image / inventory facts',
  'generated_at', now(),

  'e1_public_columns',
    (SELECT jsonb_agg(jsonb_build_object(
       'table', c.table_name, 'ord', c.ordinal_position,
       'column', c.column_name, 'type', c.data_type, 'udt', c.udt_name,
       'nullable', c.is_nullable, 'default', c.column_default)
       ORDER BY c.table_name, c.ordinal_position)
     FROM information_schema.columns c
     WHERE c.table_schema = 'public'),

  'e2_constraints_public',
    (SELECT jsonb_agg(
       jsonb_build_object(
         'constraint_name', con.conname,
         'table', con.conrelid::regclass::text,
         'type', con.contype,                       -- p=pk u=unique f=fk
         'columns', (SELECT string_agg(att.attname, ', ' ORDER BY ord)
                     FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
                     JOIN pg_attribute att
                       ON att.attrelid = con.conrelid AND att.attnum = k.attnum),
         'references_table', CASE con.confrelid WHEN 0 THEN NULL
                             ELSE con.confrelid::regclass::text END,
         'references_columns', CASE con.confrelid WHEN 0 THEN NULL
                             ELSE (SELECT string_agg(att.attname, ', ' ORDER BY ord)
                                   FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
                                   JOIN pg_attribute att
                                     ON att.attrelid = con.confrelid AND att.attnum = k.attnum)
                             END,
         'on_delete', con.confdelaction::text,      -- a=no action r=restrict c=cascade…
         'on_update', con.confupaction::text)
       ORDER BY con.conrelid::regclass::text, con.conname)
     FROM pg_constraint con
     JOIN pg_class rel ON rel.oid = con.conrelid
     JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'),

  'e2b_fks_referencing_products',
    (SELECT jsonb_agg(
       jsonb_build_object(
         'constraint', con.conname,
         'from_table', con.conrelid::regclass::text,
         'from_columns', (SELECT string_agg(att.attname, ', ' ORDER BY ord)
                          FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
                          JOIN pg_attribute att
                            ON att.attrelid = con.conrelid AND att.attnum = k.attnum),
         'to_table', con.confrelid::regclass::text)
       ORDER BY con.conrelid::regclass::text)
     FROM pg_constraint con
     WHERE con.contype = 'f'
       AND con.confrelid IN ('public.products'::regclass,
                             'public.product_variants'::regclass)),

  'e2c_fks_referencing_categories',
    (SELECT jsonb_agg(
       jsonb_build_object(
         'constraint', con.conname,
         'from_table', con.conrelid::regclass::text,
         'from_columns', (SELECT string_agg(att.attname, ', ' ORDER BY ord)
                          FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
                          JOIN pg_attribute att
                            ON att.attrelid = con.conrelid AND att.attnum = k.attnum))
       ORDER BY con.conrelid::regclass::text)
     FROM pg_constraint con
     WHERE con.contype = 'f'
       AND con.confrelid = 'public.categories'::regclass),

  'e3_public_view_definitions',
    (SELECT jsonb_agg(
       jsonb_build_object('kind', v.kind, 'view', v.viewname, 'definition', v.definition)
       ORDER BY v.kind, v.viewname)
     FROM (SELECT 'view' AS kind, viewname, definition
                  FROM pg_views WHERE schemaname = 'public'
           UNION ALL
           SELECT 'materialized view' AS kind, matviewname AS viewname, definition
                  FROM pg_matviews WHERE schemaname = 'public') v),

  'e3b_catalog_rpc_definitions',
    (SELECT jsonb_agg(jsonb_build_object(
       'function', p.proname,
       'arg_names', to_jsonb(p.proargnames),
       'return_type', pg_get_function_result(p.oid),
       'definition', pg_get_functiondef(p.oid))
       ORDER BY p.proname)
     FROM pg_proc p
     JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
     WHERE nsp.nspname = 'public'
       AND p.proname IN ('catalog_search', 'catalog_near_campus')),

  'e4_storage_object_policies',
    (SELECT jsonb_agg(jsonb_build_object(
       'policy', pol.policyname, 'roles', to_jsonb(pol.roles), 'cmd', pol.cmd,
       'qual', pol.qual, 'with_check', pol.with_check)
       ORDER BY pol.policyname, pol.cmd)
     FROM pg_policies pol
     WHERE pol.schemaname = 'storage' AND pol.tablename = 'objects'),

  'e4b_storage_object_grants',
    (SELECT jsonb_agg(jsonb_build_object(
       'role', gra.grantee, 'privilege', gra.privilege_type)
       ORDER BY gra.grantee, gra.privilege_type)
     FROM information_schema.role_table_grants gra
     WHERE gra.table_schema = 'storage' AND gra.table_name = 'objects'
       AND gra.grantee IN ('anon', 'authenticated')),

  'e5_buckets',
    jsonb_build_object(
      'all_buckets',
        (SELECT jsonb_agg(b ORDER BY b.name)
         FROM (SELECT id, name, public, file_size_limit,
                      allowed_mime_types, created_at, updated_at
               FROM storage.buckets) b),
      'product_images_row',
        (SELECT to_jsonb(b)
         FROM (SELECT id, name, public, file_size_limit,
                      allowed_mime_types, created_at, updated_at
               FROM storage.buckets WHERE name = 'product-images') b)),

  'e6_storage_objects_columns',
    (SELECT jsonb_agg(jsonb_build_object(
       'column', c.column_name, 'type', c.data_type, 'udt', c.udt_name,
       'nullable', c.is_nullable, 'default', c.column_default)
       ORDER BY c.ordinal_position)
     FROM information_schema.columns c
     WHERE c.table_schema = 'storage' AND c.table_name = 'objects'),

  'e7_exact_row_counts_known_tables',
    (SELECT jsonb_object_agg(tbl.table_name, tbl.cnt)
     FROM (
       SELECT 'products' AS table_name,
              (SELECT count(*) FROM public.products) AS cnt
       UNION ALL SELECT 'product_variants',
              (SELECT count(*) FROM public.product_variants)
       UNION ALL SELECT 'vendors',
              (SELECT count(*) FROM public.vendors)
       UNION ALL SELECT 'vendor_locations',
              (SELECT count(*) FROM public.vendor_locations)
       UNION ALL SELECT 'buyers',
              (SELECT count(*) FROM public.buyers)
       UNION ALL SELECT 'categories',
              (SELECT count(*) FROM public.categories)
       UNION ALL SELECT 'locations',
              (SELECT count(*) FROM public.locations)
     ) tbl),

  -- catalog statistics (reltuples) for EVERY public table — zero-cost read
  -- that reveals any table E1 surfaces whose exact count is not taken above
  -- (image/inventory-shaped tables will show here too).
  'e7b_estimated_row_counts_all_public_tables',
    (SELECT jsonb_object_agg(t.table_name, GREATEST(t.reltuples, 0))
     FROM (
       SELECT c.relname AS table_name, c.reltuples::bigint AS reltuples
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
     ) t),

  -- existing files in the product-images bucket (metadata only, no bodies)
  -- so an upload UI matches real bucket contents and path conventions.
  'e8_product_images_bucket_objects_sample',
    (SELECT jsonb_agg(
       jsonb_build_object(
         'name', o.name, 'path_tokens', to_jsonb(o.path_tokens),
         'metadata', o.metadata, 'owner', o.owner,
         'created_at', o.created_at, 'updated_at', o.updated_at)
       ORDER BY o.created_at DESC)
     FROM (
       SELECT name, path_tokens, metadata, owner, created_at, updated_at
       FROM storage.objects
       WHERE bucket_id = 'product-images'
       ORDER BY created_at DESC
       LIMIT 50
     ) o)
) AS facts_json;

COMMIT;

-- ============================================================================
-- PASTE-BACK: the single `facts_json` row answers:
--   • WHERE images live (E2b junction FKs + E3 catalog view definition)
--   • WHERE stock/quantity lives (same two probes)
--   • whether authenticated vendors can UPLOAD (E4 INSERT policy + E4b grant)
--   • bucket constraints (E5) and the columns an upload writes (E6)
--
-- RECONCILIATION RULE — only confirmed facts feed frontend work:
--   The vendor UI (src/data/) writes ONLY columns confirmed by 0011 + 0015.
--   If E1–E3 show NO image/inventory table exists yet, stock counts and photo
--   uploads stay OUT of scope until the owner creates them in a reviewed
--   migration (never auto-created from the repo).
-- ============================================================================
