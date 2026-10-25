import { getSupabase } from '../lib/supabase'
import type { Campus, CategoryRef, Condition, Product } from '../types'

/**
 * Wemart's SINGLE database data-access layer — everything the UI reads
 * goes through here.
 *
 * Read-only contract (never loosen this from the browser):
 * - products: ONLY the `catalog` view (one row per offer).
 * - campuses: `locations` where location_type = 'campus'.
 * - categories: `categories` where is_active = true.
 * - NEVER query vendors, vendor_locations, buyers, orders or payments
 *   from the browser.
 *
 * All snake_case → camelCase mapping lives in this file in ONE place
 * (CatalogRow + rowToProduct). Prices arrive in naira and are rendered
 * as-is, never divided.
 */

export class ApiError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.cause = cause
  }
}

/** Columns of the `catalog` view (verified live) — one row per offer. */
export type CatalogRow = {
  offer_id: string
  product_id: string
  variant_id: string
  product_name: string
  variant_name: string | null
  brand: string | null
  description: string | null
  product_condition: string | null
  attributes: Record<string, unknown>
  price: number /* naira, not kobo */
  currency: string
  available_for_delivery: boolean
  available_quantity: number
  category_id: string
  category_name: string
  vendor_id: string
  vendor_name: string
  vendor_location_id: string
  location_name: string
  city: string
  state: string
  accepts_pickup: boolean
  campus_id: string | null
  campus_name: string | null
  image_path: string | null
  image_alt: string | null
  listed_at: string
}

const CATALOG_COLUMNS = [
  'offer_id',
  'product_id',
  'variant_id',
  'product_name',
  'variant_name',
  'description',
  'product_condition',
  'price',
  'available_quantity',
  'category_id',
  'category_name',
  'vendor_id',
  'vendor_name',
  'vendor_location_id',
  'location_name',
  'campus_id',
  'campus_name',
  'image_path',
  'image_alt',
  'listed_at',
].join(',')

const CONDITION_VALUES: Condition[] = [
  'new',
  'like-new',
  'used',
  'refurbished',
  'other',
]

/** Unknown/renamed condition strings collapse to 'other', never crash. */
function normalizeCondition(value: unknown): Condition {
  return CONDITION_VALUES.includes(value as Condition)
    ? (value as Condition)
    : 'other'
}

/* ---------------------------------------------------------------------- */
/* Images                                                                  */
/* ---------------------------------------------------------------------- */

const IMAGE_BUCKET = 'product-images'

/** Public URL for a row's image_path (placeholder when absent). */
function getPublicImageUrl(imagePath: string | null): string | undefined {
  if (!imagePath) return undefined
  const client = getSupabase()
  if (!client) return undefined
  return client.storage.from(IMAGE_BUCKET).getPublicUrl(imagePath).data
    ?.publicUrl
}

/* ---------------------------------------------------------------------- */
/* The ONE snake_case → camelCase mapping                                   */
/* ---------------------------------------------------------------------- */

function rowToProduct(row: CatalogRow): Product {
  const quantity = row.available_quantity ?? 0
  return {
    id: row.offer_id,
    title: row.product_name,
    variantName: row.variant_name ?? undefined,
    price: row.price,
    category: row.category_name ?? 'Other',
    campus: row.campus_id ?? row.vendor_location_id,
    condition: normalizeCondition(row.product_condition),
    availability: quantity > 0 ? 'available' : 'sold',
    description: row.description ?? '',
    emoji: '📦',
    imageUrl: getPublicImageUrl(row.image_path ?? null),
    imageAlt: row.image_alt ?? undefined,
    vendor: row.vendor_name,
    /* Campus name when the offer sits on campus, else the location name */
    locationName: row.campus_name ?? row.location_name ?? undefined,
  }
}

/* ---------------------------------------------------------------------- */
/* Queries                                                                 */
/* ---------------------------------------------------------------------- */

/** Campus filter value or the location table's own id/name rows. */
export async function getCampuses(): Promise<Campus[]> {
  const client = getSupabase()
  if (!client) {
    throw new ApiError('Wemart is not connected to its database yet.')
  }
  const { data, error } = await client
    .from('locations')
    .select('id, name')
    .eq('location_type', 'campus')
    .order('name')
  if (error) {
    throw new ApiError(`Could not load campuses: ${error.message}`, error)
  }
  return (data ?? []) as unknown as Campus[]
}

/** Active categories for the chips (id + name). */
export async function getCategories(): Promise<CategoryRef[]> {
  const client = getSupabase()
  if (!client) {
    throw new ApiError('Wemart is not connected to its database yet.')
  }
  const { data, error } = await client
    .from('categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name')
  if (error) {
    throw new ApiError(`Could not load categories: ${error.message}`, error)
  }
  return (data ?? []) as unknown as CategoryRef[]
}

export type CatalogQuery = {
  campusId?: string
  categoryId?: string
  search?: string
  limit?: number
  offset?: number
}

export type CatalogPage = {
  items: Product[]
  /** Exact total matching the filters (for the count + pagination) */
  total: number
}

/** ilike treats % _ \ as pattern chars — strip them from user input. */
function escapeLikePattern(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&')
}

/**
 * One page of catalog offers: campus + category + name search filters
 * (AND), newest list date first, exact count included for pagination.
 */
export async function getCatalog(
  query: CatalogQuery = {},
): Promise<CatalogPage> {
  const client = getSupabase()
  if (!client) {
    throw new ApiError('Wemart is not connected to its database yet.')
  }

  const {
    campusId,
    categoryId,
    search,
    limit = 24,
    offset = 0,
  } = query

  let request = client
    .from('catalog')
    .select(CATALOG_COLUMNS, { count: 'exact' })

  if (campusId) request = request.eq('campus_id', campusId)
  if (categoryId) request = request.eq('category_id', categoryId)
  const term = (search ?? '').trim()
  if (term) {
    request = request.ilike(
      'product_name',
      `%${escapeLikePattern(term)}%`,
    )
  }
  request = request
    .order('listed_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await request
  if (error) {
    throw new ApiError(`Could not load items: ${error.message}`, error)
  }

  const rows = (data ?? []) as unknown as CatalogRow[]
  return {
    items: rows.map(rowToProduct),
    total: count ?? offset + rows.length,
  }
}
