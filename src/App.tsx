import { useMemo, useState } from 'react'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import CampusPicker from './components/CampusPicker'
import SearchBox from './components/SearchBox'
import CategoryButtons from './components/CategoryButtons'
import ProductGrid from './components/ProductGrid'
import Starburst from './components/Starburst'
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
    <div className="min-h-dvh bg-surface">
      <Header campus={campus} onCampusChange={setCampus} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        {/* Hero: memorable headline + the two primary pickers */}
        <section className="relative overflow-hidden rounded-lg border border-border bg-white p-5 sm:p-8">
          {/* One large cropped starburst, matching the logo motif */}
          <Starburst
            size={340}
            className="pointer-events-none absolute -top-24 -right-24 text-orange-tint sm:-top-32 sm:-right-20"
          />

          <div className="relative">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Buy and sell on campus.
            </h1>
            <p className="mt-2 max-w-md text-sm text-ink/70 sm:text-base">
              Phones, books, furniture and more from verified student vendors
              across Nigerian campuses. Safe meetups, fair prices.
            </p>

            <div className="mt-5 max-w-sm space-y-3">
              <CampusPicker value={campus} onChange={setCampus} />
              <SearchBox value={query} onChange={setQuery} />
              <a
                href="#"
                className="hard-shadow inline-flex items-center gap-2 rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-orange-deep hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0"
              >
                Sell an item
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </a>
            </div>
          </div>
        </section>

        <CategoryButtons value={category} onChange={setCategory} />

        {/* Featured — shown unfiltered, programmatic picks from the data layer */}
        {featured.length > 0 && (
          <section aria-labelledby="featured-heading">
            <h2
              id="featured-heading"
              className="mb-2 text-sm font-bold text-ink sm:text-base"
            >
              Featured
            </h2>
            <ProductGrid products={featured} compact />
          </section>
        )}

        {/* Full catalog with filters applied */}
        <section aria-labelledby="catalog-heading">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="catalog-heading" className="text-sm font-bold text-ink sm:text-base">
              All items
            </h2>
            <p className="text-xs text-ink/60" aria-live="polite">
              {products.length} {products.length === 1 ? 'item' : 'items'} found
            </p>
          </div>
          <ProductGrid products={products} />
          <p className="mt-3 text-center text-[11px] text-ink/40">
            {DATA_SOURCE_LABEL}
          </p>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-6 text-center text-xs text-ink/40">
        <p>Wemart — demo build. Sample data only.</p>
        <p className="mt-1">No payments are processed yet. Meet sellers safely in public places.</p>
      </footer>

      {/* Spacer keeps the footer clear of the fixed mobile nav */}
      <div className="h-16 sm:hidden" aria-hidden="true" />

      <BottomNav />
    </div>
  )
}
