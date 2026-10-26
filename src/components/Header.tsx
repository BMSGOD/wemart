import { useEffect, useRef, useState, type FormEvent } from 'react'
import { friendlyAuthMessage, signOut, useAuth } from '../lib/auth'
import { Link } from '../lib/router'
import type { CategoryRef } from '../types'
import { CategoryDrawer } from './CategoryMenu'
import { Icon } from './icons'

/**
 * The storefront header (v2, Jiji-style):
 * - thin Ink top strip: "Sell on Wemart" left, Help right
 * - main white bar: logo + wordmark, wide search bar with a Filters button
 *   INSIDE its right edge + prominent orange Search button, then Account
 *   menu (auth-aware), Help, Cart, and an always-visible orange SELL button
 * - phones: compact bar (logo, search toggle, SELL, cart, hamburger) with a
 *   drawer holding the accordion category menu and account links
 *
 * Location selects are GONE from the header — they live only in the
 * Filters panel now (FilterSheet). The cart is still the empty-state panel.
 *
 * Props come from HomePage: search state, the filters entry, and the
 * category selection handlers (same filter logic as before).
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

const inputBase =
  'h-10 w-full rounded-lg bg-surface pr-11 pl-3 text-sm text-ink placeholder:text-ink/40 border border-border focus-visible:outline-[3px] focus-visible:outline-ink focus-visible:outline-offset-0'

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
    /* The debounce in HomePage owns the query; submit just refocuses out. */
    ;(event.currentTarget as HTMLFormElement).querySelector('input')?.blur()
  }

  const filtersButton = (
    <button
      type="button"
      onClick={onOpenFilters}
      aria-expanded="false"
      aria-haspopup="dialog"
      data-testid="header-filters"
      className="relative flex h-10 items-center gap-1.5 rounded-r-lg bg-white px-3 text-xs font-bold text-ink transition hover:bg-orange-tint"
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
      {activeFilterCount > 0 && (
        <span
          className="absolute -top-1.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange px-0.5 text-[9px] font-bold text-ink"
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
      className={`flex w-full items-stretch ${compact ? 'px-4 pb-2' : ''}`}
    >
      <div className="flex flex-1 items-stretch rounded-lg border border-border bg-white pr-0 transition focus-within:border-ink">
        <input
          type="search"
          aria-label="Search items"
          placeholder="Search phones, books, desks…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className={compact ? 'rounded-l-lg border-0 ' + inputBase : inputBase}
        />
        {/* Filters lives INSIDE the search bar's right edge */}
        {filtersButton}
        <button
          type="submit"
          aria-label="Search"
          data-testid="header-search-submit"
          className="flex h-10 items-center gap-1.5 rounded-lg bg-orange px-3.5 text-sm font-bold text-ink hard-shadow transition hover:bg-orange-deep hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0 lg:rounded-l-none"
        >
          <Icon name="search" className="h-4 w-4" strokeWidth={2.4} />
          {!compact && <span className="pl-0.5 pr-1">Search</span>}
        </button>
      </div>
    </form>
  )

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      {/* Thin top strip */}
      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-1.5 text-[11px] font-medium sm:px-4">
          <Link href="/sell" className="flex items-center gap-1 font-bold text-orange hover:text-white">
            <Icon name="sell" className="h-3 w-3" />
            Sell on Wemart
          </Link>
          <Link href="#" onClick={(event) => event.preventDefault()} className="flex items-center gap-1 text-white/80 hover:text-white">
            <Icon name="help" className="h-3 w-3" />
            Help
          </Link>
        </div>
      </div>

      {/* Main bar */}
      <div className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
          <Link href="/" className="flex shrink-0 items-center gap-1.5" aria-label="Wemart home">
            <img
              src="/wemart-logo.png"
              alt=""
              width={512}
              height={512}
              className="h-8 w-8 rounded-lg sm:h-9 sm:w-9"
              loading="eager"
            />
            <span className="text-lg font-bold tracking-tight text-ink">Wemart</span>
          </Link>

          {/* Desktop search */}
          <div className="hidden flex-1 lg:flex">{searchForm(false)}</div>

          {/* Always-visible SELL (compact on phones) */}
          <Link
            href="/sell"
            data-testid="header-sell"
            className="ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-orange px-3 text-sm font-bold text-ink hard-shadow transition hover:bg-orange-deep hover:text-white active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:active:translate-x-0 motion-reduce:active:translate-y-0 sm:px-4 lg:ml-0"
          >
            <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
            <span>SELL</span>
          </Link>

          {/* Account menu (auth-aware) */}
          <div ref={accountRef} className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              data-testid="header-account"
              className="flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold text-ink transition hover:bg-orange-tint"
            >
              <Icon name="user" className="h-5 w-5" />
              <span className="max-w-24 truncate">
                {user ? (user.fullName ?? 'Account') : 'Account'}
              </span>
              <Icon name="chevron" className="h-3 w-3" />
            </button>
            {accountOpen && (
              <div
                role="menu"
                aria-label="Account"
                data-testid="account-menu"
                className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-white p-1.5 hard-shadow"
              >
                {user ? (
                  <>
                    <Link role="menuitem" href="/account" className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-orange-tint hover:text-orange-deep" onClick={() => setAccountOpen(false)}>
                      My account
                    </Link>
                    <Link role="menuitem" href="/sell" className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-orange-tint hover:text-orange-deep" onClick={() => setAccountOpen(false)}>
                      Vendor dashboard
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-ink hover:bg-orange-tint hover:text-orange-deep"
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
                    <Link role="menuitem" href="/auth/login" className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-orange-tint hover:text-orange-deep" onClick={() => setAccountOpen(false)}>
                      Sign in
                    </Link>
                    <Link role="menuitem" href="/auth/register" className="rounded-md px-3 py-2 text-sm font-medium text-ink hover:bg-orange-tint hover:text-orange-deep" onClick={() => setAccountOpen(false)}>
                      Create account
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <Link href="#" onClick={(event) => event.preventDefault()} aria-label="Help" className="hidden h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold text-ink transition hover:bg-orange-tint lg:flex">
            <Icon name="help" className="h-5 w-5" />
            Help
          </Link>

          {/* Cart */}
          <button
            type="button"
            onClick={() => setCartOpen((open) => !open)}
            aria-expanded={cartOpen}
            aria-controls="cart-panel"
            aria-label="Cart"
            className="relative flex h-10 shrink-0 items-center rounded-lg p-2 text-ink transition hover:bg-gray-cart"
          >
            <Icon name="cart" className="h-6 w-6" strokeWidth={1.9} />
          </button>

          {/* Mobile search toggle */}
          <button
            type="button"
            onClick={() => setMobileSearchOpen((open) => !open)}
            aria-expanded={mobileSearchOpen}
            aria-label="Search"
            className="flex h-10 items-center rounded-lg p-2 text-ink transition hover:bg-orange-tint lg:hidden"
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
            className="flex h-10 items-center rounded-lg p-2 text-ink transition hover:bg-orange-tint lg:hidden"
          >
            <Icon name="menu" className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        {/* Mobile search row */}
        {mobileSearchOpen && <div className="lg:hidden">{searchForm(true)}</div>}

        {cartOpen && (
          <div
            id="cart-panel"
            className="mx-auto max-w-6xl border-t border-border bg-gray-cart px-4 py-3"
          >
            <p className="text-sm font-bold text-ink">Your cart is empty.</p>
            <p className="text-xs text-ink/70">
              No checkout yet — reach out to sellers and meet in person safely.
            </p>
          </div>
        )}
      </div>

      {/* Mobile category drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" data-testid="category-drawer">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
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
                className="rounded-lg p-2 text-ink hover:bg-orange-tint"
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
            <div className="mt-auto flex flex-col divide-y divide-border border-t border-border text-sm font-bold text-ink">
              {user ? (
                <>
                  <Link href="/account" className="px-4 py-3">My account</Link>
                  <Link href="/sell" className="px-4 py-3">Vendor dashboard</Link>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="px-4 py-3">Sign in</Link>
                  <Link href="/auth/register" className="px-4 py-3">Create account</Link>
                </>
              )}
              <Link href="#" onClick={(event) => event.preventDefault()} className="px-4 py-3">Help</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
