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
 * - products: ONLY the `catalog` view (one row per offer).
 * - locations: ONLY the `campus_directory` view — the app uses a
 *   STATE → CAMPUS model with no city/region tiers.
 * - categories: `categories` where is_active = true.
 * - nearby discovery: the `catalog_near_campus` RPC.
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
  /* STATE → CAMPUS model: city/state/location columns are ignored */
  campus_id: string | null
  campus_name: string | null
  campus_state_id: string | null
  campus_state_name: string | null
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
  'campus_id',
  'campus_name',
  'campus_state_id',
  'campus_state_name',
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
  /** Offer ids to drop from the result (e.g. already-visible items) */
  excludeIds?: string[]
  sort?: 'newest' | 'price-asc' | 'price-desc'
  limit?: number
  offset?: number
}

export type CatalogPage = {
  items: Product[]
  /** Exact total matching the filters, when the endpoint provides one */
  total: number
}

/** ilike treats % _ \ as pattern chars — strip them from user input. */
function escapeLikePattern(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&')
}

/**
 * One page of catalog offers: campus / state + category + name search
 * filters (AND), newest list date first, exact count for pagination.
 * Campus beats state: when both arrive, only campus_id is applied.
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
    excludeIds,
    sort,
    limit = 24,
    offset = 0,
  } = query

  let request = client
    .from('catalog')
    .select(CATALOG_COLUMNS, { count: 'exact' })

  /* Drop already-visible offers (used by recommendations to avoid
     duplicating the "New arrivals" strip on screen) */
  if (excludeIds && excludeIds.length > 0) {
    request = request.not('offer_id', 'in', `(${excludeIds.join(',')})`)
  }

  if (campusId) {
    request = request.eq('campus_id', campusId)
  } else if (stateId) {
    request = request.eq('campus_state_id', stateId)
  }
  /* Strict database-side category filtering: a top-level selection
     matches itself AND its children via IN; a sub-category matches only
     itself (items without a category only ever appear under "All")
     — never filtered in the browser afterwards. */
  if (categoryIds && categoryIds.length > 0) {
    request = request.in('category_id', categoryIds)
  }
  if (condition) request = request.eq('product_condition', condition)
  if (typeof minPrice === 'number') request = request.gte('price', minPrice)
  if (typeof maxPrice === 'number') request = request.lte('price', maxPrice)
  if (inStock) request = request.gt('available_quantity', 0)
  const term = (search ?? '').trim()
  if (term) {
    request = request.ilike(
      'product_name',
      `%${escapeLikePattern(term)}%`,
    )
  }
  /* Every sort keeps a deterministic tiebreaker chain so "Load more"
     pages stay stable as filters combine */
  if (sort === 'price-asc') {
    request = request
      .order('price', { ascending: true })
      .order('listed_at', { ascending: false })
      .order('offer_id', { ascending: false })
  } else if (sort === 'price-desc') {
    request = request
      .order('price', { ascending: false })
      .order('listed_at', { ascending: false })
      .order('offer_id', { ascending: false })
  } else {
    request = request
      .order('listed_at', { ascending: false })
      .order('offer_id', { ascending: false })
  }
  request = request.range(offset, offset + limit - 1)

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

/**
 * Nearby discovery via the `catalog_near_campus` RPC: rows ordered by the
 * same campus first, then campuses in the same state, then everything
 * else — newest list date first within each tier. Used for the
 * "Also show other campuses in {state}" expansion. No category filter
 * exists on the function, so it is only used without category filters.
 */
export async function getNearCampus(query: {
  campusId: string
  search?: string
  limit?: number
  offset?: number
}): Promise<CatalogPage> {
  const client = getSupabase()
  if (!client) {
    throw new ApiError('Wemart is not connected to its database yet.')
  }

  const {
    campusId,
    search,
    limit = 24,
    offset = 0,
  } = query

  const { data, error } = await client.rpc('catalog_near_campus', {
    p_campus_id: campusId,
    p_search: (search ?? '').trim() || null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) {
    throw new ApiError(`Could not load nearby items: ${error.message}`, error)
  }

  const rows = (data ?? []) as unknown as CatalogRow[]
  /* The RPC returns no exact count — pagination uses "have more rows"
     heuristics on the offset (fewer rows than requested = end of list). */
  return {
    items: rows.map(rowToProduct),
    total: offset + rows.length,
  }
}

/**
 * Recommendation pool for empty filtered views: genuinely available offers
 * (available_quantity > 0) from ANY category, ranked by proximity tier
 * first and cheapest price second:
 *   tier 1 — the user's selected campus,
 *   tier 2 — other campuses in the user's selected state,
 *   tier 3 — everywhere else.
 * Tiers use the location hierarchy ONLY (campus → state → nationwide) and
 * never claim geographic distance. Search/category/condition filters are
 * deliberately dropped here; duplicates are removed by offer id. Card
 * location labels stay truthful per card.
 */
export async function getRecommended(
  query: {
    campusId?: string
    stateId?: string
    /** Offers already on screen (e.g. "New arrivals") — excluded */
    excludeIds?: string[]
    limit?: number
  } = {},
): Promise<Product[]> {
  const limit = query.limit ?? 12

  const fetchTier = async (tier: {
    campusId?: string
    stateId?: string
  }): Promise<Product[]> => {
    const page = await getCatalog({
      ...tier,
      inStock: true,
      sort: 'price-asc',
      excludeIds: query.excludeIds,
      limit,
    })
    return page.items
  }

  /* Tiers run sequentially so an exhausted earlier tier still fills the
     pool from the next one; dedupe keeps the strict rank order. */
  const seen = new Set<string>()
  const out: Product[] = []
  const tiers: Array<{ campusId?: string; stateId?: string }> = []
  if (query.campusId) tiers.push({ campusId: query.campusId })
  if (query.stateId) tiers.push({ stateId: query.stateId })
  tiers.push({})

  for (const tier of tiers) {
    const items = await fetchTier(tier)
    for (const product of items) {
      if (seen.has(product.id)) continue
      seen.add(product.id)
      out.push(product)
      if (out.length >= limit) return out
    }
  }
  return out
}
