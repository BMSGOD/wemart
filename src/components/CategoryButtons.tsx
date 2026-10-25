import type { CategoryRef } from '../types'

type Props = {
  /** Top-level categories (parent_category_id = null), sort_order order */
  topCategories: CategoryRef[]
  /** Children of the currently chosen top-level category (may be empty) */
  subCategories: CategoryRef[]
  /** Active top-level id ('all' or a category id) */
  top: string
  /** Active sub-category id ('all' or a category id) */
  sub: string
  /** Name of the active top-level category (for the "All Gadgets" chip) */
  topName: string
  onTop: (categoryId: string) => void
  onSub: (subCategoryId: string) => void
}

function chipClass(active: boolean): string {
  return `shrink-0 rounded-full px-4 py-1.5 text-sm transition ${
    active
      ? 'bg-orange font-semibold text-ink'
      : 'bg-white font-medium text-ink ring-1 ring-border ring-inset hover:bg-orange-tint'
  }`
}

/**
 * Two-level category chips: top-level row ("All" first) loaded from the
 * database, plus a second row of sub-chips shown only when the chosen
 * top-level category has children. Filtering itself happens strictly in
 * the database query — these chips only change ids.
 */
export default function CategoryButtons({
  topCategories,
  subCategories,
  top,
  sub,
  topName,
  onTop,
  onSub,
}: Props) {
  const topOptions: CategoryRef[] = [
    { id: 'all', name: 'All', parentCategoryId: null, sortOrder: -1 },
    ...topCategories,
  ]

  return (
    <div className="space-y-2" role="group" aria-label="Filter by category">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {topOptions.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onTop(category.id)}
            aria-pressed={top === category.id}
            /* Pill shape only for chips (cards and buttons use 8px) */
            className={chipClass(top === category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      {topCategories.length > 0 && top !== 'all' && subCategories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Sub-categories">
          <button
            type="button"
            onClick={() => onSub('all')}
            aria-pressed={sub === 'all'}
            className={chipClass(sub === 'all')}
          >
            All {topName}
          </button>
          {subCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onSub(category.id)}
              aria-pressed={sub === category.id}
              className={chipClass(sub === category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
