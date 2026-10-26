import { Icon } from './icons'
import { Link } from '../lib/router'

/**
 * Home hero row (home view only) — a flat sky panel and two stacked promo
 * tiles in sage and sand. Calm Etsy-inspired treatment: flat fills, ink
 * text, pill buttons, one bold link line per tile. No gradients, no dark
 * background areas, no decorative elements.
 */

export function HeroSection() {
  const pillBase =
    'rounded-full px-5 py-2.5 text-sm font-bold transition-colors duration-150 motion-reduce:transition-none'
  return (
    <section aria-label="Wemart highlights" className="grid gap-3 lg:grid-cols-[2fr_1fr]">
      {/* Banner slide 1 of 1 (carousel-ready container shape) */}
      <div className="overflow-hidden rounded-lg" aria-roledescription="carousel" aria-label="Promotions">
        <div
          className="relative flex min-h-44 flex-col justify-between rounded-lg bg-sky p-5 sm:min-h-52 sm:p-6"
          aria-roledescription="slide"
          aria-label="1 of 1"
        >
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
              Discover on Wemart.
            </h1>
            <p className="mt-2 max-w-md text-xs text-ink sm:text-sm">
              Phones, books, furniture and more from student vendors across
              Nigerian campuses.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="#catalog"
              className={`${pillBase} bg-ink text-white transition-colors duration-150 hover:bg-ink/85`}
            >
              Start shopping
            </a>
            <Link
              href="/sell"
              className={`${pillBase} border border-ink bg-white text-ink transition-colors duration-150 hover:bg-hover`}
            >
              Sell an item
              <Icon name="plus" className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Two stacked promo tiles — sage ("New today") and sand */}
      <div className="flex flex-col gap-3">
        <a
          href="#arrivals-heading"
          className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-sage p-3.5 transition-colors duration-150 hover:border-ink/25 hover:shadow-soft sm:p-4 motion-reduce:transition-none"
          data-testid="promo-new"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white">
            <Icon name="arrow" className="h-5 w-5 text-forest" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">New today</span>
            <span className="mt-0.5 block text-xs text-ink">
              See the latest listings from student vendors
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-forest">
              See new arrivals
              <Icon name="arrow" className="h-3 w-3" />
            </span>
          </span>
        </a>
        <a
          href="#catalog"
          className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-sand p-3.5 transition-colors duration-150 hover:border-ink/25 hover:shadow-soft sm:p-4 motion-reduce:transition-none"
          data-testid="promo-campus"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white">
            <Icon name="pin" className="h-5 w-5 text-brown" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">
              Browse by campus: find items near you
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-xs font-bold text-brown">
              Pick your campus in Filters
              <Icon name="arrow" className="h-3 w-3" />
            </span>
          </span>
        </a>
      </div>
    </section>
  )
}
