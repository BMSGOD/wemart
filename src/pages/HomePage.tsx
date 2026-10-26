import { useCallback, useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import { type LocationSelection } from '../components/LocationSelects'
import CategoryMenu from '../components/CategoryMenu'
import Footer from '../components/Footer'
import { HeroSection } from '../components/HomePromos'
import ProductCard from '../components/ProductCard'
import FilterSheet from '../components/FilterSheet'
import ProductGrid from '../components/ProductGrid'
import SetupNotice from '../components/SetupNotice'
import {
  ApiError,
  getCampusDirectory,
  getCatalog,
  getCategories,
  getRecommended,
  type CatalogQuery,
} from '../data/api'
import { DATA_SOURCE_DB_LABEL, isSupabaseConfigured } from '../lib/supabase'
import { DEFAULT_FILTERS } from '../types'
import type {
  CampusDirectoryEntry,
  CategoryRef,
  Condition,
  Filters,
  Product,
  SortOption,
} from '../types'

type LoadState =
  | { state: 'loading' }
  | { state: 'ok' }
  | { state: 'error'; message: string }

/**
 * What drives the results list (STATE → CAMPUS model):
 * - campus: a specific campus chosen (p_campus_id) — catalog_search then
 *   returns matching rows tier-ordered (same campus → same state →
 *   everywhere else), which App groups under scope headings.
 * - state:  a state chosen without a campus (p_state_id)
 * - all:    everything
 */
type FilterMode = 'campus' | 'state' | 'all'

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
  /** Rows loaded so far — the RPC returns no exact count */
  total: number
  /** True while the latest page came back full */
  hasMore: boolean
  message?: string
}

/** A scope group of the result list: heading + its ordered rows */
type ResultGroup = {
  heading: string
  products: Product[]
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

export default function HomePage() {
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
  /* ?q= seeds the search box (and the debounced query) once at startup */
  const [searchInput, setSearchInput] = useState(
    () => new URLSearchParams(window.location.search).get('q') ?? '',
  )
  const [search, setSearch] = useState(searchInput)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  /* Results layout: search/category results default to the compact list */
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  /* Last completed page-1 fetch. Nothing is set synchronously in effects:
     "loading" is derived by comparing the current query key against the
     key of the result on screen. */
  const [completed, setCompleted] = useState<ListingResult>({
    key: '',
    state: 'ok',
    items: [],
    total: 0,
    hasMore: false,
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
    },
    [directory],
  )

  /* Strict database-side category semantics, sent up to catalog_search:
     - sub chosen       → p_category_ids = [sub]
     - top chosen       → p_category_ids = [top + its children]
     - nothing chosen   → no filter (uncategorized items show under All) */
  const categoryIds = useMemo(() => {
    if (filters.subCategoryId !== 'all') return [filters.subCategoryId]
    if (filters.categoryId !== 'all') {
      return [filters.categoryId, ...chosenSubCategories.map((c) => c.id)]
    }
    return undefined
  }, [filters.categoryId, filters.subCategoryId, chosenSubCategories])

  const mode: FilterMode = chosenCampus
    ? 'campus'
    : filters.stateId !== 'all'
      ? 'state'
      : 'all'

  const catalogQuery: CatalogQuery = useMemo(
    () => ({
      /* Campus beats state tier in the RPC ordering, so when a campus is
         chosen only p_campus_id is sent */
      campusId: chosenCampus ? filters.campusId : undefined,
      stateId: !chosenCampus && filters.stateId !== 'all' ? filters.stateId : undefined,
      categoryIds,
      condition: filters.condition === 'all' ? undefined : filters.condition,
      minPrice: filters.minPrice ?? undefined,
      maxPrice: filters.maxPrice ?? undefined,
      inStock: filters.inStock || undefined,
      search: search || undefined,
      sort: filters.sort,
    }),
    [
      chosenCampus,
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

    getCatalog({ ...catalogQuery, limit: PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (cancelled) return
        setCompleted({
          key,
          state: 'ok',
          items: page.items,
          total: page.total,
          hasMore: page.hasMore,
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setCompleted({
          key,
          state: 'error',
          items: [],
          total: 0,
          hasMore: false,
          message:
            error instanceof ApiError
              ? error.message
              : 'Unexpected error while loading items.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [queryKey, catalogQuery, listingToken, boot.state])

  /* Pagination: appends the next page of the SAME ordered list — the
     scope groups and their headings update as rows are added */
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
    getCatalog({ ...catalogQuery, limit: PAGE_SIZE, offset })
      .then((page) => {
        setLoadingMore(false)
        setCompleted((prev) =>
          prev.key !== queryKey
            ? prev
            : {
                ...prev,
                items: [...prev.items, ...page.items],
                total: page.total,
                hasMore: page.hasMore,
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

  /* ---------------------------------------------------------------------
     Nothing matched: honest compact message first, then ONE fallback
     query through catalog_search with the location filters + in-stock
     ONLY (no category, search, condition, price) — its own tier ordering
     ranks the picks, cheapest first within each tier. Shown under the
     clear "Recommended Products" heading, separated from (and never
     blended into) matching results, with no click required.
     ------------------------------------------------------------------- */
  const nothingFound = !listingLoading && completed.state === 'ok' && completed.items.length === 0
  /* Home view: no search text, no category, no chips — the storefront hero
     and promos show ONLY here; anything active renders a results page. */
  const isHomeView =
    search.trim() === '' &&
    filters.categoryId === 'all' &&
    filters.subCategoryId === 'all' &&
    activeChips.length === 0
  const suggestWhenEmpty = boot.state === 'ok' && nothingFound
  const [suggestions, setSuggestions] = useState<Product[] | null>(null)
  useEffect(() => {
    if (!suggestWhenEmpty) return
    let cancelled = false
    getRecommended({
      campusId: filters.campusId === 'all' ? undefined : filters.campusId,
      stateId:
        filters.campusId === 'all' && filters.stateId !== 'all'
          ? filters.stateId
          : undefined,
      limit: SUGGESTIONS_COUNT,
    })
      .then((items) => {
        if (cancelled) return
        setSuggestions(items)
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
    return () => {
      cancelled = true
    }
  }, [suggestWhenEmpty, filters])

  /* ---------------------------------------------------------------------
     Result-labelling vocabulary:
     - "label" = sub-category name, else category name, else the search
       text in quotes, else "items"
     - "place" = the chosen campus name, else the chosen state name
     ------------------------------------------------------------------- */
  const itemLabel = (() => {
    if (filters.subCategoryId !== 'all') {
      return (
        chosenSubCategories.find(
          (category) => category.id === filters.subCategoryId,
        )?.name ?? 'items'
      )
    }
    if (chosenTopCategory) return chosenTopCategory.name
    if (search.trim() !== '') return `“${search.trim()}”`
    return 'items'
  })()

  const chosenStateEntry = directory.find(
    (entry) => entry.stateId === filters.stateId,
  )
  const chosenStateName =
    chosenCampus?.stateName ??
    (filters.stateId !== 'all' ? chosenStateEntry?.stateName : undefined)

  /**
   * Scope grouping of the completed page (catalog_search returns rows
   * tier-ordered: chosen campus → same state → everywhere else, so the
   * groups inherit that order). Matching results always come first and
   * unrelated items are never mixed into a scope they don't belong to.
   * "Load more" appends to items, so groups and headings update.
   */
  const resultGroups = useMemo<null | {
    notice: boolean
    noticeTitle: string
    noticeHint: string
    groups: ResultGroup[]
  }>(() => {
    const items = completed.items
    if (completed.state !== 'ok' || items.length === 0) return null

    if (chosenCampus) {
      const atCampus: Product[] = []
      const inState: Product[] = []
      const elsewhere: Product[] = []
      for (const product of items) {
        if (product.campusId === chosenCampus.id) atCampus.push(product)
        else if (product.campusStateId === chosenCampus.stateId) {
          inState.push(product)
        } else elsewhere.push(product)
      }
      /* Skip headings for empty groups; the chosen-campus group is the
         "matching" group — when it is empty the notice explains why the
         visible items come from other places */
      const groups: ResultGroup[] = []
      if (atCampus.length > 0) {
        groups.push({
          heading: `${itemLabel} at ${chosenCampus.name}`,
          products: atCampus,
        })
      }
      if (inState.length > 0) {
        groups.push({
          heading: `Also in ${chosenCampus.stateName}`,
          products: inState,
        })
      }
      if (elsewhere.length > 0) {
        groups.push({ heading: 'In other places', products: elsewhere })
      }
      if (groups.length === 0) return null
      return {
        notice: atCampus.length === 0,
        noticeTitle: `No ${itemLabel} at ${chosenCampus.name} yet.`,
        noticeHint: `Here are ${itemLabel} from other places:`,
        groups,
      }
    }

    if (filters.stateId !== 'all' && chosenStateName) {
      const inState: Product[] = []
      const elsewhere: Product[] = []
      for (const product of items) {
        if (product.campusStateId === filters.stateId) inState.push(product)
        else elsewhere.push(product)
      }
      const groups: ResultGroup[] = []
      if (inState.length > 0) {
        groups.push({
          heading: `${itemLabel} in ${chosenStateName}`,
          products: inState,
        })
      }
      if (elsewhere.length > 0) {
        groups.push({ heading: 'In other places', products: elsewhere })
      }
      if (groups.length === 0) return null
      return {
        notice: inState.length === 0,
        noticeTitle: `No ${itemLabel} in ${chosenStateName} yet.`,
        noticeHint: `Here are ${itemLabel} from other places:`,
        groups,
      }
    }

    /* No location chosen: one list, no scope headings */
    return {
      notice: false,
      noticeTitle: '',
      noticeHint: '',
      groups: [{ heading: '', products: items }],
    }
  }, [
    completed.state,
    completed.items,
    chosenCampus,
    chosenStateName,
    filters.stateId,
    itemLabel,
  ])

  if (!isSupabaseConfigured) {
    return <SetupNotice />
  }

  return (
    <div className="min-h-dvh bg-cream">
      <Header
        search={searchInput}
        onSearchChange={setSearchInput}
        activeFilterCount={activeChips.length}
        onOpenFilters={() => setFilterSheetOpen(true)}
        categories={categories}
        categoryTop={filters.categoryId}
        categorySub={filters.subCategoryId}
        onCategoryTop={(categoryId) => {
          setFilters((prev) => ({
            ...prev,
            categoryId,
            subCategoryId: 'all',
          }))
        }}
        onCategorySub={(subCategoryId) => {
          setFilters((prev) => ({ ...prev, subCategoryId }))
        }}
      />

      {/* Category bar (desktop; phones use the header drawer) */}
      <CategoryMenu
        topCategories={categories.filter(
          (category) => category.parentCategoryId === null,
        )}
        categories={categories}
        top={filters.categoryId}
        sub={filters.subCategoryId}
        onTop={(categoryId) => {
          setFilters((prev) => ({
            ...prev,
            categoryId,
            subCategoryId: 'all',
          }))
        }}
        onSub={(subCategoryId) => {
          setFilters((prev) => ({ ...prev, subCategoryId }))
        }}
      />

      <main className="mx-auto max-w-6xl space-y-5 px-3 py-4 sm:px-4">
        {/* Storefront hero: home view only. Any active search/filter/category
            turns this into a results page. */}
        {isHomeView && <HeroSection />}

        {/* Location chip — the chosen place is set in Filters, shown here
            under the search bar, removable with one click. */}
        {(chosenCampus || filters.stateId !== 'all') && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 rounded-full border border-border bg-white py-1 pr-1 pl-3 text-xs font-bold text-ink">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 text-orange-deep"
                aria-hidden="true"
              >
                <path
                  d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Zm0-8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="max-w-64 truncate">
                {chosenCampus
                  ? `${chosenCampus.name}, ${chosenStateName}`
                  : chosenStateName}
              </span>
              <button
                type="button"
                onClick={
                  chosenCampus ? () => handleCampusChange('all') : () => handleStateChange('all')
                }
                aria-label={
                  chosenCampus
                    ? `Remove location: ${chosenCampus.name}`
                    : `Remove location: ${chosenStateName}`
                }
                className="rounded-full p-1 text-taupe transition-colors duration-150 hover:bg-hover hover:text-ink"
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
          </div>
        )}

        {/* Removable chips for every active filter + Clear all */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
            {activeChips.map((chip) => (
              <span
                key={chip.key}
                className="flex items-center gap-1 rounded-full border border-border bg-white py-1 pr-1 pl-3 text-xs font-medium text-ink"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.remove}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="rounded-full p-1 text-taupe transition-colors duration-150 hover:bg-hover hover:text-ink"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
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
              className="mt-3 rounded-full bg-orange px-5 py-2 text-sm font-bold text-ink transition-colors duration-150 hover:bg-orange-deep hover:text-white"
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
                      className="h-64 animate-pulse rounded-lg border border-border bg-hover"
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
                  className="mt-3 rounded-full bg-orange px-5 py-2 text-sm font-bold text-ink transition-colors duration-150 hover:bg-orange-deep hover:text-white"
                >
                  Retry
                </button>
              </section>
            )}

            {/* New arrivals — the latest items, home view only. Plain cream
                background, white cards in a horizontal scroll, bold See all.
                Hidden while the current view is EMPTY so unrelated latest
                items never appear above the empty-results message; its picks
                would duplicate the recommendations below. */}
            {isHomeView &&
              !nothingFound &&
              !listingLoading &&
              completed.state === 'ok' &&
              newArrivals.length > 0 && (
              <section aria-labelledby="arrivals-heading">
                <div className="mb-2 flex items-center justify-between">
                  <h2
                    id="arrivals-heading"
                    className="text-sm font-bold text-ink sm:text-base"
                  >
                    New arrivals
                  </h2>
                  <a
                    href="#catalog"
                    className="text-xs font-bold text-orange-deep hover:text-ink"
                  >
                    See all
                  </a>
                </div>
                <ul className="flex gap-3 overflow-x-auto pb-1">
                  {newArrivals.map((product) => (
                    <li key={product.id} className="w-40 shrink-0 sm:w-44">
                      <ProductCard product={product} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* All items with filters applied, grouped matching-first */}
            {!listingLoading && completed.state === 'ok' && (
              <section id="catalog" aria-labelledby="catalog-heading">
                <div className="mb-2 flex items-baseline justify-between">
                  <h2
                    id="catalog-heading"
                    className="text-sm font-bold text-ink sm:text-base"
                  >
                    All items
                  </h2>
                  {/* The RPC returns no exact total: "N+" while more pages
                      may exist, exact count once the last page is loaded */}
                  <div className="flex items-center gap-3">
                    {/* List/Grid toggle — results views (category/search)
                        default to the compact list; home keeps the grid */}
                    {!isHomeView && completed.items.length > 0 && (
                      <div
                        role="group"
                        aria-label="Result layout"
                        data-testid="layout-toggle"
                        className="flex items-center gap-1"
                      >
                        <button
                          type="button"
                          aria-pressed={viewMode === 'list'}
                          onClick={() => setViewMode('list')}
                          className={`rounded-full px-3 py-1 text-xs font-semibold text-ink transition-colors duration-150 ${
                            viewMode === 'list'
                              ? 'bg-hover ring-1 ring-inset ring-ink'
                              : 'hover:bg-hover'
                          }`}
                        >
                          List
                        </button>
                        <button
                          type="button"
                          aria-pressed={viewMode === 'grid'}
                          onClick={() => setViewMode('grid')}
                          className={`rounded-full px-3 py-1 text-xs font-semibold text-ink transition-colors duration-150 ${
                            viewMode === 'grid'
                              ? 'bg-hover ring-1 ring-inset ring-ink'
                              : 'hover:bg-hover'
                          }`}
                        >
                          Grid
                        </button>
                      </div>
                    )}
                    {completed.items.length > 0 && (
                      <p className="text-xs text-taupe" aria-live="polite">
                        {completed.items.length}
                        {completed.hasMore ? '+' : ''}{' '}
                        {completed.items.length === 1 ? 'item' : 'items'} found
                      </p>
                    )}
                  </div>
                </div>

                {/* Matching group empty but other scopes have rows → notice
                    at the top, then the other groups */}
                {resultGroups?.notice && (
                  <div className="mb-3 rounded-lg border border-dashed border-border bg-white px-4 py-3 text-center">
                    <p className="text-sm font-medium text-ink">
                      {resultGroups.noticeTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-ink/60">
                      {resultGroups.noticeHint}
                    </p>
                  </div>
                )}

                {/* Scope groups (heading skipped for the unscoped list) */}
                {resultGroups &&
                  resultGroups.groups.map((group, index) => (
                    <div
                      key={group.heading !== '' ? group.heading : `list-${index}`}
                      className={index > 0 ? 'mt-4' : ''}
                    >
                      {group.heading !== '' && (
                        <h3 className="mb-2 text-sm font-bold text-ink">
                          {group.heading}
                        </h3>
                      )}
                      <ProductGrid products={group.products} layout={viewMode} />
                    </div>
                  ))}

                {/* NO rows at all: the compact empty message FIRST, then the
                    recommendations directly below — never blended into any
                    results grid, never asking the buyer to click anything */}
                {completed.items.length === 0 && (
                  <section className="rounded-lg border border-dashed border-border bg-white px-4 py-5 text-center">
                    <p className="text-sm font-bold text-ink sm:text-base">
                      No matching products found
                    </p>
                    <p className="mx-auto mt-1 max-w-xs text-xs text-ink/60">
                      We couldn't find a product matching your current search.
                      Explore other available items below.
                    </p>
                  </section>
                )}

                {/* The recommendations section itself: clearly labelled,
                    no clicks needed, every card keeping its own campus +
                    state line */}
                {completed.items.length === 0 &&
                  suggestions &&
                  suggestions.length > 0 && (
                  <section
                    aria-labelledby="recommendations-heading"
                    className="mt-2 border-t border-border pt-3"
                  >
                    <h2
                      id="recommendations-heading"
                      className="mb-1 text-sm font-bold text-ink sm:text-base"
                    >
                      Recommended Products
                    </h2>
                    <p className="mb-2 text-[11px] text-ink/60">
                      Available now, closest to your location first — not part
                      of your search. Each card shows its own campus and state.
                    </p>
                    <ProductGrid products={suggestions} compact />
                  </section>
                )}

                {/* "Load more" continues the same ordered list */}
                {completed.hasMore && (
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="rounded-full border border-border bg-white px-5 py-2 text-sm font-bold text-ink transition-colors duration-150 hover:bg-hover disabled:opacity-50"
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

      <Footer />

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
          }}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}
    </div>
  )
}
