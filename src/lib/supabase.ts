import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase browser client — the single place it is created.
 *
 * PUBLISHABLE (anon) key only: it is public by design and protected by RLS.
 * NEVER put a service_role key or any other secret here or in a VITE_ env
 * var — everything in the frontend bundle is world-readable. Browsing
 * access (src/data/api.ts) is read-only against the `catalog` view plus
 * the locations/categories directories.
 *
 * AUTH-PHASE EXCEPTION (v2): src/lib/auth.tsx talks to Supabase Auth
 * unconditionally, and src/data/vendor.ts reads/writes ONLY the signed-in
 * vendor's own rows (`vendors`, `products`) or the signed-in buyer's own
 * `buyers` row — every such query is scoped by the 0008 RLS policies and
 * surfaces a "policies pending" state while they are unapproved.
 * `vendor_locations`, `orders` and `payments` remain never-read.
 *
 * Config (real values live in `.env.local`, which is gitignored; template
 * in `.env.example`):
 *   VITE_SUPABASE_URL  e.g. https://<project-ref>.supabase.co
 *   VITE_SUPABASE_KEY  the publishable/anon key
 *
 * When either variable is missing the app shows the friendly
 * "Wemart is being set up" screen (src/components/SetupNotice.tsx)
 * instead of attempting broken database calls.
 */
const VITE_ENV = import.meta.env as Record<string, string | undefined>

const SUPABASE_URL = VITE_ENV['VITE_SUPABASE_URL']?.trim()
const SUPABASE_KEY = VITE_ENV['VITE_SUPABASE_KEY']?.trim()

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)

let client: SupabaseClient | null = null

/** Returns the shared browser client, or null when not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  if (client === null) {
    client = createClient(
      SUPABASE_URL as string,
      SUPABASE_KEY as string,
      {
        auth: {
          // Read-only discovery; no sessions are needed yet.
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )
  }
  return client
}

/** Caption for the connected state shown under the grid. */
export const DATA_SOURCE_DB_LABEL = 'Live listings — Supabase'
