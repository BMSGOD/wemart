import type { Product } from '../types'
import ProductCard from './ProductCard'

type Props = {
  products: Product[]
  /** Smaller two-column layout for featured rows */
  compact?: boolean
  /** 'grid' (default) or 'list' — results pages toggle between the two;
   *  list is the calmer, Etsy-style default for search/category results */
  layout?: 'grid' | 'list'
}

/** Card grid or compact list rows — empty/notice states live in HomePage. */
export default function ProductGrid({ products, compact = false, layout = 'grid' }: Props) {
  if (layout === 'list') {
    return (
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {products.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} layout="list" />
          </li>
        ))}
      </ul>
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
