import type { Product } from '../types'
import ProductCard from './ProductCard'

type Props = {
  products: Product[]
  /** Smaller two-column layout for featured rows */
  compact?: boolean
}

/** Just a responsive card grid — empty/notice states live in App.tsx. */
export default function ProductGrid({ products, compact = false }: Props) {
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
