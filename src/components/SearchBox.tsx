import { useId } from 'react'

type Props = {
  value: string
  onChange: (query: string) => void
}

export default function SearchBox({ value, onChange }: Props) {
  const id = useId()

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">
        🔍
      </span>
      <input
        id={id}
        type="search"
        placeholder="Search phones, books, desks…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3 pl-9 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
      />
    </div>
  )
}
