import { useId } from 'react'

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
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="pointer-events-none absolute top-2.5 left-3 h-5 w-5 text-ink/40"
      >
        <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        type="search"
        placeholder="Search phones, books, desks…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-white py-2.5 pr-3 pl-10 text-base text-ink transition placeholder:text-ink/40 hover:border-ink/40 focus:border-ink"
      />
    </div>
  )
}
