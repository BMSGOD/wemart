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

/** The vendor's own product rows (confirmed: id, vendor_id, listing_status).
 *  RECONCILED to the completed 0010 inspection: four public SELECT policies
 *  keep marketplace rows browsable, so a bare .select('*') would also return
 *  OTHER vendors' public listings to the dashboard. The caller's own vendor
 *  id (from getVendorProfile) scopes the read deterministically — the RLS
 *  policy still re-derives ownership on the server. */
export type VendorProductRow = Record<string, unknown> & {
  id?: string
  vendor_id?: string
  listing_status?: string
}

export async function listVendorProducts(vendorId: string): Promise<VendorProductRow[]> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('vendor_id', vendorId)
    .limit(200)
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

export async function listVendorLocations(vendorId: string): Promise<VendorLocationRow[]> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  // Public SELECT policies keep ALL vendors' location rows browsable, so
  // this read — like listVendorProducts — MUST filter to the caller's own
  // vendor id; the RLS policy re-derives ownership server-side regardless.
  const { data, error } = await supabase
    .from('vendor_locations')
    .select('*')
    .eq('vendor_id', vendorId)
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
/* Product publishing — confirmed columns ONLY (listing_status).     */
/* Vocabulary from the verified 0010 output: draft/active/paused/    */
/* sold_out/removed. Eligibility for 'active' is enforced SERVER-    */
/* SIDE by 0013's wemart_vendor_can_publish() (confirmed email +     */
/* account not suspended/closed) — this layer only sends the write;  */
/* an ineligible attempt fails loudly as 42501, never silently.      */
/* Name/price/quantity/image base columns are STILL unknown (0011    */
/* dump pending) — no field beyond listing_status is ever written.   */
/* -------------------------------------------------------------- */

export type ProductListingStatus = 'draft' | 'active' | 'paused' | 'sold_out' | 'removed'

const LISTING_STATUSES: readonly string[] = [
  'draft',
  'active',
  'paused',
  'sold_out',
  'removed',
]

/** Create a draft listing shell. Sends ONLY the confirmed columns
 *  (vendor_id + listing_status='draft') — nothing invented; if the live
 *  table requires more (e.g. a NOT NULL name), the Postgres error
 *  surfaces honestly instead of a fabricated field being guessed. */
export async function createProductDraft(vendorId: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  // RLS (0008 products_insert_own + 0013 gate) re-derives ownership; the
  // vendor_id is the caller's own row id from getVendorProfile().id.
  const { error } = await supabase
    .from('products')
    .insert({ vendor_id: vendorId, listing_status: 'draft' })
  if (error) throw toVendorDataError(error)
}

/** Flip a listing's status. Sends ONLY listing_status; both .eq filters
 *  are belt-and-braces on top of the 0008/0013 RLS ownership joins:
 *  .eq('id', …) targets the exact row, .eq('vendor_id', …) re-asserts
 *  the caller owns it. When status is 'active' the server re-checks
 *  publishing eligibility — a blocked vendor gets 42501, not silence. */
export async function setProductListingStatus(
  vendorId: string,
  productId: string,
  status: ProductListingStatus,
): Promise<void> {
  if (!LISTING_STATUSES.includes(status)) {
    throw toVendorDataError({ message: `Unknown listing status "${status as string}"` })
  }
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  const { error } = await supabase
    .from('products')
    .update({ listing_status: status })
    .eq('id', productId)
    .eq('vendor_id', vendorId)
  if (error) throw toVendorDataError(error)
}

/* -------------------------------------------------------------- */
/* Product CRUD — CONFIRMED COLUMNS ONLY (0011 live results, pasted  */
/* 2026-10-27):                                                     */
/*   products        : id, vendor_id, category_id, name (NOT NULL),  */
/*                     description, brand, product_condition         */
/*                     (default 'new'), listing_status (default      */
/*                     'draft'), created_at, updated_at              */
/*   product_variants: id, product_id (FK→products.id, ON DELETE     */
/*                     RESTRICT), sku, variant_name, attributes      */
/*                     JSONB, price NUMERIC NOT NULL CHECK >= 0,     */
/*                     currency TEXT default 'NGN' CHECK 'NGN',      */
/*                     is_active, created_at, updated_at             */
/* condition values: new | used | refurbished | other               */
/* listing values:   draft | active | paused | sold_out | removed   */
/* Everything here writes ONLY these columns — price lives on the   */
/* VARIANT, never on the product (no such column exists).           */
/* -------------------------------------------------------------- */

export type ProductCondition = 'new' | 'used' | 'refurbished' | 'other'

const CONDITIONS: readonly string[] = ['new', 'used', 'refurbished', 'other']

/** Payload for a new listing. Optional string fields that arrive empty are
 *  OMITTED (never sent as '' or null guesses) — the DB's own defaults fill
 *  confirmed columns, and unconfirmed columns are never touched. */
export type ProductFormInput = {
  name: string
  categoryId?: string
  condition?: ProductCondition
  brand?: string
  description?: string
}

/** Create the product row (draft). Returns its id so the caller can attach
 *  the first priced variant in a SECOND request — PostgREST gives no
 *  cross-table transaction here, so atomicity is never assumed: if the
 *  the variant write fails, the draft (price-less) product persists and the
 *  UI tells the vendor to set the price on the row instead. */
export async function createListingDraft(
  vendorId: string,
  input: ProductFormInput,
): Promise<{ id: string }> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  const name = input.name.trim()
  if (!name) throw toVendorDataError({ message: 'Listing name is required' })
  const payload: Record<string, unknown> = {
    vendor_id: vendorId,
    name,
    listing_status: 'draft',
  }
  if (input.categoryId) payload.category_id = input.categoryId
  if (input.condition && CONDITIONS.includes(input.condition)) {
    payload.product_condition = input.condition
  }
  if (input.brand?.trim()) payload.brand = input.brand.trim()
  if (input.description?.trim()) payload.description = input.description.trim()
  // Returning 'id' requires the own-row SELECT policy — satisfied (0008).
  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw toVendorDataError(error)
  const id = (data as { id?: unknown } | null)?.id
  return { id: id != null ? String(id) : '' }
}

/** Attach the first priced variant. Sends ONLY price (naira AS-IS, never
 *  kobo-divided) + product_id + an optional variant label; currency is not
 *  sent (its DEFAULT 'NGN' + CHECK are confirmed), sku/attributes unconfirmed
 *  semantics are never invented. */
export async function createProductVariant(
  productId: string,
  price: number,
  variantName?: string,
): Promise<void> {
  if (!Number.isFinite(price) || price < 0) {
    throw toVendorDataError({ message: 'Price must be a number of 0 or more' })
  }
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  const payload: Record<string, unknown> = { product_id: productId, price }
  if (variantName?.trim()) payload.variant_name = variantName.trim()
  const { error } = await supabase
    .from('product_variants')
    .insert(payload)
  if (error) throw toVendorDataError(error)
}

const PRODUCT_EDITABLE_COLUMNS = [
  'name', 'description', 'brand', 'category_id', 'product_condition',
] as const

/** Edit a listing's confirmed text fields. The patch is filtered to the
 *  five editable columns (listing_status has its own dedicated setter,
 *  created_at/updated_at belong to the DB); both .eq filters bind the exact
 *  row and caller ownership — the RLS WITH CHECK re-derives both anyway. */
export async function updateListingDetails(
  vendorId: string,
  productId: string,
  patch: {
    name?: string
    description?: string
    brand?: string
    categoryId?: string
    condition?: ProductCondition
  },
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  const payload: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim()
    if (!trimmed) throw toVendorDataError({ message: 'Listing name is required' })
    payload.name = trimmed
  }
  if (patch.description !== undefined) payload.description = patch.description.trim()
  if (patch.brand !== undefined) payload.brand = patch.brand.trim()
  if (patch.categoryId !== undefined) payload.category_id = patch.categoryId
  if (patch.condition !== undefined) {
    if (!CONDITIONS.includes(patch.condition)) {
      throw toVendorDataError({ message: `Unknown condition "${patch.condition}"` })
    }
    payload.product_condition = patch.condition
  }
  if (!Object.keys(payload).length) return // nothing to write — never send {}
  void PRODUCT_EDITABLE_COLUMNS // (documents the allow-list this enforces)
  const { error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', productId)
    .eq('vendor_id', vendorId)
  if (error) throw toVendorDataError(error)
}

export type VariantRow = Record<string, unknown> & {
  id?: string
  product_id?: string
  price?: number | null
  variant_name?: string | null
  is_active?: boolean | null
}

/** Read the caller's OWN variants for the caller's OWN product ids (ids come
 *  from listVendorProducts, itself vendor_id-scoped). .in() is required —
 *  a bare table-wide read would return every vendor's prices. */
export async function listVariantsForProducts(
  productIds: string[],
): Promise<VariantRow[]> {
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  if (productIds.length === 0) return []
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .in('product_id', productIds)
  if (error) throw toVendorDataError(error)
  return (data as VariantRow[]) ?? []
}

/** Price edit on ONE variant. variants carry no vendor_id column (never
 *  invented), so the binding is: RLS ownership via product_id → products →
 *  vendors, plus the explicit .eq('product_id') always pointing at a
 *  product this vendor owns. Price is naira as-is; the DB CHECK
 *  (price >= 0) is the final guard. */
export async function updateVariantPrice(
  productId: string,
  variantId: string,
  price: number,
): Promise<void> {
  if (!Number.isFinite(price) || price < 0) {
    throw toVendorDataError({ message: 'Price must be a number of 0 or more' })
  }
  const supabase = getSupabase()
  if (!supabase) throw toVendorDataError({ message: 'supabase client missing' })
  const { error } = await supabase
    .from('product_variants')
    .update({ price })
    .eq('id', variantId)
    .eq('product_id', productId)
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
