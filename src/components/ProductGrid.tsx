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
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
        <p className="text-2xl">🛒</p>
        <p className="mt-2 text-sm font-medium text-slate-700">
          No items match your filters
        </p>
        <p className="text-xs text-slate-500">
          Try another campus, category, or search term.
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
