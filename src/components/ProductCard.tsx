import type { Availability, Condition, Product } from '../types'

const formatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

const CONDITION_LABEL: Record<Condition, string> = {
  new: 'New',
  'like-new': 'Like new',
  used: 'Used',
}

const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: 'In stock',
  reserved: 'Reserved',
  sold: 'Sold',
}

/* Green marker only for available items; reserved/sold stay neutral ink */
const AVAILABILITY_CLASS: Record<Availability, string> = {
  available: 'text-green',
  reserved: 'text-ink/60',
  sold: 'text-ink/40',
}

export default function ProductCard({ product }: { product: Product }) {
  const unavailable = product.availability !== 'available'

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-lg border border-border bg-white transition ${
        unavailable
          ? 'opacity-60'
          /* hard offset shadow on hover/press — flat, ink, no blur */
          : 'hover:hard-shadow active:hard-shadow hover:-translate-y-0.5 motion-reduce:hover:translate-y-0'
      }`}
    >
      {/* Image placeholder, CSS only (emoji + brand tint until uploads exist) */}
      <div className="relative flex h-28 items-center justify-center bg-orange-tint text-4xl sm:h-32">
        <span aria-hidden="true">{product.emoji}</span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="text-sm leading-snug font-semibold text-ink">
          {product.title}
        </h3>

        {/* Plain bold price in ink, right under the name */}
        <p className="text-base font-bold text-ink">
          {formatter.format(product.price)}
        </p>

        {/* Vendor + verified check */}
        <p className="flex items-center gap-1 text-[11px] text-ink/70">
          {product.verified && (
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-label="Verified vendor" role="img">
              <circle cx="8" cy="8" r="7.5" fill="#1B7F46" />
              <path
                d="M4.8 8.4l2.1 2.1 4.3-4.8"
                stroke="#fff"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span className="truncate">{product.vendor}</span>
        </p>

        {/* Condition + availability markers */}
        <div className="mt-auto flex items-center justify-between gap-1 pt-1 text-[11px]">
          <span className="font-medium text-ink/60">
            {CONDITION_LABEL[product.condition]}
          </span>
          <span
            className={`flex items-center gap-1 font-semibold ${AVAILABILITY_CLASS[product.availability]}`}
          >
            <span
              className="h-2 w-2 rounded-full bg-current"
              aria-hidden="true"
            />
            {AVAILABILITY_LABEL[product.availability]}
          </span>
        </div>
      </div>
    </article>
  )
}
