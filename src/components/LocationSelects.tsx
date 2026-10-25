import { useId, useMemo, useState } from 'react'
import type { CampusDirectoryEntry } from '../types'

export type LocationSelection = {
  /** 'all' = every state */
  stateId: string
  /** 'all' = every campus (within the state when one is chosen) */
  campusId: string
}

type Props = {
  /** Rows from the campus_directory view */
  directory: CampusDirectoryEntry[]
  location: LocationSelection
  onStateChange: (stateId: string) => void
  onCampusChange: (campusId: string) => void
  /** Compact styling for the sticky header */
  compact?: boolean
}

/** Campus lists longer than this get the "Find your campus" filter box */
const FIND_THRESHOLD = 10

/**
 * Two linked selects for the STATE → CAMPUS location model:
 * State (all states in campus_directory, alphabetical) and Campus
 * (that state's campuses; or every campus grouped by state with
 * optgroups when "All states" is chosen). With the national directory
 * (~110 campuses) a small "Find your campus" box filters the campus
 * options as the user types.
 */
export default function LocationSelects({
  directory,
  location,
  onStateChange,
  onCampusChange,
  compact = false,
}: Props) {
  const stateSelectId = useId()
  const campusSelectId = useId()
  const [campusQuery, setCampusQuery] = useState('')

  /* Unique states, alphabetical */
  const states = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of directory) {
      if (!map.has(entry.stateId)) map.set(entry.stateId, entry.stateName)
    }
    return [...map]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [directory])

  /* Campuses of the chosen state; every campus when no state is chosen */
  const allCampuses = useMemo(() => {
    if (location.stateId === 'all') return directory
    return directory.filter((entry) => entry.stateId === location.stateId)
  }, [directory, location.stateId])

  /* "Find your campus" narrows the option list as the user types */
  const term = campusQuery.trim().toLowerCase()
  const campuses = term
    ? allCampuses.filter((entry) =>
        entry.name.toLowerCase().includes(term),
      )
    : allCampuses

  /* Grouped by state for optgroups; each group is sorted with the states */
  const groups = useMemo(() => {
    const map = new Map<string, CampusDirectoryEntry[]>()
    for (const entry of campuses) {
      const list = map.get(entry.stateId)
      if (list) list.push(entry)
      else map.set(entry.stateId, [entry])
    }
    const out = [...map].map(([stateId, list]) => ({
      stateId,
      stateName: states.find((state) => state.id === stateId)?.name ?? '',
      campuses: list,
    }))
    return out.sort((a, b) => a.stateName.localeCompare(b.stateName))
  }, [campuses, states])

  const showFindBox = !compact && allCampuses.length > FIND_THRESHOLD

  const stateClass = compact
    ? 'min-w-0 flex-1 max-w-[8.5rem] px-2 py-1.5 text-xs font-medium'
    : 'w-full px-3 py-3 text-base font-medium shadow-none focus:border-ink'
  const campusClass = compact
    ? 'min-w-0 flex-1 max-w-[13rem] px-2 py-1.5 text-xs font-medium'
    : 'w-full px-3 py-3 text-base font-medium shadow-none focus:border-ink'

  return (
    <div className={compact ? 'flex min-w-0 gap-1.5' : 'w-full space-y-3'}>
      <div className={compact ? 'min-w-0 flex-1' : ''}>
        <label
          htmlFor={stateSelectId}
          className={compact ? 'sr-only' : 'mb-1 block text-sm font-medium text-ink'}
        >
          State
        </label>
        <select
          id={stateSelectId}
          value={location.stateId}
          onChange={(e) => {
            /* The campus list changes wholesale — clear any filter text */
            setCampusQuery('')
            onStateChange(e.target.value)
          }}
          className={`w-full rounded-lg border border-border bg-white text-ink transition hover:border-ink/40 focus:border-ink ${stateClass}`}
        >
          <option value="all">All states</option>
          {states.map((state) => (
            <option key={state.id} value={state.id}>
              {state.name}
            </option>
          ))}
        </select>
      </div>
      <div className={compact ? 'min-w-0 flex-1' : 'w-full'}>
        <label
          htmlFor={campusSelectId}
          className={compact ? 'sr-only' : 'mb-1 block text-sm font-medium text-ink'}
        >
          Campus
        </label>
        {showFindBox && (
          <input
            type="search"
            value={campusQuery}
            onChange={(e) => setCampusQuery(e.target.value)}
            placeholder="Find your campus"
            aria-label="Find your campus"
            autoComplete="off"
            className="mb-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink transition placeholder:text-ink/40 hover:border-ink/40 focus:border-ink"
          />
        )}
        <select
          id={campusSelectId}
          value={location.campusId}
          onChange={(e) => {
            setCampusQuery('')
            onCampusChange(e.target.value)
          }}
          className={`w-full rounded-lg border border-border bg-white text-ink transition hover:border-ink/40 focus:border-ink ${campusClass}`}
        >
          <option value="all">All campuses</option>
          {location.stateId === 'all' ? (
            /* National list: one optgroup per state, grouped alphabetically */
            groups.map((group) => (
              <optgroup key={group.stateId} label={group.stateName}>
                {group.campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </optgroup>
            ))
          ) : (
            campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))
          )}
        </select>
      </div>
    </div>
  )
}
