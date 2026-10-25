import { useId, useMemo } from 'react'
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

/**
 * Two linked selects for the STATE → CAMPUS location model:
 * State (all states in campus_directory, plus "All states") and
 * Campus (campuses of the chosen state, plus "All campuses").
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

  /* Unique states, in campus_directory order */
  const states = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of directory) {
      if (!map.has(entry.stateId)) map.set(entry.stateId, entry.stateName)
    }
    return [...map].map(([id, name]) => ({ id, name }))
  }, [directory])

  /* Campuses of the chosen state; all campuses when no state is chosen */
  const campuses = useMemo(() => {
    if (location.stateId === 'all') return directory
    return directory.filter((entry) => entry.stateId === location.stateId)
  }, [directory, location.stateId])

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
          onChange={(e) => onStateChange(e.target.value)}
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
      <div className={compact ? 'min-w-0 flex-1' : ''}>
        <label
          htmlFor={campusSelectId}
          className={compact ? 'sr-only' : 'mb-1 block text-sm font-medium text-ink'}
        >
          Campus
        </label>
        <select
          id={campusSelectId}
          value={location.campusId}
          onChange={(e) => onCampusChange(e.target.value)}
          className={`w-full rounded-lg border border-border bg-white text-ink transition hover:border-ink/40 focus:border-ink ${campusClass}`}
        >
          <option value="all">All campuses</option>
          {campuses.map((campus) => (
            <option key={campus.id} value={campus.id}>
              {campus.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
