import { useState } from 'react'
import LocationSelects, { type LocationSelection } from './LocationSelects'
import { Link } from '../lib/router'
import type { CampusDirectoryEntry } from '../types'

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  /* v2 routes: auth + dashboards (wrangler SPA fallback keeps deep links alive). */
  { label: 'Sell an item', href: '/sell' },
  { label: 'My orders', href: '/orders' },
  { label: 'Help', href: '#' },
]

type Props = {
  directory: CampusDirectoryEntry[]
  location: LocationSelection
  onStateChange: (stateId: string) => void
  onCampusChange: (campusId: string) => void
}

export default function Header({
  directory,
  location,
  onStateChange,
  onCampusChange,
}: Props) {
  const [cartOpen, setCartOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4 sm:py-3">
        <Link href="/" className="flex shrink-0 items-center">
          <img
            src="/wemart-logo.png"
            alt="Wemart"
            width={512}
            height={512}
            className="h-8 w-8 rounded-lg sm:h-9 sm:w-9"
          />
        </Link>

        {/* Location selector (State + Campus) lives in the sticky header
            on every screen size */}
        <LocationSelects
          directory={directory}
          location={location}
          onStateChange={onStateChange}
          onCampusChange={onCampusChange}
          compact
        />

        {/* Desktop nav */}
        <nav className="ml-auto hidden items-center gap-5 sm:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-ink/70 transition hover:text-orange-deep"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Cart (ops note: no checkout — empty-state panel only) */}
        <button
          type="button"
          onClick={() => setCartOpen((open) => !open)}
          aria-expanded={cartOpen}
          aria-controls="cart-panel"
          aria-label="Cart"
          className="ml-auto shrink-0 rounded-lg p-2 text-ink transition hover:bg-gray-cart sm:ml-0"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <path
              d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="20" r="1.6" fill="currentColor" />
            <circle cx="18" cy="20" r="1.6" fill="currentColor" />
          </svg>
        </button>
      </div>

      {cartOpen && (
        <div
          id="cart-panel"
          className="mx-auto max-w-5xl border-t border-border bg-gray-cart px-4 py-3"
        >
          <p className="text-sm font-medium text-ink">Your cart is empty.</p>
          <p className="text-xs text-ink/70">
            No checkout yet — reach out to sellers and meet in person safely.
          </p>
        </div>
      )}
    </header>
  )
}
