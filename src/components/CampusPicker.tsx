import { CAMPUSES } from '../data/campuses'

type Props = {
  value: string
  onChange: (campusId: string) => void
}

export default function CampusPicker({ value, onChange }: Props) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">
        Campus
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 focus:outline-none"
      >
        <option value="all">All campuses</option>
        {CAMPUSES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}
