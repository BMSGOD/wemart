-- ============================================================================
-- Wemart — 0011 PRODUCTS / PRODUCT_VARIANTS COLUMN + CONSTRAINT DUMP
-- database/0011_products_variants_column_dump.sql
--
-- *** OWNER-EXECUTED — READ-ONLY, safe anytime, one run answers every open
-- *** fact for the Stage Two product-creation UI.
--
-- WHY: 0009/0010 confirmed ONLY id / vendor_id / listing_status on products
-- and id / product_id / is_active on product_variants. Names, prices,
-- quantities, condition, images and how variants extend products are the
-- blocking unknowns for product creation, editing, inventory and publishing.
-- NOTHING HERE IS INVENTED — this dump reads the live schema and reports it.
--
-- Answers gathered in ONE JSONB statement (read-only / WITH-SELECT only):
--   C1 products columns        — every column: name, type, nullable, default
--   C2 product_variants columns— same
--   C3 FK map                  — every FK: column(s) → referenced table.column
--                                (also reveals HOW products reference
--                                locations/categories if such columns exist)
--   C4 constraints             — PRIMARY/UNIQUE/CHECK definitions in full
--                                (CHECKs reveal the exact value vocabularies,
--                                e.g. listing_status, condition, currency)
--   C5 indexes                 — all indexes incl. partial/expression ones
--   C6 uniques/index names only, column composition spelled out
--   C7 policies + grants       — current RLS policy list and web-role grants
--                                snapshot (post-0008; confirms hardening)
--   C8 row counts              — products/product_variants totals + products
--                                grouped by listing_status (data shape only,
--                                no content exposed beyond counts)
--   C9 storage columns hint    — which columns look like image paths / prices
--                                / quantities / text names (name-pattern scan
--                                keeps the UI from inventing fields)
--
-- Run once, paste the full JSON back — that single paste unblocks the
-- product-creation/pricing UI batch.
-- ============================================================================

SELECT jsonb_build_object(
  'C1_products_columns',
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'column', column_name, 'type', data_type,
       'udt', udt_name,
       'nullable', is_nullable = 'YES',
       'max_chars', character_maximum_length,
       'default', column_default)
     ORDER BY ordinal_position), '[]'::jsonb)
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'products'),
  'C2_product_variants_columns',
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'column', column_name, 'type', data_type,
       'udt', udt_name,
       'nullable', is_nullable = 'YES',
       'max_chars', character_maximum_length,
       'default', column_default)
     ORDER BY ordinal_position), '[]'::jsonb)
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'product_variants'),
  'C3_foreign_keys',
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'table', tc.relname,
       'constraint', con.conname,
       'definition', pg_get_constraintdef(con.oid, true)
     ) ORDER BY tc.relname, con.conname), '[]'::jsonb)
     FROM pg_constraint con
     JOIN pg_class tc ON tc.oid = con.conrelid
     JOIN pg_namespace n ON n.oid = tc.relnamespace
     WHERE n.nspname = 'public'
       AND tc.relname IN ('products','product_variants')
       AND con.contype = 'f'),
  'C4_constraints_check_unique_primary',
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'table', tc.relname,
       'type', con.contype::text,
       'constraint', con.conname,
       'definition', pg_get_constraintdef(con.oid, true)
     ) ORDER BY tc.relname, con.contype, con.conname), '[]'::jsonb)
     FROM pg_constraint con
     JOIN pg_class tc ON tc.oid = con.conrelid
     JOIN pg_namespace n ON n.oid = tc.relnamespace
     WHERE n.nspname = 'public'
       AND tc.relname IN ('products','product_variants')
       AND con.contype IN ('p','u','c')),
  'C5_indexes',
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'table', tablename, 'index', indexname, 'definition', indexdef
     ) ORDER BY tablename, indexname), '[]'::jsonb)
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename IN ('products','product_variants')),
  'C6_policies',
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'table', tablename, 'policy', policyname, 'command', cmd, 'roles', roles
     ) ORDER BY tablename, policyname), '[]'::jsonb)
     FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('products','product_variants','vendors','buyers','vendor_locations')),
  'C7_table_grants_web_roles',
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'grantee', grantee, 'table', table_name, 'privilege', privilege_type
     ) ORDER BY table_name, grantee, privilege_type), '[]'::jsonb)
     FROM information_schema.table_privileges
     WHERE table_schema = 'public'
       AND table_name IN ('products','product_variants','vendors','buyers','vendor_locations')
       AND grantee IN ('anon','authenticated','public')),
  'C8_row_counts',
    (SELECT jsonb_build_object(
       'products_total', (SELECT count(*) FROM public.products),
       'variants_total', (SELECT count(*) FROM public.product_variants),
       'products_by_listing_status',
         (SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
          FROM (SELECT coalesce(listing_status,'(null)') AS status, count(*) AS n
                FROM public.products GROUP BY 1) s))
  ),
  'C10_storage_buckets',
    -- The catalog view serves images from bucket 'product-images' (the
    -- browser resolves them via supabase.storage getPublicUrl). The bucket
    -- configuration (public? size limit? mime types?) decides what the
    -- future product-image upload UI may offer — dump it alongside the
    -- columns instead of assuming.
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'bucket', b.name, 'public', b.public,
       'file_size_limit', b.file_size_limit,
       'allowed_mime_types', b.allowed_mime_types
     ) ORDER BY b.name), '[]'::jsonb)
     FROM storage.buckets b),
  'C11_catalog_view_definition',
    -- The exact current catalog view definition (pg_get_viewdef). Needed
    -- before ANY explicit future change — e.g. folding the 0014 suspension
    -- hiding into the view itself instead of the data-level sweep. This
    -- dump makes that a reviewed, reviewed-against-fact edit rather than
    -- a blind one. READ-ONLY.
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'view', 'catalog', 'definition', pg_get_viewdef('public.catalog'::regclass, true)
     )), '[]'::jsonb)),
  'C12_catalog_rpc_definitions',
    -- The two catalog functions the browser calls (repo contract says they
    -- read ONLY the catalog/campus_directory views and rank by location).
    -- Dumped so the 0014 follow-up (view-level suspension hiding) is
    -- verified against what the RPC actually reads — no assumptions.
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'function', proname, 'definition', pg_get_functiondef(oid)
     ) ORDER BY proname), '[]'::jsonb)
     FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace
       AND proname IN ('catalog_search', 'catalog_near_campus')),
  'C9_name_pattern_scan',
    (SELECT coalesce(jsonb_agg(jsonb_build_object(
       'table', table_name, 'column', column_name, 'type', data_type
     ) ORDER BY table_name, ordinal_position), '[]'::jsonb)
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name IN ('products','product_variants')
       AND (column_name ~ '(name|title|price|amount|cost|quant|stock|qty|image|photo|cond|currency|slug|desc|category|location)'
            OR data_type IN ('numeric','money')))
  ),
  'note', 'read-only dump — paste the whole JSON back for the product-UI batch'
) AS schema_dump;
