import type { Product } from '../types'
import ProductCard from './ProductCard'

type Props = {
  products: Product[]
  /** Smaller two-column layout for featured rows */
  compact?: boolean
}

export default function ProductGrid({ products, compact = false }: Props) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white px-4 py-10 text-center">
        <p className="text-2xl" aria-hidden="true">
          🛒
        </p>
        <p className="mt-2 text-sm font-medium text-ink">
          No items here yet. Be the first to sell on this campus.
        </p>
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
