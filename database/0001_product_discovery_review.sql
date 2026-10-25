-- =========================================================================
-- WEMART — PUBLIC DISCOVERY POLICIES + VIEW  (REVIEW COPY — DO NOT BLIND-RUN)
-- =========================================================================
-- STATUS: v2 — column names now match the LIVE schema (Part A output, verified
-- 2026-10). Status VALUE checks and Storage setup remain UNVERIFIED and are
-- marked ⚠️ VERIFIED-NAME / ⚠️ UNVERIFIED-VALUE respectively. Nothing here is
-- applied automatically; run manually in the SQL editor after review.
--
-- Verified table/columns (from Part A):
--   products(id, vendor_id, category_id, name, description, brand,
--            product_condition, listing_status)
--   vendors(id, auth_user_id, business_name, display_name, account_status)
--   categories(id, name, description, is_active)
--   product_variants(id, product_id, sku, variant_name, attributes, price,
--            currency, is_active)
--   product_images(id, product_id, storage_path, alt_text, is_primary,
--            display_order)
--   variant_location_inventory(variant_id, vendor_location_id,
--            quantity_on_hand, quantity_reserved)
--   variant_location_offers(id, variant_id, vendor_location_id, price,
--            currency, is_active, available_for_delivery)
--   vendor_locations(id, vendor_id, location_id, location_name, address_line,
--            city, state, country, latitude, longitude, accepts_pickup,
--            is_primary, campus_location_id)
--   locations(id, name, location_type, parent_location_id, latitude, longitude)
--   buyers(id, auth_user_id, display_name, whatsapp_number, default_location_id,
--            default_campus_id)
--
-- NOTE: there is NO `vendor_verified` column — deliberately unused here.
-- The frontend renders the verified-check only from sample data for now.
--
-- Design for anonymous public product discovery ONLY. Buyers' contact data,
-- orders, payments, payouts, and RAW INVENTORY QUANTITIES are never exposed
-- (see the security-definer stock helper for how stock is checked privately).
-- =========================================================================

-- ------------------------------------------------------------------------
-- PART A — read-only self-inspection: run this FIRST and send back the
-- output (this is pure catalog reading; it changes nothing).
-- ------------------------------------------------------------------------
with wanted as (
  select unnest(array[
    'locations','vendors','vendor_locations','categories','products',
    'product_variants','product_images','variant_location_inventory',
    'variant_location_offers','buyers'
  ]) as table_name
)
-- 1) Column inventory (name, data type, nullability, defaults)
select
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  coalesce(c.column_default, '-')          as column_default
from information_schema.columns c
join wanted w on w.table_name = c.table_name
where c.table_schema = 'public'
order by c.table_name, c.ordinal_position;

-- 2) Foreign keys between these tables (the join graph)
select
  tc.table_name                       as fk_table,
  kcu.column_name                     as fk_column,
  ccu.table_name                      as referenced_table,
  ccu.column_name                     as referenced_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = ccu.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and tc.table_schema = 'public'
  and tc.table_name in ('locations','vendors','vendor_locations','categories',
        'products','product_variants','product_images',
        'variant_location_inventory','variant_location_offers','buyers')
order by tc.table_name;

-- 3) Existing RLS state and policies (so we do not duplicate or clash)
select
  pt.relname                 as table_name,
  pt.relrowsecurity          as rls_enabled,
  pt.relforcerowsecurity     as rls_forced,
  pol.polname                as policy_name,
  case pol.polcmd
    when 'r' then 'SELECT' when 'a' then 'INSERT' when 'u' then 'UPDATE'
    when 'd' then 'DELETE' when '*' then 'ALL'
  end                        as command
from pg_class pt
join pg_namespace n on n.oid = pt.relnamespace and n.nspname = 'public'
left join pg_policy pol on pol.polrelid = pt.oid
where pt.relname in ('locations','vendors','vendor_locations','categories',
      'products','product_variants','product_images',
      'variant_location_inventory','variant_location_offers','buyers')
order by pt.relname;

-- ------------------------------------------------------------------------
-- PART A2 — FOLLOW-UP verification queries (all read-only). Part A returned
-- names but not VALUE domains, ID TYPES, or server-side functions. Run these
-- and send the output BEFORE deciding the ⚠️ UNVERIFIED-VALUE tokens below.
-- ------------------------------------------------------------------------
-- A2.1) Actual status values in the data — do NOT trust 'active' until seen
select 'products.listing_status' as what, listing_status as value, count(*)
from products group by listing_status
union all
select 'vendors.account_status', account_status, count(*)
from vendors group by account_status
union all
select 'categories.is_active', is_active::text, count(*)
from categories group by is_active
union all
select 'product_variants.is_active', is_active::text, count(*)
from product_variants group by is_active
union all
select 'variant_location_offers.is_active', is_active::text, count(*)
from variant_location_offers group by is_active;

-- A2.2) Currency domain — mixing currencies makes MIN(price) meaningless
select 'product_variants' as what, currency, count(*) from product_variants
  group by currency
union all
select 'variant_location_offers', currency, count(*) from variant_location_offers
  group by currency;

-- A2.3) Location types + campus linkage — decides what `campus_id` means
select 'locations.location_type' as what, location_type, count(*)
from locations group by location_type
union all
select 'vendor_locations.campus_location_id null?', campus_location_id::text, count(*)
from vendor_locations group by campus_location_id::text = '' or campus_location_id is null;

-- A2.4) ID data types — the stock helper's parameter types must match reality
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'products'
          and column_name in ('id','vendor_id','category_id'))
    or (table_name = 'product_variants'
          and column_name in ('id','product_id'))
    or (table_name = 'vendor_locations'
          and column_name in ('id','vendor_id','location_id','campus_location_id'))
    or (table_name = 'variant_location_offers'
          and column_name in ('id','variant_id','vendor_location_id'))
    or (table_name = 'variant_location_inventory'
          and column_name in ('variant_id','vendor_location_id'))
    or (table_name in ('categories','vendors','product_images')
          and column_name = 'id'))
order by table_name, column_name;

-- A2.5) Existing server-owned logic — functions + triggers that may already
-- implement ownership checks or enforce invariants. Vendor write policies
-- below MUST NOT fight these; review before applying Part B writes.
select
  r.routine_schema, r.routine_name, r.routine_type,
  r.security_type, r.data_type as returns
from information_schema.routines r
where r.routine_schema = 'public'
order by r.routine_name;

select
  t.event_object_table  as table_name,
  t.trigger_name,
  t.action_timing,
  t.event_manipulation  as event,
  t.action_statement
from information_schema.triggers t
where t.event_object_table in ('locations','vendors','vendor_locations',
      'categories','products','product_variants','product_images',
      'variant_location_inventory','variant_location_offers','buyers')
order by t.event_object_table, t.trigger_name;

-- A2.6) Existing role grants — policies alone don't help if grants are off
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
  and table_name in ('locations','vendors','vendor_locations','categories',
      'products','product_variants','product_images',
      'variant_location_inventory','variant_location_offers','buyers')
order by table_name, grantee;

-- A2.7) Storage buckets — identifies the image bucket name and publicity
-- (frontend URL construction needs the bucket name; do not guess it)
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by name;

select bucket_id, count(*) as object_count
from storage.objects
group by bucket_id
order by bucket_id;

-- ------------------------------------------------------------------------
-- PART B — MINIMUM SAFE RLS FOR PUBLIC DISCOVERY (DRAFT)
-- ------------------------------------------------------------------------

-- ⚠️ UNVERIFIED-VALUE tokens used below (fill from A2.1):
--   <ACTIVE_LISTING>     products.listing_status value meaning "live"
--   <ACTIVE_VENDOR>      vendors.account_status value meaning "allowed to sell"
-- Assumed 'active' for both — VERIFY, do not trust.

-- ⚠️ SEQUENCE: apply A2.5 review FIRST. If server-owned triggers/functions
-- already gate vendor ownership, the write policies below must align with
-- them (or be replaced by them) — never doubly enforced in a conflicting way.

-- How to apply safely: PostgreSQL has no `CREATE OR REPLACE POLICY`.
-- Every policy below is therefore preceded by `DROP POLICY IF EXISTS`.
-- If Part A(3) reports existing policies with the same names, review them
-- first — replacing them is an intentional decision, not an accident.
-- Never disable RLS (`alter table … no row level security`) as a shortcut.

-- --- locations: public directory of campuses --------------------------------
-- Verified columns hold only public directory data (name/type/coords).
alter table locations enable row level security;

drop policy if exists public_read_locations on locations;
create policy public_read_locations on locations
  for select to anon, authenticated
  using (true);

-- --- categories: public taxonomy (active rows only) --------------------------
alter table categories enable row level security;

drop policy if exists public_read_categories on categories;
create policy public_read_categories on categories
  for select to anon, authenticated
  using (is_active = true);  -- verified column name

-- --- vendors: public display info ONLY ---------------------------------------
-- Verified columns: id, auth_user_id, business_name, display_name,
-- account_status. No banking/phone columns exist — good. ⚠️ Known residual:
-- auth_user_id IS readable by anon (RLS cannot hide columns). It is a
-- UUID with no exploit value, but if that is unacceptable the fix is a
-- column-restricted `public_vendors` view + recloumn grants instead of a
-- whole-table policy. Flagged for review, not hidden silently.
alter table vendors enable row level security;

drop policy if exists public_read_vendors on vendors;
create policy public_read_vendors on vendors
  for select to anon, authenticated
  using (account_status = <ACTIVE_VENDOR>);

-- Vendors manage only their own vendor record. auth_user_id is compared
-- against the server-resolved auth.uid() JWT claim — never a client value.
drop policy if exists vendor_manage_own_vendor on vendors;
create policy vendor_manage_own_vendor on vendors
  for all to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- --- vendor_locations: public pickup/presence points --------------------------
-- ⚠️ address_line becomes anon-readable here (pickup location is public by
-- nature in a campus marketplace, but confirm). Read is limited to vendor
-- rows of an allowed vendor via the ownership join below.
alter table vendor_locations enable row level security;

drop policy if exists public_read_vendor_locations on vendor_locations;
create policy public_read_vendor_locations on vendor_locations
  for select to anon, authenticated
  using (exists (
    select 1 from vendors v
    where v.id = vendor_locations.vendor_id
      and v.account_status = <ACTIVE_VENDOR>
  ));

-- Server-side ownership: vendor_id is compared against the vendor rows the
-- authenticated user owns — a client-supplied vendor_id cannot pass.
drop policy if exists vendor_manage_own_locations on vendor_locations;
create policy vendor_manage_own_locations on vendor_locations
  for all to authenticated
  using (vendor_id in (select id from vendors where auth_user_id = auth.uid()))
  with check (vendor_id in (select id from vendors where auth_user_id = auth.uid()));

-- --- products: public reads of LIVE listings only -----------------------------
alter table products enable row level security;

drop policy if exists public_read_active_products on products;
create policy public_read_active_products on products
  for select to anon, authenticated
  using (listing_status = <ACTIVE_LISTING>);

-- Vendors insert/edit/delete ONLY their own products
drop policy if exists vendor_write_own_products on products;
create policy vendor_write_own_products on products
  for all to authenticated
  using (vendor_id in (select id from vendors where auth_user_id = auth.uid()))
  with check (vendor_id in (select id from vendors where auth_user_id = auth.uid()));

-- --- product_images: public, but piggy-back on the owning product ------------
alter table product_images enable row level security;

drop policy if exists public_read_product_images on product_images;
create policy public_read_product_images on product_images
  for select to anon, authenticated
  using (exists (select 1 from products p
                 where p.id = product_images.product_id
                   and p.listing_status = <ACTIVE_LISTING>));

drop policy if exists vendor_write_own_product_images on product_images;
create policy vendor_write_own_product_images on product_images
  for all to authenticated
  using (exists (select 1 from products p
                 where p.id = product_images.product_id
                   and p.vendor_id in (select id from vendors where auth_user_id = auth.uid())))
  with check (exists (select 1 from products p
                 where p.id = product_images.product_id
                   and p.vendor_id in (select id from vendors where auth_user_id = auth.uid())));

-- --- product_variants: public on live products --------------------------------
alter table product_variants enable row level security;

drop policy if exists public_read_product_variants on product_variants;
create policy public_read_product_variants on product_variants
  for select to anon, authenticated
  using (exists (select 1 from products p
                 where p.id = product_variants.product_id
                   and p.listing_status = <ACTIVE_LISTING>));

drop policy if exists vendor_write_own_variants on product_variants;
create policy vendor_write_own_variants on product_variants
  for all to authenticated
  using (exists (select 1 from products p
                 where p.id = product_variants.product_id
                   and p.vendor_id in (select id from vendors where auth_user_id = auth.uid())))
  with check (exists (select 1 from products p
                 where p.id = product_variants.product_id
                   and p.vendor_id in (select id from vendors where auth_user_id = auth.uid())));

-- --- variant_location_inventory: PRIVATE — no public policy at all ------------
-- Raw quantities (quantity_on_hand / quantity_reserved) must NOT be exposed
-- (requirement #6). There is deliberately NO anon SELECT policy on this
-- table: anon gets nothing. Stock is exposed only as a boolean through the
-- security-definer helper below, and vendors write their own rows via the
-- verified vendor_location ownership chain (2 hops, both database-enforced).
alter table variant_location_inventory enable row level security;

drop policy if exists vendor_write_own_inventory on variant_location_inventory;
create policy vendor_write_own_inventory on variant_location_inventory
  for all to authenticated
  using (vendor_location_id in (
    select vl.id from vendor_locations vl
    where vl.vendor_id in (select id from vendors where auth_user_id = auth.uid())
  ))
  with check (vendor_location_id in (
    select vl.id from vendor_locations vl
    where vl.vendor_id in (select id from vendors where auth_user_id = auth.uid())
  ));

-- ⚠️ NOTE: even the vendor-write policy above still lets the OWNING vendor
-- read their own raw inventory (for all to authenticated with both using and
-- check) — that is intentional (a vendor must see their own stock), but it
-- means the table is readable by its owner only, verify with the test plan.

-- --- variant_location_offers: live offers only --------------------------------
alter table variant_location_offers enable row level security;

drop policy if exists public_read_active_offers on variant_location_offers;
create policy public_read_active_offers on variant_location_offers
  for select to anon, authenticated
  using (
    is_active = true
    and exists (
      select 1
      from product_variants vr
      join products p on p.id = vr.product_id
      where vr.id = variant_location_offers.variant_id
        and p.listing_status = <ACTIVE_LISTING>
    )
  );

drop policy if exists vendor_write_own_offers on variant_location_offers;
create policy vendor_write_own_offers on variant_location_offers
  for all to authenticated
  using (vendor_location_id in (
    select vl.id from vendor_locations vl
    where vl.vendor_id in (select id from vendors where auth_user_id = auth.uid())
  ))
  with check (vendor_location_id in (
    select vl.id from vendor_locations vl
    where vl.vendor_id in (select id from vendors where auth_user_id = auth.uid())
  ));

-- ### buyers: NO public policies — full denial for anon. Columns like
-- whatsapp_number and default locations are private by design.

-- ------------------------------------------------------------------------
-- PART C — STOCK HELPER + `product_discovery` VIEW
-- ------------------------------------------------------------------------

-- C.1) Stock visibility WITHOUT exposing raw quantities.
-- security definer + empty search_path (Supabase hardening guideline):
-- the function runs with the owner's rights (postgres) and can see the
-- inventory table that anon itself cannot. It returns ONLY a boolean.
-- ⚠️ Parameter types assume uuid/uuid — confirm with A2.4; if IDs are
-- bigints, change parameter types accordingly (logic is identical).
create or replace function public.pd_location_is_available(
  p_product_id uuid,
  p_vendor_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.variant_location_inventory inv
      join public.product_variants vr on vr.id = inv.variant_id
      where vr.product_id = p_product_id
        and inv.vendor_location_id = p_vendor_location_id
        and inv.quantity_on_hand > coalesce(inv.quantity_reserved, 0)
    )
    or not exists (
      -- ⚠️ DECISION, review: a vendor that tracks no inventory rows at all
      -- at this location is treated as "available" (marketplaces without
      -- full stock tracking must not render every listing as sold out).
      select 1
      from public.variant_location_inventory inv2
      join public.product_variants vr2 on vr2.id = inv2.variant_id
      where vr2.product_id = p_product_id
        and inv2.vendor_location_id = p_vendor_location_id
    )
$$;

-- C.2) The view: ONE ROW PER (product, vendor_location) — the storefront
-- grain. Multiple variants/offers at one location collapse into the cheapest
-- price and a single stock boolean; the multi-variant reality (different
-- offers at different locations) is preserved by one row per location.
--
-- security_invoker = true → the anon policies from Part B gate every row;
-- an owner-permission view would bypass them, which is why this option is
-- mandatory. The frontend (src/lib/catalog.ts) queries this view only.
--
-- ⚠️ Not exposed: vendor contact/banking fields, buyer data, addresses of
-- private nature, raw inventory numbers, vendor auth ids, SKUs, offers'
-- delivery flags, product brand (unused by the storefront today).
--
-- ⚠️ UNVERIFIED-VALUE: <ACTIVE_LISTING> / <ACTIVE_VENDOR> as in Part B.
create or replace view public.product_discovery
with (security_invoker = true)
as
select
  pr.id                       as product_id,
  pr.name                     as title,
  pr.description              as description,
  cat.name                    as category,
  pr.product_condition        as condition,   -- ⚠️ verify values match the UI enum
  ven_coalesce.display_name   as vendor_display_name,
  vl.id                       as vendor_location_id,
  vl.campus_location_id       as campus_id,   -- ⚠️ verify how campuses link; nullability per A2.3
  vl.location_name            as location_name,
  vl.city                     as city,
  vl.state                    as state,
  vl.latitude                 as latitude,
  vl.longitude                as longitude,
  min(coalesce(offr.price, vr.price)) as price,   -- ⚠️ single-currency assumption (A2.2)
  coalesce(
    min(coalesce(offr.currency, vr.currency)),
    'NGN'
  )                           as currency,
  public.pd_location_is_available(pr.id, vl.id) as in_stock,
  (
    select img.storage_path
    from product_images img
    where img.product_id = pr.id
      and img.is_primary = true
    order by img.display_order
    limit 1
  )                           as image_path
from products pr
join categories cat
  on cat.id = pr.category_id
 and cat.is_active = true
join vendors ven
  on ven.id = pr.vendor_id
 and ven.account_status = <ACTIVE_VENDOR>
join product_variants vr
  on vr.product_id = pr.id
 and vr.is_active = true
left join variant_location_offers offr
  on offr.variant_id = vr.id
 and offr.is_active = true
join vendor_locations vl
  on vl.id = offr.vendor_location_id
left join lateral (
  select coalesce(ven.display_name, ven.business_name) as display_name
) ven_coalesce on true
where pr.listing_status = <ACTIVE_LISTING>
group by
  pr.id, pr.name, pr.description, cat.name, pr.product_condition,
  ven.id, vl.id, vl.campus_location_id, vl.location_name,
  vl.city, vl.state, vl.latitude, vl.longitude
;

-- ⚠️ REVIEW the lateral join above: with PostgreSQL's GROUP BY rules every
-- selected column must be grouped or aggregated. `ven_coalesce.display_name`
-- is produced per-ven row; since ven.id is in the GROUP BY, this is valid,
-- but if your Postgres version complains, replace it with the plain
-- expression `coalesce(ven.display_name, ven.business_name)` and add
-- `ven.display_name` / `ven.business_name` to the GROUP BY instead.
--
-- RECOMMENDED once applied: indexes on the FK columns used by the view joins
-- (products.vendor_id/category_id, product_variants.product_id,
-- variant_location_offers.(variant_id, vendor_location_id),
-- variant_location_inventory.variant_id, variant_location_inventory.vendor_location_id,
-- vendor_locations.vendor_id) — performance, not security.
-- =========================================================================
