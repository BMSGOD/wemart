import { useMemo, useState } from 'react'
import Header from './components/Header'
import CampusPicker from './components/CampusPicker'
import SearchBox from './components/SearchBox'
import CategoryButtons from './components/CategoryButtons'
import ProductGrid from './components/ProductGrid'
import { searchProducts, getFeatured, DATA_SOURCE_LABEL } from './lib/catalog'
import type { Category } from './types'

export default function App() {
  const [campus, setCampus] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')

  const catalogQuery = useMemo(
    () => ({ campus, category, query }),
    [campus, category, query],
  )
  const products = useMemo(
    () => searchProducts(catalogQuery),
    [catalogQuery],
  )
  const featured = useMemo(() => getFeatured(), [])

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header />

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {/* Hero: campus + search */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h1 className="text-base font-bold text-slate-900">
            Find what you need on your campus
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Buy &amp; sell with students across Nigerian campuses — safe meetups,
            fair prices.
          </p>
          <div className="mt-3 space-y-3">
            <CampusPicker value={campus} onChange={setCampus} />
            <SearchBox value={query} onChange={setQuery} />
          </div>
        </section>

        <CategoryButtons value={category} onChange={setCategory} />

        {/* Featured — shown unfiltered, programmatic picks from the data layer */}
        {featured.length > 0 && (
          <section aria-labelledby="featured-heading">
            <h2
              id="featured-heading"
              className="mb-2 text-sm font-bold text-slate-900"
            >
              Featured
            </h2>
            <ProductGrid products={featured} compact />
          </section>
        )}

        {/* Full catalog with filters applied */}
        <section aria-labelledby="catalog-heading">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="catalog-heading" className="text-sm font-bold text-slate-900">
              All items
            </h2>
            <p className="text-xs text-slate-500" aria-live="polite">
              {products.length} {products.length === 1 ? 'item' : 'items'} found
            </p>
          </div>
          <ProductGrid products={products} />
          <p className="mt-3 text-center text-[11px] text-slate-400">
            {DATA_SOURCE_LABEL}
          </p>
        </section>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-slate-400">
        Wemart — demo build. Sample data only; payments are not implemented.
      </footer>
    </div>
  )
}
