import { useEffect, useRef, useState, type FormEvent } from 'react'
import { friendlyAuthMessage, signOut, useAuth } from '../lib/auth'
import { Link } from '../lib/router'
import type { CategoryRef } from '../types'
import { CategoryDrawer } from './CategoryMenu'
import { Icon } from './icons'

/**
 * The quiet, warm storefront header (Etsy-inspired, token-only):
 * - cream bar with a 1px border underneath (no top strip, no dark areas)
 * - white pill search input with a 1px ink border; the Filters control sits
 *   INSIDE the pill; an orange circular search button closes its right end
 * - auth-aware Account menu, cart (header has NO sell button any more — the
 *   hero's "Sell an item" pill is the only prominent sell CTA)
 * - phones: compact bar (logo, search toggle, cart, hamburger) with
 *   the accordion-category drawer
 * - icon buttons are 36px circles; hover = sky background, navy icon
 * Location selects live ONLY in the Filters panel (FilterSheet).
 */

type Props = {
  search: string
  onSearchChange: (value: string) => void
  activeFilterCount: number
  onOpenFilters: () => void
  categories: CategoryRef[]
  categoryTop: string
  categorySub: string
  onCategoryTop: (categoryId: string) => void
  onCategorySub: (subCategoryId: string) => void
}

/* Shared quiet-icon-button: 36px round, soft sky hover with navy glyph */
const iconButton =
  'flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors duration-150 hover:bg-sky hover:text-navy motion-reduce:transition-none'

export default function Header({
  search,
  onSearchChange,
  activeFilterCount,
  onOpenFilters,
  categories,
  categoryTop,
  categorySub,
  onCategoryTop,
  onCategorySub,
}: Props) {
  const { user } = useAuth()
  const [cartOpen, setCartOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!accountOpen) return
    const onDocClick = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [accountOpen])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    /* The debounce in HomePage owns the query; submit just blurs out. */
    ;(event.currentTarget as HTMLFormElement).querySelector('input')?.blur()
  }

  const filtersButton = (
    <button
      type="button"
      onClick={onOpenFilters}
      aria-haspopup="dialog"
      data-testid="header-filters"
      className="flex h-11 shrink-0 items-center gap-1.5 px-3 text-xs font-bold text-ink transition-colors duration-150 hover:bg-hover motion-reduce:transition-none"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path
          d="M4 7h10M18 7h2M14 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM4 17h2M10 17h10M8 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="hidden lg:inline">Filters</span>
      {/* Active-filter badge lives ON the Filters label, never on Search */}
      {activeFilterCount > 0 && (
        <span
          className="flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-1 text-[9px] font-bold text-ink"
          aria-hidden="true"
        >
          {activeFilterCount}
        </span>
      )}
      <span className="sr-only">Filters ({activeFilterCount} active)</span>
    </button>
  )

  const searchForm = (compact: boolean) => (
    <form
      role="search"
      onSubmit={submitSearch}
      className={`flex w-full ${compact ? 'px-4 pb-2' : ''}`}
    >
      {/* 44px white pill, 1px ink border, overflow-hidden: the search button
          is a FLUSH end segment the bar's own rounded edge clips — orange
          follows the outer curve, no circle, no gap. Inset ring so keyboard
          focus stays visible despite the clipping. */}
      <div className="flex h-11 flex-1 items-center overflow-hidden rounded-full border border-ink bg-white pl-3">
        <input
          type="search"
          aria-label="Search items"
          placeholder="Search phones, books, desks…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-11 min-w-0 flex-1 rounded-none bg-transparent text-sm text-ink placeholder:text-taupe focus-visible:outline-none"
        />
        {filtersButton}
        <button
          type="submit"
          aria-label="Search"
          data-testid="header-search-submit"
          className="flex h-11 w-14 shrink-0 items-center justify-center bg-orange text-ink transition-colors duration-150 hover:bg-orange-deep hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink motion-reduce:transition-none"
        >
          <Icon name="search" className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>
    </form>
  )

  return (
    <header className="sticky top-0 z-40 bg-cream">
      <div className="border-b border-border bg-cream">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-4">
          <Link href="/" className="flex shrink-0 items-center gap-1.5" aria-label="Wemart home">
            <img
              src="/wemart-logo.png"
              alt=""
              width={512}
              height={512}
              className="h-8 w-8 rounded-full sm:h-9 sm:w-9"
              loading="eager"
            />
            <span className="text-lg font-bold tracking-tight text-ink">Wemart</span>
          </Link>

          {/* Desktop search pill */}
          <div className="hidden flex-1 lg:flex">{searchForm(false)}</div>

          {/* Account menu (auth-aware) — 36px round icon button */}
          <div ref={accountRef} className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              data-testid="header-account"
              className="flex h-9 items-center gap-1.5 rounded-full px-2 text-ink transition-colors duration-150 hover:bg-sky hover:text-navy"
            >
              <Icon name="user" className="h-5 w-5 shrink-0" />
              <span className="max-w-24 truncate text-sm font-semibold">
                {user ? (user.fullName ?? 'Account') : 'Account'}
              </span>
              <Icon name="chevron" className="h-3 w-3 shrink-0" />
            </button>
            {accountOpen && (
              <div
                role="menu"
                aria-label="Account"
                data-testid="account-menu"
                className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-white p-1.5 shadow-soft"
              >
                {user ? (
                  <>
                    <Link role="menuitem" href="/account" className="rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover" onClick={() => setAccountOpen(false)}>
                      My account
                    </Link>
                    {/* Quiet sell entry — plain menu text, never a button */}
                    <Link role="menuitem" href="/sell" className="rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover" onClick={() => setAccountOpen(false)}>
                      Sell an item
                    </Link>
                    <Link role="menuitem" href="/sell" className="rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover" onClick={() => setAccountOpen(false)}>
                      Vendor dashboard
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover"
                      onClick={() => {
                        setAccountOpen(false)
                        signOut().catch(() => {
                          window.alert(friendlyAuthMessage(new Error('Sign-out failed. Try again.')))
                        })
                      }}
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link role="menuitem" href="/auth/login" className="rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover" onClick={() => setAccountOpen(false)}>
                      Sign in
                    </Link>
                    <Link role="menuitem" href="/auth/register" className="rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover" onClick={() => setAccountOpen(false)}>
                      Create account
                    </Link>
                    <Link role="menuitem" href="/sell" className="rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:bg-hover" onClick={() => setAccountOpen(false)}>
                      Sell an item
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <Link href="#" onClick={(event) => event.preventDefault()} aria-label="Help" className={`${iconButton} hidden lg:flex`}>
            <Icon name="help" className="h-5 w-5" />
          </Link>

          {/* Cart — 36px round icon button */}
          <button
            type="button"
            onClick={() => setCartOpen((open) => !open)}
            aria-expanded={cartOpen}
            aria-controls="cart-panel"
            aria-label="Cart"
            className={`${iconButton} ml-auto lg:ml-0`}
          >
            <Icon name="cart" className="h-5 w-5" strokeWidth={1.9} />
          </button>

          {/* Mobile search toggle */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen((open) => !open)}
            aria-expanded={mobileSearchOpen}
            aria-label="Search"
            className={`${iconButton} lg:hidden`}
          >
            <Icon name="search" className="h-5 w-5" strokeWidth={2.2} />
          </button>

          {/* Hamburger */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="category-drawer"
            aria-label="Browse categories"
            data-testid="header-menu"
            className={`${iconButton} lg:hidden`}
          >
            <Icon name="menu" className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        {/* Mobile search pill */}
        {mobileSearchOpen && <div className="lg:hidden">{searchForm(true)}</div>}

        {cartOpen && (
          <div
            id="cart-panel"
            className="mx-auto max-w-6xl border-t border-border px-4 py-3"
          >
            <p className="text-sm font-bold text-ink">Your cart is empty.</p>
            <p className="text-xs text-taupe">
              No checkout yet — reach out to sellers and meet in person safely.
            </p>
          </div>
        )}
      </div>

      {/* Mobile category drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" data-testid="category-drawer">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Categories"
            className="absolute inset-y-0 left-0 flex w-full max-w-72 flex-col overflow-y-auto bg-white"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-bold text-ink">Browse</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className={iconButton}
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
            <CategoryDrawer
              topCategories={categories.filter((category) => category.parentCategoryId === null)}
              categories={categories}
              top={categoryTop}
              sub={categorySub}
              onTop={onCategoryTop}
              onSub={onCategorySub}
              onNavigate={() => setDrawerOpen(false)}
            />
            <div className="mt-auto flex flex-col divide-y divide-border border-t border-border text-sm font-semibold text-ink">
              {user ? (
                <>
                  <Link href="/account" className="px-4 py-3 transition-colors duration-150 hover:bg-hover">My account</Link>
                  <Link href="/sell" className="px-4 py-3 transition-colors duration-150 hover:bg-hover">Vendor dashboard</Link>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="px-4 py-3 transition-colors duration-150 hover:bg-hover">Sign in</Link>
                  <Link href="/auth/register" className="px-4 py-3 transition-colors duration-150 hover:bg-hover">Create account</Link>
                </>
              )}
              <Link href="#" onClick={(event) => event.preventDefault()} className="px-4 py-3 transition-colors duration-150 hover:bg-hover">Help</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
