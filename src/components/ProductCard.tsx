import { useState } from 'react'
import type { Condition, Product } from '../types'
import { Icon, categoryIcon } from './icons'

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

/* The six soft tones (token pairs: background + matching dark accent).
   Blush pairs with orange-deep; butter pairs with brown. */
type Tone = { bg: string; fg: string }
const TONES: Tone[] = [
  { bg: 'bg-sky', fg: 'text-navy' },
  { bg: 'bg-sage', fg: 'text-forest' },
  { bg: 'bg-sand', fg: 'text-brown' },
  { bg: 'bg-blush', fg: 'text-orange-deep' },
  { bg: 'bg-butter', fg: 'text-brown' },
  { bg: 'bg-lilac', fg: 'text-plum' },
]

/* Deterministic tone: a stable hash of the CATEGORY KEY (the row's category
   name — the Product type carries no category id) → the same category always
   renders on the same soft tone across reloads and sessions. */
function categoryTone(categoryKey: string): Tone {
  let hash = 0
  for (let i = 0; i < categoryKey.length; i += 1) {
    hash = (hash * 31 + categoryKey.charCodeAt(i)) >>> 0
  }
  return TONES[hash % TONES.length]
}

/* Availability: quantity-aware, honest labels.
   - in stock (5+ or unknown count) → green "n in stock"/"In stock"
   - low stock (1–4) → bold orange-deep "Only n left"
   - sold/reserved → taupe "Out of stock" */
function stockLabel(product: Product): { label: string; className: string } {
  const qty = product.availableQuantity
  if (product.availability !== 'available') {
    return { label: 'Out of stock', className: 'text-taupe' }
  }
  if (typeof qty === 'number') {
    if (qty <= 4) {
      return {
        label: `Only ${qty} left`,
        className: 'font-bold text-orange-deep',
      }
    }
    return { label: `${qty} in stock`, className: 'text-green' }
  }
  return { label: 'In stock', className: 'text-green' }
}

type Props = {
  product: Product
  /** 'grid' (default): vertical card. 'list': compact horizontal row. */
  layout?: 'grid' | 'list'
}

export default function ProductCard({ product, layout = 'grid' }: Props) {
  const [imageBroken, setImageBroken] = useState(false)
  const showImage = product.imageUrl !== undefined && !imageBroken
  const tone = categoryTone(product.category)
  const stock = stockLabel(product)
  const unavailable = product.availability !== 'available'

  /* Cards are flat with a 1px border; hover = border-colour change plus a
     very light soft shadow. No lifting, no scaling, no hard offsets. */
  const cardClass =
    'relative overflow-hidden rounded-lg border border-border bg-white transition-colors duration-150 hover:border-ink/25 hover:shadow-soft motion-reduce:transition-none'

  /* Image (or one of the six soft-tone placeholders when no photo) */
  const imageArea = (list: boolean) => (
    <div
      className={`relative flex shrink-0 items-center justify-center ${tone.bg} ${
        list ? 'h-20 w-24 rounded-lg' : 'h-28 w-full sm:h-32'
      } ${list ? 'overflow-hidden' : ''}`}
    >
      {showImage ? (
        <img
          src={product.imageUrl}
          alt={product.imageAlt ?? product.title}
          width={320}
          height={256}
          loading="lazy"
          decoding="async"
          className={list ? 'h-full w-full rounded-lg object-cover' : 'h-full w-full object-cover'}
          onError={() => {
            /* Broken URL degrades to the placeholder, never a broken page */
            setImageBroken(true)
          }}
        />
      ) : (
        <Icon
          name={categoryIcon(product.category)}
          className={list ? `h-6 w-6 ${tone.fg}` : `h-9 w-9 ${tone.fg}`}
          strokeWidth={1.5}
        />
      )}
    </div>
  )

  const price = (
    <p className="text-sm font-bold text-ink sm:text-base">{formatter.format(product.price)}</p>
  )
  const badges = (list: boolean) => (
    <div className={list ? 'flex flex-col items-start gap-1' : 'flex flex-1 flex-col items-start gap-1'}>
      {/* Campus + state pill in grey — grey/sand tone, ink text */}
      {(product.campusName || product.campusStateName) && !list && (
        <p className="flex max-w-full items-center gap-1 self-start truncate rounded-full bg-hover px-2 py-0.5 text-[10px] font-medium text-ink">
          <Icon name="pin" className="h-3 w-3 shrink-0 text-taupe" />
          <span className="truncate">
            {product.campusName && product.campusStateName
              ? `${product.campusName}, ${product.campusStateName}`
              : (product.campusName ?? product.campusStateName)}
          </span>
        </p>
      )}
      {/* Condition badge (sand, ink text) + honest stock label */}
      <div className={`flex items-center justify-between gap-1 text-[11px] ${list ? 'w-full' : 'mt-auto w-full'}`}>
        <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-semibold text-ink">
          {CONDITION_LABEL[product.condition]}
        </span>
        <span className={`truncate font-semibold ${stock.className}`}>{stock.label}</span>
      </div>
    </div>
  )
  const meta = (list: boolean) => (
    <p className={`truncate text-[11px] text-taupe ${list ? '' : 'mt-0.5'}`}>
      {product.vendor}
      {!list && product.campusStateName ? ` · ${product.campusStateName}` : ''}
    </p>
  )

  if (layout === 'list') {
    return (
      <article className={cardClass} data-testid="product-list-row">
        <div className="flex items-start gap-3 p-2">
          {imageArea(true)}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h3 className="truncate text-sm font-semibold text-ink">{product.title}</h3>
            {product.variantName && (
              <p className="truncate text-[11px] text-taupe">{product.variantName}</p>
            )}
            {price}
            {meta(true)}
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-semibold text-ink">
                {CONDITION_LABEL[product.condition]}
              </span>
              <span className={`shrink-0 font-semibold ${stock.className}`}>{stock.label}</span>
            </div>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className={`${cardClass} flex flex-col`} data-testid="product-card">
      {imageArea(false)}
      <div className={`flex flex-1 flex-col gap-1 p-3 ${unavailable ? 'opacity-60' : ''}`}>
        <h3 className="text-sm leading-snug font-semibold text-ink">{product.title}</h3>
        {product.variantName && (
          <p className="text-[11px] text-taupe">{product.variantName}</p>
        )}
        {price}
        {meta(false)}
        {badges(false)}
      </div>
    </article>
  )
}
