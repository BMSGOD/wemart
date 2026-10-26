-- ============================================================================
-- Wemart — 0005 RLS INSPECTION (READ-ONLY — safe to run any time, any role)
-- database/0005_rls_inspection.sql
--
-- Purpose: resolve the outstanding security question from the handoff —
-- the `orders`, `payments`, `order_items` tables currently answer the
-- anonymous (publishable-key) REST requesters with HTTP 200 + empty
-- arrays. That is harmless while they hold zero rows, but the access
-- rules must be known (and where necessary locked down) BEFORE real
-- order data exists.
--
-- Nothing here writes anything. Run in the Supabase SQL Editor
-- (owner session) and share ALL output including "no rows".
-- ============================================================================

-- A — Every RLS policy on the three sensitive tables
--     (expect: either no rows => no policies exist, or permissive
--     policies limited to an authenticated role — never 'anon' wide-open)
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'payments', 'order_items')
ORDER BY tablename, policyname;

-- B — Whether RLS is switched ON for each of the three tables
--     (expect: rowsecurity = true for all three; false = nothing protects
--     the table except grants, which part C then shows)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'payments', 'order_items')
ORDER BY tablename;

-- C — What the anonymous role is actually permitted (grants view);
--     combined with B this explains the current HTTP-200-empty behaviour
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('orders', 'payments', 'order_items')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- --------------------------------------------------------------------------
-- OPTIONAL EXTENSION — full public-readable-table audit (recommended once,
-- answers "what can the anon key see at all?"). Output can be long.
-- --------------------------------------------------------------------------
-- D — All policies on every table the anon key may touch
-- SELECT tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- E — rowsecurity state of every table
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
