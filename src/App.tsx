import { useCallback, useEffect, useMemo, useState } from 'react'
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import { type LocationSelection } from './components/LocationSelects'
import SearchBox from './components/SearchBox'
import CategoryButtons from './components/CategoryButtons'
import FilterSheet from './components/FilterSheet'
import ProductGrid from './components/ProductGrid'
import SetupNotice from './components/SetupNotice'
import {
  ApiError,
  getCampusDirectory,
  getCatalog,
  getCategories,
  getNearCampus,
  getRecommended,
  type CatalogPage,
  type CatalogQuery,
} from './data/api'
import { DATA_SOURCE_DB_LABEL, isSupabaseConfigured } from './lib/supabase'
import { DEFAULT_FILTERS } from './types'
import type {
  CampusDirectoryEntry,
  CategoryRef,
  Condition,
  Filters,
  Product,
  SortOption,
} from './types'

type LoadState =
  | { state: 'loading' }
  | { state: 'ok' }
  | { state: 'error'; message: string }

/**
 * What drives the results list:
 * - campus: a specific campus chosen (eq campus_id)
 * - near:   expanded from a campus — same campus first, then the same
 *           state, then others (catalog_near_campus RPC). Only used when
 *           nothing else is filtered; otherwise falls back to a plain
 *           catalog query filtered by campus_state_id.
 * - state:  a state chosen without a campus (eq campus_state_id)
 * - all:    everything
 */
type FilterMode = 'campus' | 'near' | 'state' | 'all'

type ActiveChip = {
  key: string
  label: string
  remove: () => void
}

/** Last completed page-1 catalog fetch, keyed by the query it belongs to */
type ListingResult = {
  key: string
  state: 'ok' | 'error'
  items: Product[]
  total: number
  message?: string
}

const PAGE_SIZE = 24
const NEW_ARRIVALS_COUNT = 4
const SUGGESTIONS_COUNT = 12
const SEARCH_DEBOUNCE_MS = 300
const LOCATION_STORAGE_KEY = 'wemart.location.v1'

const CONDITION_URL_VALUES: Condition[] = ['new', 'used', 'refurbished']
const SORT_URL_VALUES: SortOption[] = ['newest', 'price-asc', 'price-desc']

/* Naira formatter shared by the filter price chips */
const NAIRA_FORMAT = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})
const money = (value: number) => NAIRA_FORMAT.format(value)

/* Human labels for the condition filter chips */
const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  used: 'Used',
  refurbished: 'Refurbished',
  other: 'Other',
}

/* Restore the saved State/Campus choice (localStorage; never throws). */
function readSavedLocation(): { stateId?: string; campusId?: string } {
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY)
    if (!raw) return {}
    const saved = JSON.parse(raw) as Partial<LocationSelection>
    const savedState = saved.stateId || 'all'
    const savedCampus = saved.campusId || 'all'
    return { stateId: savedState, campusId: savedCampus }
  } catch {
    return {}
  }
}

/* Read the filter state from the URL (?state=..&campus=..&cat=..&sub=..&q=..
   plus cond/min/max/stock/sort). Unknown values are ignored silently. */
function readFiltersFromUrl(): Partial<Filters> {
  const params = new URLSearchParams(window.location.search)
  const result: Partial<Filters> = {}
  const state = params.get('state')
  if (state) result.stateId = state
  const campus = params.get('campus')
  if (campus) result.campusId = campus
  const cat = params.get('cat')
  if (cat) result.categoryId = cat
  const sub = params.get('sub')
  if (sub) result.subCategoryId = sub
  /* note: ?q= is read separately into the debounced search state */
  const cond = params.get('cond')
  if (cond && CONDITION_URL_VALUES.includes(cond as Condition)) {
    result.condition = cond as Condition
  }
  const min = params.get('min')
  if (min !== null && Number.isFinite(Number(min))) result.minPrice = Number(min)
  const max = params.get('max')
  if (max !== null && Number.isFinite(Number(max))) result.maxPrice = Number(max)
  if (params.get('stock') === '1') result.inStock = true
  const sort = params.get('sort')
  if (sort && SORT_URL_VALUES.includes(sort as SortOption)) {
    result.sort = sort as SortOption
  }
  return result
}

export default function App() {
  const [boot, setBoot] = useState<LoadState>({ state: 'loading' })
  const [bootToken, setBootToken] = useState(0)
  const [directory, setDirectory] = useState<CampusDirectoryEntry[]>([])
  const [categories, setCategories] = useState<CategoryRef[]>([])
  const [newArrivals, setNewArrivals] = useState<Product[]>([])

  /* URL wins over localStorage; localStorage wins over defaults */
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    ...readSavedLocation(),
    ...readFiltersFromUrl(),
  }))
  const [expanded, setExpanded] = useState(false)
  /* ?q= seeds the search box (and the debounced query) once at startup */
  const [searchInput, setSearchInput] = useState(
    () => new URLSearchParams(window.location.search).get('q') ?? '',
  )
  const [search, setSearch] = useState(searchInput)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  /* Last completed page-1 fetch. Nothing is set synchronously in effects:
     "loading" is derived by comparing the current query key against the
     key of the result on screen. */
  const [completed, setCompleted] = useState<ListingResult>({
    key: '',
    state: 'ok',
    items: [],
    total: 0,
  })
  const [listingToken, setListingToken] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  /* Persist the location choice for the next visit (URL params still win) */
  useEffect(() => {
    try {
      window.localStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify({ stateId: filters.stateId, campusId: filters.campusId }),
      )
    } catch {
      /* storage unavailable (private mode etc.) — non-fatal */
    }
  }, [filters.stateId, filters.campusId])

  /* Search is debounced 300ms so typing doesn't fire a query per keystroke */
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  /* One-time boot: campus directory, categories, and the "New arrivals" */
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
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
        /* Restored location choices must still exist in the directory:
           drop unknown campuses, resync the state of a known campus */
        setFilters((prev) => {
          if (prev.campusId !== 'all') {
            const campus = directoryRows.find(
              (entry) => entry.id === prev.campusId,
            )
            if (!campus) return { ...prev, stateId: 'all', campusId: 'all' }
            if (prev.stateId !== campus.stateId) {
              return { ...prev, stateId: campus.stateId }
            }
          } else if (
            prev.stateId !== 'all' &&
            !directoryRows.some((entry) => entry.stateId === prev.stateId)
          ) {
            return { ...prev, stateId: 'all', campusId: 'all' }
          }
          return prev
        })
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

  const chosenCampus =
    filters.campusId === 'all'
      ? undefined
      : directory.find((entry) => entry.id === filters.campusId)

  const chosenTopCategory = categories.find(
    (category) =>
      category.id === filters.categoryId && category.parentCategoryId === null,
  )
  const chosenSubCategories = useMemo(
    () =>
      chosenTopCategory
        ? categories.filter(
            (category) => category.parentCategoryId === chosenTopCategory.id,
          )
        : [],
    [categories, chosenTopCategory],
  )

  /* State selection: reset campus unless it lives in the new state */
  const handleStateChange = useCallback(
    (stateId: string) => {
      if (stateId === 'all') {
        setFilters((prev) => ({ ...prev, stateId: 'all', campusId: 'all' }))
      } else {
        setFilters((prev) => {
          const campus =
            prev.campusId === 'all'
              ? undefined
              : directory.find((entry) => entry.id === prev.campusId)
          return {
            ...prev,
            stateId,
            campusId:
              campus && campus.stateId === stateId ? prev.campusId : 'all',
          }
        })
      }
      setExpanded(false)
    },
    [directory],
  )

  /* Campus selection: keep the state select synced to the campus's state */
  const handleCampusChange = useCallback(
    (campusId: string) => {
      setFilters((prev) => {
        const campus =
          campusId === 'all'
            ? undefined
            : directory.find((entry) => entry.id === campusId)
        return {
          ...prev,
          campusId,
          stateId: campus ? campus.stateId : prev.stateId,
        }
      })
      setExpanded(false)
    },
    [directory],
  )

  /* Strict database-side category semantics:
     - sub chosen       → category_id = sub
     - top chosen       → category_id IN (top + its children)
     - nothing chosen   → no filter (uncategorized items show under All) */
  const categoryIds = useMemo(() => {
    if (filters.subCategoryId !== 'all') return [filters.subCategoryId]
    if (filters.categoryId !== 'all') {
      return [filters.categoryId, ...chosenSubCategories.map((c) => c.id)]
    }
    return undefined
  }, [filters.categoryId, filters.subCategoryId, chosenSubCategories])

  /* Only-location extra = eligible for the nearby RPC expansion */
  const isNearEligible =
    !search &&
    filters.categoryId === 'all' &&
    filters.condition === 'all' &&
    filters.minPrice === null &&
    filters.maxPrice === null &&
    !filters.inStock &&
    filters.sort === 'newest'

  const mode: FilterMode =
    expanded && chosenCampus && isNearEligible
      ? 'near'
      : chosenCampus
        ? 'campus'
        : filters.stateId !== 'all'
          ? 'state'
          : 'all'

  const catalogQuery: CatalogQuery = useMemo(
    () => ({
      campusId: mode === 'campus' ? filters.campusId : undefined,
      stateId: mode === 'state' ? filters.stateId : undefined,
      categoryIds,
      condition: filters.condition === 'all' ? undefined : filters.condition,
      minPrice: filters.minPrice ?? undefined,
      maxPrice: filters.maxPrice ?? undefined,
      inStock: filters.inStock || undefined,
      search: search || undefined,
      sort: mode === 'near' ? 'newest' : filters.sort,
    }),
    [
      mode,
      filters.campusId,
      filters.stateId,
      filters.condition,
      filters.minPrice,
      filters.maxPrice,
      filters.inStock,
      filters.sort,
      categoryIds,
      search,
    ],
  )

  /* The key identifies which query the on-screen result belongs to */
  const queryKey = JSON.stringify([mode, catalogQuery, listingToken])
  const listingLoading = completed.key !== queryKey

  /* Catalog page 1: refetches when any filter changes (a changed key
     instantly swaps the old grid for skeletons — no stale data under a
     new query). Result state is written only in async callbacks; the
     loading flag above is purely derived. */
  useEffect(() => {
    if (!isSupabaseConfigured || boot.state !== 'ok') return
    const key = queryKey
    let cancelled = false

    const request: Promise<CatalogPage> =
      mode === 'near'
        ? getNearCampus({
            campusId: filters.campusId,
            search: search || undefined,
            limit: PAGE_SIZE,
            offset: 0,
          })
        : getCatalog({ ...catalogQuery, limit: PAGE_SIZE, offset: 0 })

    request
      .then((page) => {
        if (cancelled) return
        setCompleted({ key, state: 'ok', items: page.items, total: page.total })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setCompleted({
          key,
          state: 'error',
          items: [],
          total: 0,
          message:
            error instanceof ApiError
              ? error.message
              : 'Unexpected error while loading items.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [
    queryKey,
    mode,
    catalogQuery,
    filters.campusId,
    search,
    listingToken,
    boot.state,
  ])

  /* Pagination: appends the next page only if the on-screen query is still
     the one this click started from */
  const handleLoadMore = () => {
    if (
      loadingMore ||
      listingLoading ||
      completed.key !== queryKey ||
      completed.state !== 'ok'
    ) {
      return
    }
    setLoadingMore(true)
    const offset = completed.items.length
    const request: Promise<CatalogPage> =
      mode === 'near'
        ? getNearCampus({
            campusId: filters.campusId,
            search: search || undefined,
            limit: PAGE_SIZE,
            offset,
          })
        : getCatalog({ ...catalogQuery, limit: PAGE_SIZE, offset })

    request
      .then((page) => {
        setLoadingMore(false)
        setCompleted((prev) =>
          prev.key !== queryKey
            ? prev
            : {
                ...prev,
                items: [...prev.items, ...page.items],
                total: page.total,
              },
        )
      })
      .catch((error: unknown) => {
        setLoadingMore(false)
        setCompleted((prev) =>
          prev.key !== queryKey
            ? prev
            : {
                ...prev,
                state: 'error',
                message:
                  error instanceof ApiError
                    ? error.message
                    : 'Unexpected error while loading more items.',
              },
        )
      })
  }

  /* Keep the filter state in the URL so results can be shared */
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.stateId !== 'all') params.set('state', filters.stateId)
    if (filters.campusId !== 'all') params.set('campus', filters.campusId)
    if (filters.categoryId !== 'all') params.set('cat', filters.categoryId)
    if (filters.subCategoryId !== 'all') params.set('sub', filters.subCategoryId)
    if (search) params.set('q', search)
    if (filters.condition !== 'all') params.set('cond', filters.condition)
    if (filters.minPrice !== null) params.set('min', String(filters.minPrice))
    if (filters.maxPrice !== null) params.set('max', String(filters.maxPrice))
    if (filters.inStock) params.set('stock', '1')
    if (filters.sort !== 'newest') params.set('sort', filters.sort)
    const query = params.toString()
    const { pathname } = window.location
    window.history.replaceState(null, '', query ? `?${query}` : pathname)
  }, [filters, search])

  const clearAllFilters = () => {
    setFilters({ ...DEFAULT_FILTERS })
    setExpanded(false)
    setSearchInput('')
    setSearch('')
  }

  /* Removable chips for every active filter */
  const activeChips: ActiveChip[] = useMemo(() => {
    const chips: ActiveChip[] = []
    if (filters.stateId !== 'all') {
      const label =
        directory.find((entry) => entry.stateId === filters.stateId)
          ?.stateName ?? 'State'
      chips.push({
        key: 'state',
        label,
        remove: () => handleStateChange('all'),
      })
    }
    if (filters.campusId !== 'all') {
      const label = chosenCampus?.name ?? 'Campus'
      chips.push({
        key: 'campus',
        label,
        remove: () => handleCampusChange('all'),
      })
    }
    if (filters.categoryId !== 'all') {
      chips.push({
        key: 'cat',
        label: chosenTopCategory?.name ?? 'Category',
        remove: () =>
          setFilters((prev) => ({
            ...prev,
            categoryId: 'all',
            subCategoryId: 'all',
          })),
      })
    }
    if (filters.subCategoryId !== 'all') {
      const label = chosenSubCategories.find(
        (category) => category.id === filters.subCategoryId,
      )?.name
      chips.push({
        key: 'sub',
        label: label ?? 'Sub-category',
        remove: () =>
          setFilters((prev) => ({ ...prev, subCategoryId: 'all' })),
      })
    }
    if (filters.condition !== 'all') {
      const label = CONDITION_LABELS[filters.condition] ?? 'Condition'
      chips.push({
        key: 'cond',
        label,
        remove: () => setFilters((prev) => ({ ...prev, condition: 'all' })),
      })
    }
    if (filters.minPrice !== null || filters.maxPrice !== null) {
      let label = 'Price'
      if (filters.minPrice !== null && filters.maxPrice !== null) {
        label = `${money(filters.minPrice)} – ${money(filters.maxPrice)}`
      } else if (filters.minPrice !== null) {
        label = `From ${money(filters.minPrice)}`
      } else {
        label = `Up to ${money(filters.maxPrice as number)}`
      }
      chips.push({
        key: 'price',
        label,
        remove: () =>
          setFilters((prev) => ({ ...prev, minPrice: null, maxPrice: null })),
      })
    }
    if (filters.inStock) {
      chips.push({
        key: 'stock',
        label: 'In stock only',
        remove: () => setFilters((prev) => ({ ...prev, inStock: false })),
      })
    }
    if (search.trim() !== '') {
      chips.push({
        key: 'q',
        label: `Search: ${search.trim()}`,
        remove: () => {
          setSearchInput('')
          setSearch('')
        },
      })
    }
    return chips
    /* Directory/search not needed — labels resolve via chosenCampus etc. */
  }, [
    filters,
    directory,
    chosenCampus,
    chosenTopCategory,
    chosenSubCategories,
    search,
    handleStateChange,
    handleCampusChange,
  ])

  /* Load the recommendation pool when a filtered view is truly empty.
     Kept strictly separate from the results grid: available offers only,
     ranked by the location hierarchy (campus → state → nationwide) and
     cheapest price first, never silently blended into the search result. */
  const suggestWhenEmpty =
    boot.state === 'ok' &&
    !listingLoading &&
    completed.state === 'ok' &&
    completed.items.length === 0
  const [suggestions, setSuggestions] = useState<Product[] | null>(null)
  useEffect(() => {
    if (!suggestWhenEmpty) return
    let cancelled = false
    getRecommended({
      campusId: filters.campusId === 'all' ? undefined : filters.campusId,
      stateId: filters.stateId === 'all' ? undefined : filters.stateId,
      excludeIds: newArrivals.map((product) => product.id),
      limit: SUGGESTIONS_COUNT,
    })
      .then((items) => {
        if (!cancelled) setSuggestions(items)
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
    return () => {
      cancelled = true
    }
  }, [suggestWhenEmpty, filters, newArrivals])

  const filtersActive = activeChips.length > 0

  if (!isSupabaseConfigured) {
    return <SetupNotice />
  }

  /* Empty state, most specific honest message first, per product rules:
     search/category/other filters → unavailable message; an empty
     campus or state → the location-specific message naming the state. */
  const stateName =
    directory.find((entry) => entry.stateId === filters.stateId)?.stateName
  const emptyMessage = (() => {
    if (
      search.trim() !== '' ||
      filters.categoryId !== 'all' ||
      filters.subCategoryId !== 'all' ||
      filters.condition !== 'all' ||
      filters.minPrice !== null ||
      filters.maxPrice !== null ||
      filters.inStock
    ) {
      return 'Sorry, this item is currently unavailable.'
    }
    if (filters.campusId !== 'all') {
      return 'Sorry, no products are currently available on this campus yet.'
    }
    if (filters.stateId !== 'all') {
      return `Sorry, no products are currently available in ${stateName ?? 'this state'}.`
    }
    return 'No items here yet. Be the first to sell on this campus.'
  })()
  /* How the recommendations strip is introduced under an empty result */
  const recommendationsHeading = (() => {
    if (
      search.trim() === '' &&
      filters.categoryId === 'all' &&
      filters.subCategoryId === 'all' &&
      filters.condition === 'all' &&
      filters.minPrice === null &&
      filters.maxPrice === null &&
      !filters.inStock
    ) {
      return 'Recommended Products from Other Locations'
    }
    return 'Recommended Products'
  })()

  return (
    <div className="min-h-dvh bg-surface">
      <Header
        directory={directory}
        location={filters}
        onStateChange={handleStateChange}
        onCampusChange={handleCampusChange}
      />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-4">
        {/* Hero: headline + search + filters entry, compact enough to fit
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
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchBox value={searchInput} onChange={setSearchInput} />
                </div>
                {/* Filters entry — badge shows the number of active filters */}
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(true)}
                  aria-expanded={filterSheetOpen}
                  aria-haspopup="dialog"
                  className="hard-shadow relative flex shrink-0 items-center gap-2 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-bold text-ink transition hover:bg-orange-tint"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 7h10M18 7h2M14 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM4 17h2M10 17h10M8 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="hidden sm:inline">Filters</span>
                  {activeChips.length > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold text-ink"
                      aria-hidden="true"
                    >
                      {activeChips.length}
                    </span>
                  )}
                  {activeChips.length > 0 && (
                    <span className="sr-only">
                      ({activeChips.length} filters active)
                    </span>
                  )}
                </button>
              </div>

              {/* Removable chips for every active filter + Clear all */}
              {activeChips.length > 0 && (
                <div
                  className="mt-2 flex flex-wrap items-center gap-2"
                  aria-label="Active filters"
                >
                  {activeChips.map((chip) => (
                    <span
                      key={chip.key}
                      className="flex items-center gap-1 rounded-full bg-orange-tint py-1 pr-1 pl-3 text-xs font-medium text-ink"
                    >
                      {chip.label}
                      <button
                        type="button"
                        onClick={chip.remove}
                        aria-label={`Remove filter: ${chip.label}`}
                        className="rounded-full p-1 text-ink/60 transition hover:bg-orange hover:text-ink"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3 w-3"
                          aria-hidden="true"
                        >
                          <path
                            d="M6 6l12 12M18 6L6 18"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs font-semibold text-orange-deep underline transition hover:text-ink"
                  >
                    Clear all
                  </button>
                </div>
              )}

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
          topCategories={categories.filter(
            (category) => category.parentCategoryId === null,
          )}
          subCategories={chosenTopCategory ? chosenSubCategories : []}
          top={filters.categoryId}
          sub={filters.subCategoryId}
          topName={chosenTopCategory?.name ?? ''}
          onTop={(categoryId) => {
            setFilters((prev) => ({
              ...prev,
              categoryId,
              subCategoryId: 'all',
            }))
            setExpanded(false)
          }}
          onSub={(subCategoryId) => {
            setFilters((prev) => ({ ...prev, subCategoryId }))
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
              onClick={() => {
                setBoot({ state: 'loading' })
                setBootToken((token) => token + 1)
              }}
              className="hard-shadow mt-3 rounded-lg bg-orange px-4 py-2 text-sm font-bold text-ink transition hover:bg-orange-deep hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:active:translate-y-0 motion-reduce:active:translate-y-0"
            >
              Try again
            </button>
          </section>
        )}

        {boot.state === 'ok' && (
          <>
            {/* Loading state — keeps layout stable, no layout shift */}
            {listingLoading && (
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
            {!listingLoading && completed.state === 'error' && (
              <section className="rounded-lg border border-dashed border-border bg-white p-4 text-center">
                <p className="text-sm font-semibold text-ink">
                  Could not load items.
                </p>
                <p className="mt-1 text-xs text-ink/60" role="alert">
                  {completed.message}
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
            {!listingLoading &&
              completed.state === 'ok' &&
              newArrivals.length > 0 && (
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
            {!listingLoading && completed.state === 'ok' && (
              <section aria-labelledby="catalog-heading">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2
                    id="catalog-heading"
                    className="text-sm font-bold text-ink sm:text-base"
                  >
                    All items
                  </h2>
                  {mode === 'near' && chosenCampus ? (
                    <p className="text-xs text-ink/60" aria-live="polite">
                      Also showing other campuses in {chosenCampus.stateName}
                    </p>
                  ) : (
                    <p className="text-xs text-ink/60" aria-live="polite">
                      {completed.total}{' '}
                      {completed.total === 1 ? 'item' : 'items'} found
                    </p>
                  )}
                </div>
                <ProductGrid
                  products={completed.items}
                  emptyMessage={emptyMessage}
                  onClearFilters={filtersActive ? clearAllFilters : undefined}
                />

                {/* Recommendations only under a genuinely EMPTY result —
                    when matches exist, results stand alone (Scenario B). */}
                {completed.items.length === 0 &&
                  suggestions &&
                  suggestions.length > 0 && (
                  <section
                    aria-labelledby="suggestions-heading"
                    className="mt-4 border-t border-border pt-4"
                  >
                    <h2
                      id="suggestions-heading"
                      className="mb-1 text-sm font-bold text-ink"
                    >
                      {recommendationsHeading}
                    </h2>
                    <p className="mb-2 text-[11px] text-ink/60">
                      {recommendationsHeading ===
                      'Recommended Products from Other Locations'
                        ? 'Available items from other campuses — the actual location is shown on every card.'
                        : 'Available now — ranked by proximity first, then cheapest price first.'}
                    </p>
                    <ProductGrid products={suggestions} compact />
                  </section>
                )}

                {completed.items.length < completed.total && (
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

      {filterSheetOpen && (
        <FilterSheet
          directory={directory}
          categories={categories}
          value={filters}
          onApply={(next) => {
            setFilters(next)
            setFilterSheetOpen(false)
            setExpanded(false)
          }}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}
    </div>
  )
}
