import { useEffect, useMemo, useRef, useState } from 'react'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import CampusPicker from './components/CampusPicker'
import SearchBox from './components/SearchBox'
import CategoryButtons from './components/CategoryButtons'
import ProductGrid from './components/ProductGrid'
import SetupNotice from './components/SetupNotice'
import {
  ApiError,
  getCampuses,
  getCatalog,
  getCategories,
  type CatalogQuery,
} from './data/api'
import { DATA_SOURCE_DB_LABEL, isSupabaseConfigured } from './lib/supabase'
import type { Campus, CategoryRef, Product } from './types'

type LoadState =
  | { state: 'loading' }
  | { state: 'ok' }
  | { state: 'error'; message: string }

const PAGE_SIZE = 24
const NEW_ARRIVALS_COUNT = 4
const SEARCH_DEBOUNCE_MS = 300

export default function App() {
  const [boot, setBoot] = useState<LoadState>({ state: 'loading' })
  const [bootToken, setBootToken] = useState(0)
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [newArrivals, setNewArrivals] = useState<Product[]>([])

  const [campus, setCampus] = useState('all')
  const [category, setCategory] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [listing, setListing] = useState<LoadState>({ state: 'loading' })
  const [listingToken, setListingToken] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestSeq = useRef(0)

  const catalogFilters: CatalogQuery = useMemo(
    () => ({
      campusId: campus === 'all' ? undefined : campus,
      categoryId: category === 'all' ? undefined : category,
      search: search || undefined,
    }),
    [campus, category, search],
  )

  /* Search is debounced 300ms so typing doesn't fire a query per keystroke */
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  /* One-time boot: campuses, categories, and the "New arrivals" picks */
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    setBoot({ state: 'loading' })
    Promise.all([getCampuses(), getCategories(), getCatalog({ limit: NEW_ARRIVALS_COUNT })])
      .then(([campusRows, categoryRows, arrivals]) => {
        if (cancelled) return
        setCampuses(campusRows)
        setCategories(categoryRows)
        setNewArrivals(arrivals.items)
        setBoot({ state: 'ok' })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setBoot({
          state: 'error',
          message:
            error instanceof ApiError
              ? error.message
              : 'Unexpected startup error.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [bootToken])

  /* Catalog page: refetches when any filter changes (replace, not append) */
  useEffect(() => {
    if (!isSupabaseConfigured || boot.state !== 'ok') return
    const seq = ++requestSeq.current
    setListing({ state: 'loading' })
    getCatalog({ ...catalogFilters, limit: PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (requestSeq.current !== seq) return
        setItems(page.items)
        setTotal(page.total)
        setListing({ state: 'ok' })
      })
      .catch((error: unknown) => {
        if (requestSeq.current !== seq) return
        setListing({
          state: 'error',
          message:
            error instanceof ApiError
              ? error.message
              : 'Unexpected error while loading items.',
        })
      })
  }, [catalogFilters, listingToken, boot.state])

  /* Pagination: appends the next page under the same filters */
  const handleLoadMore = () => {
    if (loadingMore || listing.state !== 'ok') return
    const seq = ++requestSeq.current
    setLoadingMore(true)
    getCatalog({ ...catalogFilters, limit: PAGE_SIZE, offset: items.length })
      .then((page) => {
        if (requestSeq.current !== seq) return
        setItems((prev) => [...prev, ...page.items])
        setTotal(page.total)
        setLoadingMore(false)
      })
      .catch((error: unknown) => {
        setLoadingMore(false)
        if (requestSeq.current !== seq) return
        setListing({
          state: 'error',
          message:
            error instanceof ApiError
              ? error.message
              : 'Unexpected error while loading more items.',
        })
      })
  }

  if (!isSupabaseConfigured) {
    return <SetupNotice />
  }

  return (
    <div className="min-h-dvh bg-surface">
      <Header
        campuses={campuses}
        campus={campus}
        onCampusChange={setCampus}
      />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-4">
        {/* Hero: headline + the two primary pickers, compact enough to fit
            above the fold on a phone (no decorative elements) */}
        <section className="relative overflow-hidden rounded-lg border border-border bg-white p-4 sm:p-6">
          <div className="relative">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-4xl">
              Discover on Wemart.
            </h1>
            <p className="mt-1 max-w-md text-sm text-ink/70 sm:mt-2 sm:text-base">
              Phones, books, furniture and more from student vendors across
              Nigerian campuses. Safe meetups, fair prices.
            </p>

            <div className="mt-3 max-w-sm space-y-3">
              <CampusPicker
                campuses={campuses}
                value={campus}
                onChange={setCampus}
              />
              <SearchBox value={searchInput} onChange={setSearchInput} />
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

        <CategoryButtons
          categories={categories}
          value={category}
          onChange={setCategory}
        />

        {/* Startup failure — the whole marketplace is down, so full screen */}
        {boot.state === 'error' && (
          <section className="rounded-lg border border-dashed border-border bg-white p-4 text-center">
            <p className="text-sm font-semibold text-ink">
              Could not start up the marketplace.
            </p>
            <p className="mt-1 text-xs text-ink/60" role="alert">
              {boot.message}
            </p>
            <button
              type="button"
              onClick={() => setBootToken((token) => token + 1)}
              className="hard-shadow mt-3 rounded-lg bg-orange px-4 py-2 text-sm font-bold text-ink transition hover:bg-orange-deep hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0"
            >
              Try again
            </button>
          </section>
        )}

        {boot.state === 'ok' && (
          <>
            {/* Loading state — keeps layout stable, no layout shift */}
            {listing.state === 'loading' && (
              <section aria-busy="true">
                <p className="text-xs font-medium text-ink/60">
                  Loading items…
                </p>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 4 }, (_, index) => (
                    <li
                      key={index}
                      className="h-64 animate-pulse rounded-lg border border-border bg-orange-tint/40"
                      aria-hidden="true"
                    />
                  ))}
                </ul>
              </section>
            )}

            {/* Query failure — honest notice + retry, no half-loaded data */}
            {listing.state === 'error' && (
              <section className="rounded-lg border border-dashed border-border bg-white p-4 text-center">
                <p className="text-sm font-semibold text-ink">
                  Could not load items.
                </p>
                <p className="mt-1 text-xs text-ink/60" role="alert">
                  {listing.message}
                </p>
                <button
                  type="button"
                  onClick={() => setListingToken((token) => token + 1)}
                  className="hard-shadow mt-3 rounded-lg bg-orange px-4 py-2 text-sm font-bold text-ink transition hover:bg-orange-deep hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0"
                >
                  Retry
                </button>
              </section>
            )}

            {/* New arrivals — the 4 latest items on the platform */}
            {listing.state !== 'loading' && newArrivals.length > 0 && (
              <section aria-labelledby="arrivals-heading">
                <h2
                  id="arrivals-heading"
                  className="mb-2 text-sm font-bold text-ink sm:text-base"
                >
                  New arrivals
                </h2>
                <ProductGrid products={newArrivals} compact />
              </section>
            )}

            {/* All items with filters applied, paginated */}
            {listing.state !== 'loading' && (
              <section aria-labelledby="catalog-heading">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2
                    id="catalog-heading"
                    className="text-sm font-bold text-ink sm:text-base"
                  >
                    All items
                  </h2>
                  <p className="text-xs text-ink/60" aria-live="polite">
                    {total} {total === 1 ? 'item' : 'items'} found
                  </p>
                </div>
                <ProductGrid products={items} />
                {listing.state === 'ok' && items.length < total && (
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-orange-tint disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        <p className="mt-3 text-center text-[11px] text-ink/40">
          {DATA_SOURCE_DB_LABEL}
        </p>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-6 text-center text-xs text-ink/40">
        <p>Wemart — browsing only; no checkout or payments yet.</p>
        <p className="mt-1">Meet sellers safely in public places.</p>
      </footer>

      {/* Spacer keeps the footer clear of the fixed mobile nav */}
      <div className="h-16 sm:hidden" aria-hidden="true" />

      <BottomNav />
    </div>
  )
}
