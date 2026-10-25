import { useState } from 'react'
import type { Availability, Condition, Product } from '../types'

/* Naira prices render as-is from the DB — never divided */
const formatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

const CONDITION_LABEL: Record<Condition, string> = {
  new: 'New',
  'like-new': 'Like new', // sample data only; live catalog has no like-new
  used: 'Used',
  refurbished: 'Refurbished',
  other: 'Other',
}

const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: 'In stock',
  reserved: 'Reserved', // sample data only
  sold: 'Sold out',
}

/* Green marker only for in-stock items; everything else stays neutral ink */
const AVAILABILITY_CLASS: Record<Availability, string> = {
  available: 'text-green',
  reserved: 'text-ink/60',
  sold: 'text-ink/40',
}

export default function ProductCard({ product }: { product: Product }) {
  const unavailable = product.availability !== 'available'
  const [imageBroken, setImageBroken] = useState(false)
  const showImage = product.imageUrl !== undefined && !imageBroken

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-lg border border-border bg-white transition ${
        unavailable
          ? 'opacity-60'
          /* hard offset shadow on hover/press — flat, ink, no blur */
          : 'hover:hard-shadow active:hard-shadow hover:-translate-y-0.5 motion-reduce:hover:translate-y-0'
      }`}
    >
      {/* Real listings (image_path) use their Storage photo, lazy-loaded;
          everything else keeps the CSS emoji + brand tint placeholder. */}
      <div className="relative flex h-28 items-center justify-center bg-orange-tint sm:h-32">
        {showImage ? (
          <img
            src={product.imageUrl}
            alt={product.imageAlt ?? product.title}
            width={320}
            height={256}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => {
              /* Broken URL degrades to the placeholder, never a broken page */
              setImageBroken(true)
            }}
          />
        ) : (
          <span aria-hidden="true" className="text-4xl">
            {product.emoji}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="text-sm leading-snug font-semibold text-ink">
          {product.title}
        </h3>
        {product.variantName && (
          <p className="text-[11px] text-ink/60">{product.variantName}</p>
        )}

        {/* Plain bold price in ink, right under the name */}
        <p className="text-base font-bold text-ink">
          {formatter.format(product.price)}
        </p>

        {/* Vendor shop name */}
        <p className="truncate text-[11px] text-ink/70">
          {product.vendor}
        </p>

        {/* Campus or pickup location name */}
        {product.locationName && (
          <p className="truncate text-[11px] text-ink/60">
            {product.locationName}
          </p>
        )}

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
