import type { Availability, Condition, Product } from '../types'
import Starburst from './Starburst'

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

        {/* Price inside the brand starburst badge */}
        <Starburst
          size={52}
          className="absolute top-2 right-2 text-orange"
        >
          <span
            className="text-[9px] font-bold text-ink sm:text-[10px]"
            aria-hidden="true"
          >
            {formatter.format(product.price)}
          </span>
          <span className="sr-only">
            Price: {formatter.format(product.price)}
          </span>
        </Starburst>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="text-sm leading-snug font-semibold text-ink">
          {product.title}
        </h3>

        {/* Vendor + verified badge */}
        <p className="flex items-center gap-1 text-[11px] text-ink/70">
          {product.verified && (
            <Starburst size={13} className="text-green" title="Verified vendor">
              <svg viewBox="0 0 12 12" className="h-2 w-2" aria-hidden="true">
                <path
                  d="M2.5 6.5l2.5 2.5 4.5-6"
                  stroke="#fff"
                  strokeWidth="2.2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Starburst>
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
