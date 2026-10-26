import type { CategoryRef } from '../types'
import { Icon, categoryIcon } from './icons'
import { Link } from '../lib/router'

/* Brand tokens mirrored from @theme in src/index.css (pure CSS values). */
const HERO_GRADIENT = 'linear-gradient(135deg, #181311 0%, #181311 34%, #ef5b2d 100%)'

function tileClass(colour: string): string {
  return `flex flex-1 items-center gap-3 rounded-lg border border-border/40 p-3.5 sm:p-4 ${colour}`
}

/**
 * Home hero row (home view only): a large Ink→Orange diagonal banner with a
 * carousel-ready single-slide structure, plus two stacked promo tiles in
 * different brand colours. No motion yet — one static slide.
 */
export function HeroSection() {
  return (
    <section aria-label="Wemart highlights" className="grid gap-3 lg:grid-cols-[2fr_1fr]">
      {/* Banner slide 1 of 1 (carousel-ready container shape) */}
      <div className="overflow-hidden rounded-lg" aria-roledescription="carousel" aria-label="Promotions">
        <div
          className="relative flex min-h-44 flex-col justify-between rounded-lg p-4 sm:min-h-52 sm:p-6"
          style={{ background: HERO_GRADIENT }}
          aria-roledescription="slide"
          aria-label="1 of 1"
        >
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              Discover on Wemart.
            </h1>
            <p className="mt-2 max-w-md text-xs text-white/80 sm:text-sm">
              Phones, books, furniture and more from student vendors across
              Nigerian campuses.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="#catalog"
              className="rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-ink transition hover:bg-orange-tint active:translate-x-0.5 active:translate-y-0.5 motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0"
            >
              Start shopping
            </a>
            <Link
              href="/sell"
              className="rounded-lg border-2 border-white/70 px-4 py-2 text-sm font-bold text-white transition hover:border-white hover:bg-white/10 active:translate-x-0.5 active:translate-y-0.5 motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0"
            >
              Sell an item
              <Icon name="plus" className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Two stacked promo tiles */}
      <div className="flex flex-col gap-3">
        <Link
          href="/sell"
          className={tileClass('bg-ink text-white')}
          data-testid="promo-sell"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange">
            <Icon name="sell" className="h-5 w-5 text-ink" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">
              Sell on Wemart: reach students on your campus
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-orange">
              List your first item
              <Icon name="arrow" className="h-3 w-3" />
            </span>
          </span>
        </Link>
        <a
          href="#catalog"
          className={tileClass('bg-orange-tint text-ink')}
          data-testid="promo-campus"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink">
            <Icon name="pin" className="h-5 w-5 text-orange" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">
              Browse by campus: find items near you
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-orange-deep">
              Pick your campus in Filters
              <Icon name="arrow" className="h-3 w-3" />
            </span>
          </span>
        </a>
      </div>
    </section>
  )
}

/**
 * "Shop by category" — round icon tiles, one per top-level category,
 * identical filter logic to the old chip row (onTop(id)).
 */
export function CategoryTilesRow({
  topCategories,
  onTop,
}: {
  topCategories: CategoryRef[]
  onTop: (categoryId: string) => void
}) {
  if (topCategories.length === 0) return null
  return (
    <section aria-labelledby="tiles-heading">
      <h2 id="tiles-heading" className="mb-2 text-sm font-bold text-ink sm:text-base">
        Shop by category
      </h2>
      <ul className="flex gap-2 overflow-x-auto pb-1 sm:gap-3">
        {topCategories.map((category) => (
          <li key={category.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onTop(category.id)}
              className="flex w-18 flex-col items-center gap-1.5 rounded-lg p-1.5 transition hover:bg-orange-tint focus-visible:bg-orange-tint motion-reduce:transition-none"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-orange-tint transition hover:bg-orange sm:h-16 sm:w-16">
                <Icon
                  name={categoryIcon(category.name)}
                  className="h-6 w-6 text-orange-deep sm:h-7 sm:w-7"
                  strokeWidth={1.6}
                />
              </span>
              <span className="line-clamp-2 text-center text-[11px] font-bold text-ink">
                {category.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
