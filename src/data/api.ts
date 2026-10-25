import { getSupabase } from '../lib/supabase'
import type {
  CampusDirectoryEntry,
  CategoryRef,
  Condition,
  Product,
} from '../types'

/**
 * Wemart's SINGLE database data-access layer — everything the UI reads
 * goes through here.
 *
 * Read-only contract (never loosen this from the browser):
 * - products: ONLY via the `catalog_search` RPC (reads the catalog view
 *   server-side, one row per offer, tier-ordered same campus → same
 *   state → everywhere else). The catalog view is never queried from
 *   the browser directly.
 * - locations: ONLY the `campus_directory` view — the app uses a
 *   STATE → CAMPUS model with no city/region tiers.
 * - categories: `categories` where is_active = true.
 * - NEVER query vendors, vendor_locations, buyers, orders or payments
 *   from the browser. The catalog view's `city`/`state` columns are
 *   IGNORED — location comes from campus + campus_state columns only.
 *
 * All snake_case → camelCase mapping lives in this file in ONE place
 * (rowToProduct / directory mapper). Prices arrive in naira and are
 * rendered as-is, never divided.
 */

export class ApiError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.cause = cause
  }
}

/** Columns of a `catalog_search` row (the live catalog view shape). */
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
  /* STATE → CAMPUS model: city/state/location columns are ignored */
  campus_id: string | null
  campus_name: string | null
  campus_state_id: string | null
  campus_state_name: string | null
  image_path: string | null
  image_alt: string | null
  listed_at: string
}

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
    /* Campus id for result scope grouping (may be absent on data-gap rows) */
    campusId: row.campus_id ?? undefined,
    /* Location card line: campus + its parent state, e.g. "ABU, Kaduna".
       (`city`/`state` columns are deliberately not read.) */
    campusName: row.campus_name ?? undefined,
    campusStateId: row.campus_state_id ?? undefined,
    campusStateName: row.campus_state_name ?? undefined,
  }
}

/** campus_directory row → CampusDirectoryEntry (snake → camel, mapped here). */
function rowToCampus(row: {
  campus_id: string
  campus_name: string
  state_id: string
  state_name: string
}): CampusDirectoryEntry {
  return {
    id: row.campus_id,
    name: row.campus_name,
    stateId: row.state_id,
    stateName: row.state_name,
  }
}

/* ---------------------------------------------------------------------- */
/* Queries                                                                 */
/* ---------------------------------------------------------------------- */

/** Campus filter value or the location table's own id/name rows. */
export async function getCampusDirectory(): Promise<CampusDirectoryEntry[]> {
  const client = getSupabase()
  if (!client) {
    throw new ApiError('Wemart is not connected to its database yet.')
  }
  const { data, error } = await client
    .from('campus_directory')
    .select('campus_id, campus_name, state_id, state_name')
    .order('campus_name')
  if (error) {
    throw new ApiError(`Could not load campuses: ${error.message}`, error)
  }
  const rows = (data ?? []) as unknown as Array<{
    campus_id: string
    campus_name: string
    state_id: string
    state_name: string
  }>
  return rows.map(rowToCampus)
}

/** Active categories for the chips (id + name). */
export async function getCategories(): Promise<CategoryRef[]> {
  const client = getSupabase()
  if (!client) {
    throw new ApiError('Wemart is not connected to its database yet.')
  }
  /* Two-level taxonomy: parent_category_id = null marks a top-level
     category; children sort below their parent via sort_order. */
  const { data, error } = await client
    .from('categories')
    .select('id, name, parent_category_id, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')
  if (error) {
    throw new ApiError(`Could not load categories: ${error.message}`, error)
  }
  const rows = (data ?? []) as unknown as Array<{
    id: string
    name: string
    parent_category_id: string
    sort_order: number
  }>
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    parentCategoryId: row.parent_category_id,
    sortOrder: row.sort_order,
  }))
}

export type CatalogQuery = {
  campusId?: string
  /** STATE → CAMPUS model: state-level filter when no campus is chosen */
  stateId?: string
  /** Strict db-side category set (top-level = itself + children, or a sub) */
  categoryIds?: string[]
  condition?: Condition
  /* Naira bounds, null = no bound */
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  search?: string
  sort?: 'newest' | 'price-asc' | 'price-desc'
  limit?: number
  offset?: number
}

export type CatalogPage = {
  items: Product[]
  /**
   * The RPC returns no exact count — this counts the rows loaded so far
   * (offset + rows of the latest page). Pair it with `hasMore`.
   */
  total: number
  /** True when the latest page came back full — "Load more" may exist */
  hasMore: boolean
}

/**
 * One page of catalog offers through the `catalog_search` RPC — the ONLY
 * product query. All filters are applied server-side (AND); rows come
 * back tier-ordered: chosen campus first, then the same state, then
 * everywhere else (within each tier, the p_sort ordering applies).
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
    stateId,
    categoryIds,
    condition,
    minPrice,
    maxPrice,
    inStock,
    search,
    sort = 'newest',
    limit = 24,
    offset = 0,
  } = query

  const { data, error } = await client.rpc('catalog_search', {
    p_campus_id: campusId ?? null,
    p_state_id: stateId ?? null,
    /* A top-level selection arrives expanded (top + children); a
       sub-category arrives as the single id. Strict, database-side. */
    p_category_ids:
      categoryIds && categoryIds.length > 0 ? categoryIds : null,
    /* Matches product names AND category names server-side */
    p_search: (search ?? '').trim() || null,
    p_condition: condition ?? null,
    p_min_price: typeof minPrice === 'number' ? minPrice : null,
    p_max_price: typeof maxPrice === 'number' ? maxPrice : null,
    p_in_stock_only: Boolean(inStock),
    p_sort:
      sort === 'price-asc'
        ? 'price_asc'
        : sort === 'price-desc'
          ? 'price_desc'
          : 'newest',
    p_limit: limit,
    p_offset: offset,
  })
  if (error) {
    throw new ApiError(`Could not load items: ${error.message}`, error)
  }

  const rows = (data ?? []) as unknown as CatalogRow[]
  return {
    items: rows.map(rowToProduct),
    total: offset + rows.length,
    /* A full page may have a follow-up; a short page is the end. */
    hasMore: rows.length === limit,
  }
}

/**
 * Fallback pool for an empty filtered view: ONE `catalog_search` call
 * with the location filters ONLY (no category, search, condition, price
 * or stock filters), so the RPC's own tier ordering (same campus → same
 * state → everywhere else) supplies the proximity ranking. Every card
 * keeps its true campus/state labels — recommendations are never
 * relabelled, and they are never blended into matching results.
 */
export async function getRecommended(
  query: {
    campusId?: string
    stateId?: string
    limit?: number
  } = {},
): Promise<Product[]> {
  const page = await getCatalog({
    /* Campus beats state — the tier ordering covers the state too */
    campusId: query.campusId,
    stateId: query.campusId ? undefined : query.stateId,
    limit: query.limit ?? 12,
  })
  return page.items
}
