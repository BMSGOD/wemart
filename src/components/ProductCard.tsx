import type { Product } from '../types'

const formatter = new Intl.NumberFormat('en-GH', {
  style: 'currency',
  currency: 'GHS',
  maximumFractionDigits: 0,
})

export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex h-32 items-center justify-center bg-slate-100 text-5xl">
        <span aria-hidden="true">{product.emoji}</span>
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
            {product.category}
          </span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
            {product.campus}
          </span>
        </div>
      </div>
    </article>
  )
}
