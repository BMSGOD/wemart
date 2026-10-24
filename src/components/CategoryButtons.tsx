import { CATEGORIES, type Category } from '../types'

type Props = {
  value: Category | 'all'
  onChange: (category: Category | 'all') => void
}

export default function CategoryButtons({ value, onChange }: Props) {
  const options: Array<Category | 'all'> = ['all', ...CATEGORIES]

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      role="group"
      aria-label="Filter by category"
    >
      {options.map((cat) => {
        const active = value === cat
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            aria-pressed={active}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              active
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50'
            }`}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        )
      })}
    </div>
  )
}
