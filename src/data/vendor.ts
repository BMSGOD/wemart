import { getSupabase } from '../lib/supabase'

/**
 * Vendor dashboard data layer — the second Supabase data surface after
 * src/data/api.ts (catalog browsing).
 *
 * RULE AMENDMENT (auth phase): src/lib/supabase.ts's "never read vendors /
 * buyers from the browser" was written for the *public, anonymous* browsing
 * context. A signed-in vendor reading/writing only their OWN vendors row
 * and products is a different, protected path — gated by the 0008 RLS
 * policies (own-row, auth_user_id = auth.uid()) and never widening public
 * access. orders / payments / order_items remain out of bounds.
 *
 * COLUMN FACTS (verified live schema, 2026-10-27 — owner 0009 results):
 *   vendors : id, auth_user_id (nullable), business_name (NOT NULL),
 *             display_name, account_status (default 'pending')
 *   buyers  : id, auth_user_id, display_name, whatsapp_number,
 *             default_location_id, default_campus_id
 *   products: id, vendor_id (required), listing_status (default 'draft')
 * KNOWN-UNKNOWN: FKs/unique constraints behind those names are NOT
 * confirmed; products quantity/price base columns are unknown (they live
 * in the catalog view's composition) ⇒ NO quantity writes here —
 * inventory editing is read-only pending owner-confirmed columns.
 *
 * Nothing assumes the 0008 policies exist yet: every call maps Postgres
 * 42501("permission denied") to the sentinel "policies-pending" kind so
 * the dashboard renders an honest review-required banner, not a crash.
 */

export type VendorDataErrorKind = 'auth' | 'policies-pending' | 'no-profile' | 'other'

export type VendorDataError = Error & { kind: VendorDataErrorKind; code?: string }

function classify(supabaseMessage: string, code?: string): VendorDataErrorKind {
  if (supabaseMessage.includes('42501') || /permission denied|row-level security/i.test(supabaseMessage)) {
    return 'policies-pending'
  }
  if (code === 'PGRST116' || /no rows|not found/i.test(supabaseMessage)) {
    return 'no-profile'
  }
  return 'other'
}

export function toVendorDataError(error: unknown): VendorDataError {
  const err = error as { message?: string; code?: string } | null
  const e = new Error(err?.message ?? 'Unknown vendor data error') as VendorDataError
  e.kind = classify(String(err?.code ?? '') + ' ' + (err?.message ?? ''), err?.code)
  e.code = err?.code
  return e
}

/** Sentinel helper — the dashboards key their "pending approval" UI on this. */
export function isPoliciesPending(error: unknown): boolean {
  return (error as VendorDataError | null)?.kind === 'policies-pending'
}

/**
 * The vendor's own profile row (RLS returns only rows linked to the caller
 * once 0008 runs). Raw record: decouple the UI from column drift.
 */
export type VendorProfile = Record<string, unknown> & {
  id?: string
  business_name?: string
  display_name?: string
  account_status?: string
}

export async function getVendorProfile(): Promise<VendorProfile | null> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) throw toVendorDataError(error)
  return (data as VendorProfile) ?? null
}

/** Profile save — verified columns ONLY (business_name / display_name).
 *  account_status live values are unconfirmed; never written here.
 *  authUid (the signed-in user's id from useAuth) adds an explicit
 *  WHERE auth_user_id = … on top of the 0008 RLS scoping — belt and
 *  braces, and avoids a filterless UPDATE. */
export async function saveVendorProfile(
  patch: {
    business_name?: string
    display_name?: string
  },
  authUid?: string,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  // RLS (0008, when approved) scopes the UPDATE to the caller's own row and
  // re-asserts auth_user_id = auth.uid(); the explicit .eq() repeats it.
  const builder = supabase.from('vendors').update(patch)
  const result = authUid
    ? await builder.eq('auth_user_id', authUid)
    : await builder
  if (result.error) throw toVendorDataError(result.error)
}

/** The vendor's own product rows (confirmed: id, vendor_id, listing_status). */
export type VendorProductRow = Record<string, unknown> & {
  id?: string
  vendor_id?: string
  listing_status?: string
}

export async function listVendorProducts(): Promise<VendorProductRow[]> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  const { data, error } = await supabase.from('products').select('*').limit(200)
  if (error) throw toVendorDataError(error)
  return (data as VendorProductRow[]) ?? []
}

/* -------------------------------------------------------------- */
/* Vendor store locations (verified cols: id, vendor_id,           */
/* campus_location_id NULLable). Multi-row: directory covers each.  */
/* -------------------------------------------------------------- */

export type VendorLocationRow = Record<string, unknown> & {
  id?: string
  campus_location_id?: string | null
}

export async function listVendorLocations(): Promise<VendorLocationRow[]> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  const { data, error } = await supabase
    .from('vendor_locations')
    .select('*')
    .limit(50)
  if (error) throw toVendorDataError(error)
  return (data as VendorLocationRow[]) ?? []
}

export async function addVendorLocation(
  vendorId: string,
  campusLocationId: string,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  // RLS (0008 Part 5) re-derives vendor ownership: caller's own vendor only.
  const { error } = await supabase
    .from('vendor_locations')
    .insert({ vendor_id: vendorId, campus_location_id: campusLocationId })
  if (error) throw toVendorDataError(error)
}

export async function removeVendorLocation(rowId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  const { error } = await supabase
    .from('vendor_locations')
    .delete()
    .eq('id', rowId)
  if (error) throw toVendorDataError(error)
}

/* -------------------------------------------------------------- */
/* Buyer profile (verified cols only: display_name, whatsapp_number)*/
/* -------------------------------------------------------------- */

export type BuyerProfile = Record<string, unknown> & {
  id?: string
  display_name?: string
  whatsapp_number?: string
}

export async function getBuyerProfile(): Promise<BuyerProfile | null> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  const { data, error } = await supabase
    .from('buyers')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) throw toVendorDataError(error)
  return (data as BuyerProfile) ?? null
}

export async function saveBuyerProfile(
  patch: {
    display_name?: string
    whatsapp_number?: string
  },
  authUid?: string,
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  // RLS (0008 Part 3) scopes to the caller's own row; the explicit filter
  // repeats the binding and avoids a filterless UPDATE.
  const builder = supabase.from('buyers').update(patch)
  const result = authUid ? await builder.eq('auth_user_id', authUid) : await builder
  if (result.error) throw toVendorDataError(result.error)
}
