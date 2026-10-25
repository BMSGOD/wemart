import type { Product } from '../types'
import ProductCard from './ProductCard'

type Props = {
  products: Product[]
  /** Smaller two-column layout for featured rows */
  compact?: boolean
  /** Message shown when the filtered list is empty */
  emptyMessage?: string
  /** When provided, the empty state offers a "Clear filters" action */
  onClearFilters?: () => void
}

export default function ProductGrid({
  products,
  compact = false,
  emptyMessage = 'No items here yet. Be the first to sell on this campus.',
  onClearFilters,
}: Props) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white px-4 py-10 text-center">
        <p className="text-2xl" aria-hidden="true">
          🛒
        </p>
        <p className="mt-2 text-sm font-medium text-ink">{emptyMessage}</p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="hard-shadow mt-3 rounded-lg bg-orange px-4 py-2 text-sm font-bold text-ink transition hover:bg-orange-deep hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0"
          >
            Clear filters
          </button>
        )}
      </div>
    )
  }

  return (
    <ul
      className={
        compact
          ? 'grid grid-cols-2 gap-3 lg:grid-cols-4'
          : 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
      }
    >
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  )
}
