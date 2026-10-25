import { useEffect, useMemo, useRef, useState } from 'react'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import LocationSelects, {
  type LocationSelection,
} from './components/LocationSelects'
import SearchBox from './components/SearchBox'
import CategoryButtons from './components/CategoryButtons'
import ProductGrid from './components/ProductGrid'
import SetupNotice from './components/SetupNotice'
import {
  ApiError,
  getCampusDirectory,
  getCatalog,
  getCategories,
  getNearCampus,
  type CatalogPage,
  type CatalogQuery,
} from './data/api'
import { DATA_SOURCE_DB_LABEL, isSupabaseConfigured } from './lib/supabase'
import type {
  CampusDirectoryEntry,
  CategoryRef,
  Product,
} from './types'

type LoadState =
  | { state: 'loading' }
  | { state: 'ok' }
  | { state: 'error'; message: string }

/**
 * What drives the results list:
 * - campus: a specific campus chosen (eq campus_id)
 * - near:   expanded from a campus — same campus first, then the same
 *           state, then others (catalog_near_campus RPC)
 * - state:  a state chosen without a campus (eq campus_state_id)
 * - all:    everything
 */
type FilterMode = 'campus' | 'near' | 'state' | 'all'

const PAGE_SIZE = 24
const NEW_ARRIVALS_COUNT = 4
const SEARCH_DEBOUNCE_MS = 300
const LOCATION_STORAGE_KEY = 'wemart.location.v1'

/* Restore the saved State/Campus choice (localStorage; never throws). */
function readLocation(): LocationSelection {
  const fallback: LocationSelection = { stateId: 'all', campusId: 'all' }
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Partial<LocationSelection>
    if (typeof saved.stateId !== 'string' || typeof saved.campusId !== 'string') {
      return fallback
    }
    return {
      stateId: saved.stateId || 'all',
      campusId: saved.campusId || 'all',
    }
  } catch {
    return fallback
  }
}

export default function App() {
  const [boot, setBoot] = useState<LoadState>({ state: 'loading' })
  const [bootToken, setBootToken] = useState(0)
  const [directory, setDirectory] = useState<CampusDirectoryEntry[]>([])
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [newArrivals, setNewArrivals] = useState<Product[]>([])

  const [location, setLocation] = useState<LocationSelection>(readLocation)
  const [expanded, setExpanded] = useState(false)
  const [category, setCategory] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [listing, setListing] = useState<LoadState>({ state: 'loading' })
  const [listingToken, setListingToken] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestSeq = useRef(0)

  /* Persist the location choice for the next visit */
  useEffect(() => {
    try {
      window.localStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify(location),
      )
    } catch {
      /* storage unavailable (private mode etc.) — non-fatal */
    }
  }, [location])

  /* Search is debounced 300ms so typing doesn't fire a query per keystroke */
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  /* One-time boot: campus directory, categories, and the "New arrivals" */
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    setBoot({ state: 'loading' })
    Promise.all([
      getCampusDirectory(),
      getCategories(),
      getCatalog({ limit: NEW_ARRIVALS_COUNT }),
    ])
      .then(([directoryRows, categoryRows, arrivals]) => {
        if (cancelled) return
        setDirectory(directoryRows)
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

  /* Once the directory arrives, drop restore choices that no longer exist */
  useEffect(() => {
    if (boot.state !== 'ok') return
    setLocation((prev) => {
      if (prev.campusId !== 'all') {
        const campus = directory.find((entry) => entry.id === prev.campusId)
        if (!campus) return { stateId: 'all', campusId: 'all' }
        if (prev.stateId !== campus.stateId) {
          return { ...prev, stateId: campus.stateId }
        }
      } else if (
        prev.stateId !== 'all' &&
        !directory.some((entry) => entry.stateId === prev.stateId)
      ) {
        return { stateId: 'all', campusId: 'all' }
      }
      return prev
    })
  }, [boot.state, directory])

  const chosenCampus =
    location.campusId === 'all'
      ? undefined
      : directory.find((entry) => entry.id === location.campusId)

  /* State selection: reset campus unless it lives in the new state */
  const handleStateChange = (stateId: string) => {
    if (stateId === 'all') {
      setLocation({ stateId: 'all', campusId: 'all' })
    } else {
      const campusStillValid =
        chosenCampus && chosenCampus.stateId === stateId
      setLocation({
        stateId,
        campusId: campusStillValid ? location.campusId : 'all',
      })
    }
    setExpanded(false)
  }

  /* Campus selection: keep the state select synced to the campus's state */
  const handleCampusChange = (campusId: string) => {
    const campus =
      campusId === 'all'
        ? undefined
        : directory.find((entry) => entry.id === campusId)
    setLocation({
      campusId,
      stateId: campus ? campus.stateId : location.stateId,
    })
    setExpanded(false)
  }

  const mode: FilterMode =
    expanded && chosenCampus
      ? 'near'
      : chosenCampus
        ? 'campus'
        : location.stateId !== 'all'
          ? 'state'
          : 'all'

  const filters: CatalogQuery = useMemo(
    () => ({
      ...(mode === 'campus' ? { campusId: location.campusId } : {}),
      ...(mode === 'state' ? { stateId: location.stateId } : {}),
      categoryId: category === 'all' ? undefined : category,
      search: search || undefined,
    }),
    [mode, location.stateId, location.campusId, category, search],
  )

  /* Catalog page: refetches when any filter changes (replace, not append) */
  useEffect(() => {
    if (!isSupabaseConfigured || boot.state !== 'ok') return
    const seq = ++requestSeq.current
    setListing({ state: 'loading' })

    const request: Promise<CatalogPage> =
      mode === 'near'
        ? getNearCampus({
            campusId: location.campusId,
            search: search || undefined,
            limit: PAGE_SIZE,
            offset: 0,
          })
        : getCatalog({ ...filters, limit: PAGE_SIZE, offset: 0 })

    request
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
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [filters, mode, listingToken, boot.state])

  /* Pagination: appends the next page under the same mode/filters.
     When active search/category filters exist, "near" falls back to the
     campus_state_id view filter (the RPC has no category parameter). */
  const handleLoadMore = () => {
    if (loadingMore || listing.state !== 'ok') return
    const seq = ++requestSeq.current
    setLoadingMore(true)
    const offset = items.length
    const request: Promise<CatalogPage> =
      mode === 'near' && !search && category === 'all'
        ? getNearCampus({
            campusId: location.campusId,
            limit: PAGE_SIZE,
            offset,
          })
        : mode === 'near'
          ? getCatalog({
              stateId: chosenCampus?.stateId,
              categoryId: category === 'all' ? undefined : category,
              search: search || undefined,
              limit: PAGE_SIZE,
              offset,
            })
          : getCatalog({ ...filters, limit: PAGE_SIZE, offset })

    request
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

  const emptyMessage =
    mode === 'campus'
      ? 'No items on this campus yet. Be the first to sell here.'
      : 'No items here yet. Be the first to sell on this campus.'
  const showExactCount = mode !== 'near'

  return (
    <div className="min-h-dvh bg-surface">
      <Header
        directory={directory}
        location={location}
        onStateChange={handleStateChange}
        onCampusChange={handleCampusChange}
      />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-4">
        {/* Hero: headline + the linked pickers, compact enough to fit
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

            <div className="mt-3 max-w-sm">
              <LocationSelects
                directory={directory}
                location={location}
                onStateChange={handleStateChange}
                onCampusChange={handleCampusChange}
              />
            </div>
            <div className="mt-3 max-w-sm">
              <SearchBox value={searchInput} onChange={setSearchInput} />
              <a
                href="#"
                className="hard-shadow mt-3 inline-flex items-center gap-2 rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-orange-deep hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0"
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
          onChange={(next) => {
            setCategory(next)
            setExpanded(false)
          }}
        />

        {/* Startup failure — the whole marketplace is down, so full width */}
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
                  className="hard-shadow mt-3 rounded-lg bg-orange px-4 py-2 text-sm font-bold text-ink transition hover:bg-orange-deep hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:active:translate-y-0 motion-reduce:active:translate-y-0"
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
                  {showExactCount && (
                    <p className="text-xs text-ink/60" aria-live="polite">
                      {total} {total === 1 ? 'item' : 'items'} found
                    </p>
                  )}
                </div>
                <ProductGrid
                  products={items}
                  emptyMessage={
                    mode === 'near' ? undefined : emptyMessage
                  }
                />
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

                {/* Nearby expansion under the results */}
                {mode === 'campus' && chosenCampus && (
                  <p className="mt-2 text-center text-[11px] text-ink/60">
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="underline transition hover:text-orange-deep"
                    >
                      Also show other campuses in {chosenCampus.stateName}
                    </button>
                  </p>
                )}
                {mode === 'near' && chosenCampus && (
                  <p className="mt-2 text-center text-[11px] text-ink/60">
                    Showing other campuses in {chosenCampus.stateName} too —{' '}
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      className="underline transition hover:text-orange-deep"
                    >
                      show only {chosenCampus.name}
                    </button>
                  </p>
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
