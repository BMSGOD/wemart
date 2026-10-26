export type Campus = {
  id: string
  name: string
}

/**
 * campus_directory row — the dropdown source under the
 * STATE → CAMPUS location model (no city/region tiers).
 */
export type CampusDirectoryEntry = Campus & {
  stateId: string
  stateName: string
}

/**
 * A DB category row — `categories` where is_active = true.
 * Two levels: parent_category_id = null marks a top-level category.
 */
export type CategoryRef = {
  id: string
  name: string
  parentCategoryId: string | null
  sortOrder: number
}

/**
 * Live catalog values: 'new' | 'used' | 'refurbished' | 'other'.
 * 'like-new' exists only in the retained sample data (reference-only).
 */
export type Condition =
  | 'new'
  | 'like-new'
  | 'used'
  | 'refurbished'
  | 'other'

export type Availability = 'available' | 'reserved' | 'sold'

/** Sort orders supported by the catalog query (stable-order enforced) */
export type SortOption = 'newest' | 'price-asc' | 'price-desc'

/**
 * Full UI-side filter state — the single source shared by App and the
 * FilterSheet. All ids default to 'all'; prices are naira, null = not set.
 */
export type Filters = {
  stateId: string
  campusId: string
  categoryId: string
  subCategoryId: string
  condition: Condition | 'all'
  minPrice: number | null
  maxPrice: number | null
  inStock: boolean
  sort: SortOption
}

export const DEFAULT_FILTERS: Filters = {
  stateId: 'all',
  campusId: 'all',
  categoryId: 'all',
  subCategoryId: 'all',
  condition: 'all',
  minPrice: null,
  maxPrice: null,
  inStock: false,
  sort: 'newest',
}

export type Product = {
  /** Unique card id — a catalog view offer id (one row per offer) */
  id: string
  /** Product display name */
  title: string
  /** Variant name shown under the product name when present */
  variantName?: string
  /** Nigerian naira — the DB value as-is, never divided */
  price: number
  /** Category display name (DB `category_name`) */
  category: string
  /** Campus/location identifier the offer sits at */
  campus: string
  condition: Condition
  availability: Availability
  /** Stock count from the catalog's available_quantity — powers the honest
   *  stock labels ("n in stock" / "Only n left"); undefined when unknown */
  availableQuantity?: number
  featured?: boolean
  description: string
  emoji: string /* CSS placeholder shown when no storage image exists */
  /** Public Supabase Storage URL built from the row's image_path */
  imageUrl?: string
  imageAlt?: string
  /** Vendor display name (public info from the catalog view) */
  vendor: string
  /** Campus id of the offer (catalog `campus_id`) — used for scope grouping */
  campusId?: string
  /** Campus display name (catalog view `campus_name`) */
  campusName?: string
  /** Parent state of the campus (catalog view `campus_state_id/name`) */
  campusStateId?: string
  campusStateName?: string
  /** Retired: no verified flag exists in the live DB yet */
  verified?: boolean
}
