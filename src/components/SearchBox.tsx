import { useId } from 'react'
import Starburst from './Starburst'

type Props = {
  value: string
  onChange: (query: string) => void
}

export default function SearchBox({ value, onChange }: Props) {
  const id = useId()

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Search items on campus
      </label>
      <Starburst size={20} className="pointer-events-none absolute top-3 left-3 text-orange">
        <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </Starburst>
      <input
        id={id}
        type="search"
        placeholder="Search phones, books, desks…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-white py-3 pr-3 pl-10 text-base text-ink transition placeholder:text-ink/40 hover:border-ink/40 focus:border-ink"
      />
    </div>
  )
}
