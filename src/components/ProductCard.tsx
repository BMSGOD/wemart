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
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
}

/* Tailwind string is complete up front so purge/scan keeps every state */
const AVAILABILITY_BADGE: Record<Availability, string> = {
  available: 'bg-emerald-50 text-emerald-700',
  reserved: 'bg-amber-50 text-amber-700',
  sold: 'bg-slate-200 text-slate-500',
}

export default function ProductCard({ product }: { product: Product }) {
  const unavailable = product.availability !== 'available'

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        unavailable
          ? 'border-slate-200 opacity-60'
          : 'border-slate-200 hover:shadow-md'
      }`}
    >
      <div className="relative flex h-32 items-center justify-center bg-slate-100 text-5xl">
        <span aria-hidden="true">{product.emoji}</span>
        <span
          className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${AVAILABILITY_BADGE[product.availability]}`}
        >
          {AVAILABILITY_LABEL[product.availability]}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-sm leading-snug font-semibold text-slate-900">
          {product.title}
        </h3>
        <p className="text-base font-bold text-emerald-700">
          {formatter.format(product.price)}
        </p>
        <div className="mt-auto flex flex-wrap gap-1 pt-1 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
            {CONDITION_LABEL[product.condition]}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
            {product.category}
          </span>
        </div>
      </div>
    </article>
  )
}
