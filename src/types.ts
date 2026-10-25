export type Campus = {
  id: string
  name: string
}

/**
 * A DB category row — `categories` where is_active = true (id + name).
 * Category chips filter by id, display by name.
 */
export type CategoryRef = {
  id: string
  name: string
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
  featured?: boolean
  description: string
  emoji: string /* CSS placeholder shown when no storage image exists */
  /** Public Supabase Storage URL built from the row's image_path */
  imageUrl?: string
  imageAlt?: string
  /** Vendor display name (public info from the catalog view) */
  vendor: string
  /** Campus name, falling back to the pickup location name */
  locationName?: string
  /** Retired: no verified flag exists in the live DB yet */
  verified?: boolean
}
