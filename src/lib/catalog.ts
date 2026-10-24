import { CAMPUSES, PRODUCTS } from '../data/sample-data'
import type { Category, Product } from '../types'

export { CAMPUSES }

/* Catalog access layer — the ONLY place components read listing data from.
 *
 * Version 1 reads hardcoded sample data. When the Supabase schema and
 * security policies are finalized, each function below is reimplemented
 * against the API without touching components or their props.
 */

export type CatalogQuery = {
  campus?: string /* Campus.id or 'all' */
  category?: Category | 'all'
  query?: string /* free text over title + description */
}

export function searchProducts(
  catalogQuery: CatalogQuery = {},
): Product[] {
  const {
    campus = 'all',
    category = 'all',
    query = '',
  } = catalogQuery

  const q = query.trim().toLowerCase()
  return PRODUCTS.filter((p) => {
    if (campus !== 'all' && p.campus !== campus) return false
    if (category !== 'all' && p.category !== category) return false
    if (q && !`${p.title} ${p.description}`.toLowerCase().includes(q)) {
      return false
    }
    return true
  })
}

export function getFeatured(): Product[] {
  return PRODUCTS.filter((p) => p.featured)
}

/* Caption shown on cards/empty states: sample data, not live listings. */
export const DATA_SOURCE_LABEL = 'Sample products — demo data, not live listings'
