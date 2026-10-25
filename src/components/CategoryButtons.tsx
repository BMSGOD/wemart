import type { CategoryRef } from '../types'

type Props = {
  /** Active category rows loaded from the DB */
  categories: CategoryRef[]
  value: string
  onChange: (categoryId: string) => void
}

export default function CategoryButtons({
  categories,
  value,
  onChange,
}: Props) {
  const options: CategoryRef[] = [
    { id: 'all', name: 'All' },
    ...categories,
  ]

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      role="group"
      aria-label="Filter by category"
    >
      {options.map((category) => {
        const active = value === category.id
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onChange(category.id)}
            aria-pressed={active}
            /* Pill shape only for chips (cards and buttons use 8px) */
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition ${
              active
                ? 'bg-orange font-semibold text-ink'
                : 'bg-white font-medium text-ink ring-1 ring-border ring-inset hover:bg-orange-tint'
            }`}
          >
            {category.name}
          </button>
        )
      })}
    </div>
  )
}
