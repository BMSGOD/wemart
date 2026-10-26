import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CampusDirectoryEntry,
  CategoryRef,
  Condition,
  Filters,
  SortOption,
} from '../types'
import { DEFAULT_FILTERS } from '../types'

/** Campus lists longer than this get the "Find your campus" filter box */
const FIND_THRESHOLD = 10

type Props = {
  directory: CampusDirectoryEntry[]
  categories: CategoryRef[]
  value: Filters
  onApply: (filters: Filters) => void
  onClose: () => void
}

const CONDITION_OPTIONS: Array<{ value: Condition | 'all'; label: string }> = [
  { value: 'all', label: 'Any condition' },
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Used' },
  { value: 'refurbished', label: 'Refurbished' },
]

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
]

const selectClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-ink/40 focus:border-ink'
const numberInputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink transition hover:border-ink/40 focus:border-ink'

function parsePrice(raw: string): number | null {
  if (raw.trim() === '') return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * Draft-based filter editor. Opens as a bottom sheet on phones and a
 * right side panel from sm: up. "Apply" commits the draft; "Reset"
 * applies the defaults immediately and closes. Closes on Escape and
 * backdrop activation; the panel takes focus when opened.
 */
export default function FilterSheet({
  directory,
  categories,
  value,
  onApply,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<Filters>(value)
  const panelRef = useRef<HTMLDivElement>(null)
  /* "Find your campus" filters the campus select below as the user types */
  const [campusQuery, setCampusQuery] = useState('')

  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const states = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of directory) {
      if (!map.has(entry.stateId)) map.set(entry.stateId, entry.stateName)
    }
    return [...map].map(([id, name]) => ({ id, name }))
  }, [directory])

  const campuses = useMemo(() => {
    if (draft.stateId === 'all') return directory
    return directory.filter((entry) => entry.stateId === draft.stateId)
  }, [directory, draft.stateId])

  /* "Find your campus": only narrows the <option> list, never the choice */
  const findTerm = campusQuery.trim().toLowerCase()
  const shownCampuses = findTerm
    ? campuses.filter((campus) =>
        campus.name.toLowerCase().includes(findTerm),
      )
    : campuses

  /* All-states lists group campuses under their state (optgroups) */
  const campusGroups = useMemo(() => {
    if (draft.stateId !== 'all') return []
    const map = new Map<string, CampusDirectoryEntry[]>()
    for (const campus of shownCampuses) {
      const list = map.get(campus.stateId)
      if (list) list.push(campus)
      else map.set(campus.stateId, [campus])
    }
    const groups = [...map].map(([stateId, list]) => ({
      stateId,
      stateName: list[0]?.stateName ?? '',
      campuses: list,
    }))
    return groups.sort((a, b) => a.stateName.localeCompare(b.stateName))
  }, [shownCampuses, draft.stateId])

  const chosenTop = categories.find(
    (category) =>
      category.id === draft.categoryId && category.parentCategoryId === null,
  )
  const subCategories = chosenTop
    ? categories.filter((category) => category.parentCategoryId === chosenTop.id)
    : []

  const update = (patch: Partial<Filters>) =>
    setDraft((prev) => ({ ...prev, ...patch }))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end">
      {/* Backdrop doubles as a focusable close affordance */}
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filters-heading"
        className="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-lg border border-border bg-white p-4 outline-none sm:h-dvh sm:max-h-none sm:w-[24rem] sm:rounded-none sm:rounded-l-lg sm:border-r-0"
      >
        <div className="flex items-center justify-between pb-2">
          <h2 id="filters-heading" className="text-sm font-bold text-ink sm:text-base">
            Filters
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="rounded-lg p-2 text-ink/60 transition-colors duration-150 hover:bg-hover hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">State</span>
            <select
              value={draft.stateId}
              onChange={(e) => {
                setCampusQuery('')
                update({ stateId: e.target.value, campusId: 'all' })
              }}
              className={selectClass}
            >
              <option value="all">All states</option>
              {states.map((state) => (
                <option key={state.id} value={state.id}>
                  {state.name}
                </option>
              ))}
            </select>
          </label>

          {campuses.length > FIND_THRESHOLD && (
            <label className="block">
              <span className="sr-only">Find your campus</span>
              <input
                type="search"
                value={campusQuery}
                onChange={(e) => setCampusQuery(e.target.value)}
                placeholder="Find your campus"
                autoComplete="off"
                className={numberInputClass}
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Campus</span>
            <select
              value={draft.campusId}
              onChange={(e) => {
                setCampusQuery('')
                update({ campusId: e.target.value })
              }}
              className={selectClass}
            >
              <option value="all">All campuses</option>
              {draft.stateId === 'all' ? (
                campusGroups.map((group) => (
                  <optgroup key={group.stateId} label={group.stateName}>
                    {group.campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.name}
                      </option>
                    ))}
                  </optgroup>
                ))
              ) : (
                shownCampuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Category</span>
            <select
              value={draft.categoryId}
              onChange={(e) =>
                update({ categoryId: e.target.value, subCategoryId: 'all' })
              }
              className={selectClass}
            >
              <option value="all">All categories</option>
              {categories
                .filter((category) => category.parentCategoryId === null)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>

          {chosenTop && subCategories.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink">
                Sub-category ({chosenTop.name})
              </span>
              <select
                value={draft.subCategoryId}
                onChange={(e) => update({ subCategoryId: e.target.value })}
                className={selectClass}
              >
                <option value="all">All {chosenTop.name}</option>
                {subCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Condition</span>
            <select
              value={draft.condition}
              onChange={(e) =>
                update({ condition: e.target.value as Condition | 'all' })
              }
              className={selectClass}
            >
              {CONDITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold text-ink">
                Price from (₦)
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={draft.minPrice ?? ''}
                onChange={(e) => update({ minPrice: parsePrice(e.target.value) })}
                className={numberInputClass}
              />
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-xs font-semibold text-ink">
                Price to (₦)
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Any"
                value={draft.maxPrice ?? ''}
                onChange={(e) => update({ maxPrice: parsePrice(e.target.value) })}
                className={numberInputClass}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
            <input
              type="checkbox"
              checked={draft.inStock}
              onChange={(e) => update({ inStock: e.target.checked })}
              className="h-4 w-4 accent-green"
            />
            <span className="text-sm font-medium text-ink">In stock only</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink">Sort</span>
            <select
              value={draft.sort}
              onChange={(e) => update({ sort: e.target.value as SortOption })}
              className={selectClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex gap-2 pb-2">
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="flex-1 rounded-full bg-orange px-4 py-2.5 text-sm font-bold text-ink transition-colors duration-150 hover:bg-orange-deep hover:text-white"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => onApply({ ...DEFAULT_FILTERS })}
            className="flex-1 rounded-full border border-ink bg-white px-4 py-2.5 text-sm font-bold text-ink transition-colors duration-150 hover:bg-hover"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
