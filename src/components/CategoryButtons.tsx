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
            /* Pill shape only for chips (cards and buttons use 8px) */
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition ${
              active
                ? 'bg-orange font-semibold text-ink'
                : 'bg-white font-medium text-ink ring-1 ring-border ring-inset hover:bg-orange-tint'
            }`}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        )
      })}
    </div>
  )
}
