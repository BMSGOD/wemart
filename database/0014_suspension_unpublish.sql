-- ============================================================================
-- Wemart — 0014 SUSPENSION UNPUBLISH (AUTOMATIC — vendors-status trigger)
-- database/0014_suspension_unpublish.sql
--
-- *** OWNER-EXECUTED — run by hand in the SQL Editor. Idempotent: safe to
-- *** re-run; the sweep step becomes a no-op once the trigger is installed.
--
-- R2 REVISION (2026-10-27, owner request): the original file was a manual
-- sweep the owner had to re-run after every suspension/closure. This
-- revision adds an automatic PostgreSQL trigger: whenever a vendors row's
-- account_status is (or becomes) 'suspended' or 'closed', that vendor's
-- currently *active* product rows flip to 'paused' — with NO automatic
-- reactivation on restore.
--
-- WHY DATA-LEVEL (unchanged from R1):
--   The catalog is served by the `catalog` view + `catalog_search` RPC whose
--   owner-executed queries bypass RLS, so NO products policy change can hide
--   a suspended vendor's live listings. Flipping the listing_status data
--   itself ('active' → 'paused') hides rows WITHOUT touching the view, the
--   RPC, or any policy: paused rows are simply not picked up (same reason
--   drafts never display). Discovery behavior (tiered campus/state ordering,
--   grouping, recommended pool) is byte-identical.
--
-- SECURITY REVIEW OF THE TRIGGER (no bypass introduced):
--   * Function is SECURITY DEFINER owned by postgres with an inert
--     search_path, so its single products-UPDATE executes as the owner.
--     Products has RLS ENABLED but relforcerowsecurity = false (verified in
--     0008 V4) — the same authorisation path 0008's own signup trigger
--     relies on. If that flag is ever changed, this trigger's UPDATE fails
--     LOUDLY (fail-closed), never silently widening.
--   * Web roles CANNOT set vendors.account_status: 0008 granted vendors
--     UPDATE(business_name, display_name) ONLY — a suspended user cannot
--     toggle their own status to fire or defeat this trigger.
--   * The function can only SHRINK visibility: its one statement is a fixed
--     UPDATE that maps 'active' → 'paused' for the row that already entered
--     a suspended/closed state. It deletes nothing, grants nothing, and
--     never widens a status (no path to set anything to 'active').
--   * EXECUTE on the function is RESTRICTED: `REVOKE EXECUTE … FROM PUBLIC,
--     anon, authenticated` (Part 1) — only the table-owner session (postgres
--     in the SQL Editor) holds it implicitly. Consequence: an admin update of
--     account_status made via a SECURITY DEFINER helper or service_role
--     would need an explicit GRANT EXECUTE to fire this trigger; plain
--     owner-session updates always do. Never a bypass either way: the
--     caller cannot influence anything beyond the vendors row whose status
--     it just set to suspended/closed.
--   * 0006 lockdown (orders/payments/order_items) is untouched; 0008/0013
--     policies untouched; the four public SELECT policies untouched.
--
-- INTERFERENCE WITH THE SIGNUP TRIGGER (none, by construction):
--   0008's trigger is `on_wemart_auth_user_created` AFTER INSERT ON
--   auth.users → function public.handle_new_wemart_user(). This file adds
--   ONLY an AFTER UPDATE trigger on public.vendors under its own names:
--     function: public.wemart_vendors_suspension_unpublish()
--     trigger : wemart_vendors_suspension_unpublish_trg ON public.vendors
--   No existing trigger or function is dropped or replaced (the DROP
--   TRIGGER IF EXISTS clears ONLY this file's own trigger name). Vendor
--   signup (INSERT of auth.users → vendors/buyers rows) is untouched, and
--   inserting a NEW vendor row does not fire this trigger.
--
-- UPDATED_AT NOTE (uncertainty handled honestly):
--   products.updated_at exists (0011), but whether a trigger maintains it
--   is unknown. This sweep deliberately does NOT write updated_at — if a
--   maintenance trigger exists it keeps working; if none exists, leaving
--   the column untouched preserves its original meaning. Verification U7
--   lists every trigger on products so the answer becomes known after the
--   paste.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- PART 1. Trigger function — SECURITY DEFINER, inert search_path.
-- Fires on ANY public.vendors UPDATE whose NEW row carries a suspended or
-- closed status — including status-unchanged updates of an already-suspended
-- vendor, so a listings accident re-hides itself (self-healing, idempotent).
-- Its ONLY write is the smallest narrowing UPDATE. No reactivation path.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wemart_vendors_suspension_unpublish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  -- Fire only when the row is (or became) suspended/closed. NULL status:
  -- IN(...) is false → no sweep. Restore transitions (any other value)
  -- are deliberately ignored — NEVER reactivated automatically.
  IF NEW.account_status IN ('suspended', 'closed') THEN
    UPDATE public.products
       SET listing_status = 'paused'
     WHERE public.products.vendor_id = NEW.id
       AND public.products.listing_status = 'active';
  END IF;
  RETURN NEW;
END
$fn$;

COMMENT ON FUNCTION public.wemart_vendors_suspension_unpublish() IS
  '0014: auto-withdraw active listings (→paused) of suspended/closed vendors. SECURITY DEFINER; never reactivates.';

REVOKE EXECUTE ON FUNCTION
  public.wemart_vendors_suspension_unpublish()
FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- PART 2. Install the trigger. Only THIS file's own name is dropped/created —
-- nothing else on public.vendors (or anywhere) is touched. NOT an INSERT
-- trigger: vendor signup never fires it.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS wemart_vendors_suspension_unpublish_trg
  ON public.vendors;

CREATE TRIGGER wemart_vendors_suspension_unpublish_trg
  AFTER UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.wemart_vendors_suspension_unpublish();

-- ---------------------------------------------------------------------------
-- PART 3. One-time cleanup (idempotent): withdraw listings that went active
-- BEFORE this trigger existed, for vendors that are already suspended or
-- closed at install time. Rows keep every column and their whole history;
-- only listing_status flips. Second run matches 0 rows (no-op).
-- ---------------------------------------------------------------------------
UPDATE public.products p
SET listing_status = 'paused'
FROM public.vendors v
WHERE p.vendor_id = v.id
  AND v.account_status IN ('suspended', 'closed')
  AND p.listing_status = 'active';

COMMIT;

-- ============================================================================
-- VERIFICATION — ONE read-only statement, run AFTER COMMIT (own session).
-- Expected:
--   U1 = 0 products remain 'active' for suspended/closed vendors.
--   U2 = rows withdrawn by THIS run's Part 3 (paused products of suspended/
--        closed vendors; empty once a previous run already cleaned them —
--        U1 + trigger guarantee it stays empty).
--   U3 = informational: products by listing_status after the sweep.
--   U4 = 0006 touch-check: orders/payments/order_items grants/policies.
--   U5 = THIS trigger installed exactly once on public.vendors.
--   U6 = coexistence check: every non-internal trigger on public.vendors,
--        public.products (unknown pre-existing ones surface here) AND the
--        0008 signup trigger still on auth.users.
--   U7 = this function's security attributes (definer, owner, search_path)
--        + the products RLS force-flag it depends on (must be false).
--   U8 = suspended/closed vendors inventory (expect the same vendor count
--        as when the run was planned).
-- Paste the whole JSON back.
-- ============================================================================
WITH
u1 AS (
  SELECT count(*) AS j
  FROM public.products p
  JOIN public.vendors v ON v.id = p.vendor_id
  WHERE v.account_status IN ('suspended', 'closed')
    AND p.listing_status = 'active'
),
u2 AS (
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'product_id', p.id, 'vendor_id', p.vendor_id,
    'vendor_status', v.account_status, 'now', p.listing_status
  ) ORDER BY p.id), '[]'::jsonb) AS j
  FROM public.products p
  JOIN public.vendors v ON v.id = p.vendor_id
  WHERE v.account_status IN ('suspended', 'closed')
    AND p.listing_status = 'paused'
),
u3 AS (
  SELECT coalesce(jsonb_object_agg(status, n), '{}'::jsonb) AS j
  FROM (SELECT coalesce(listing_status, '(null)') AS status, count(*) AS n
        FROM public.products GROUP BY 1) s
),
u4 AS (
  SELECT jsonb_build_object(
    'orders_grants', (SELECT count(*) FROM information_schema.table_privileges
      WHERE table_schema = 'public' AND table_name = 'orders'),
    'payments_grants', (SELECT count(*) FROM information_schema.table_privileges
      WHERE table_schema = 'public' AND table_name = 'payments'),
    'order_items_grants', (SELECT count(*) FROM information_schema.table_privileges
      WHERE table_schema = 'public' AND table_name = 'order_items'),
    'orders_policies', (SELECT count(*) FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'orders')
  ) AS j
),
u5 AS (
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) AS j
  FROM (
    SELECT tg.tgname, pg_get_triggerdef(tg.oid) AS definition
    FROM pg_trigger tg
    WHERE tg.tgrelid = 'public.vendors'::regclass
      AND NOT tg.tgisinternal
  ) t
),
u6 AS (
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) AS j
  FROM (
    SELECT 'public.vendors' AS on_table, tg.tgname,
           pg_get_triggerdef(tg.oid) AS definition
    FROM pg_trigger tg
    WHERE tg.tgrelid = 'public.vendors'::regclass AND NOT tg.tgisinternal
    UNION ALL
    SELECT 'public.products', tg.tgname, pg_get_triggerdef(tg.oid)
    FROM pg_trigger tg
    WHERE tg.tgrelid = 'public.products'::regclass AND NOT tg.tgisinternal
    UNION ALL
    SELECT 'auth.users', tg.tgname, pg_get_triggerdef(tg.oid)
    FROM pg_trigger tg
    WHERE tg.tgrelid = 'auth.users'::regclass AND NOT tg.tgisinternal
  ) t
),
u7 AS (
  SELECT jsonb_build_object(
    'function_definer', p.prosecdef,
    'function_owner', pg_get_userbyid(p.proowner),
    'function_search_path', to_jsonb(p.proconfig),
    'products_rowsecurity', c.relrowsecurity,
    'products_rowsecurity_FORCED_must_be_false', c.relforcerowsecurity,
    'function_executes_granted_to', (
      SELECT string_agg(gra.grantee, ', ')
      FROM information_schema.role_function_grants gra
      WHERE gra.specific_schema = 'public'
        AND gra.routine_name = 'wemart_vendors_suspension_unpublish'
        AND gra.privilege_type = 'EXECUTE'
    )
  ) AS j
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_class c ON c.oid = 'public.products'::regclass
  WHERE n.nspname = 'public' AND p.proname = 'wemart_vendors_suspension_unpublish'
),
u8 AS (
  SELECT coalesce(jsonb_agg(v), '[]'::jsonb) AS j
  FROM (
    SELECT v.id AS vendor_id, v.account_status
    FROM public.vendors v
    WHERE v.account_status IN ('suspended', 'closed') ORDER BY v.id
  ) v
)
SELECT jsonb_build_object(
  'U1_suspended_active_remaining_expect_0', (SELECT j FROM u1),
  'U2_paused_rows_of_suspended_vendors', (SELECT j FROM u2),
  'U3_products_by_listing_status_after', (SELECT j FROM u3),
  'U4_orders_payments_lockdown_intact', (SELECT j FROM u4),
  'U5_suspension_trigger_on_vendors', (SELECT j FROM u5),
  'U6_all_triggers_coexistence_check', (SELECT j FROM u6),
  'U7_trigger_function_security_attributes', (SELECT j FROM u7),
  'U8_suspended_closed_vendors', (SELECT j FROM u8),
  'note', 'read-only verification — paste the whole JSON back for review'
) AS suspension_trigger_report;
