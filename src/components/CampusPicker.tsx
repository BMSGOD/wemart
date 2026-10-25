import { useId } from 'react'
import type { Campus } from '../types'

type Props = {
  /** Campus list loaded from the DB (locations where location_type='campus') */
  campuses: Campus[]
  value: string
  onChange: (campusId: string) => void
  /** Smaller variant for the sticky header */
  compact?: boolean
}

export default function CampusPicker({
  campuses,
  value,
  onChange,
  compact = false,
}: Props) {
  const id = useId()

  return (
    <div className={compact ? 'max-w-[13rem] flex-1' : 'w-full'}>
      <label
        htmlFor={id}
        className={
          compact
            ? 'sr-only'
            : 'mb-1 block text-sm font-medium text-ink'
        }
      >
        Campus
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-border bg-white text-ink transition hover:border-ink/40 ${
          compact
            ? 'px-2 py-1.5 text-xs font-medium'
            : 'px-3 py-3 text-base font-medium shadow-none focus:border-ink'
        }`}
      >
        <option value="all">All campuses</option>
        {campuses.map((campus) => (
          <option key={campus.id} value={campus.id}>
            {campus.name}
          </option>
        ))}
      </select>
    </div>
  )
}
