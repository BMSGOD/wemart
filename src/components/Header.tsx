import { useState } from 'react'

const NAV_LINKS = [
  { label: 'Home', href: '#' },
  /* Placeholder links for upcoming pages; pointing nowhere harmful yet. */
  { label: 'Sell an item', href: '#' },
  { label: 'My orders', href: '#' },
  { label: 'Help', href: '#' },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <a href="#" className="text-lg font-extrabold tracking-tight">
          We<span className="text-emerald-600">mart</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-5 sm:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition hover:text-emerald-600"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 sm:hidden"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <nav
          id="mobile-menu"
          aria-label="Main"
          className="border-t border-slate-100 bg-white px-4 pb-3 sm:hidden"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block py-2.5 text-sm font-medium text-slate-700 transition hover:text-emerald-600"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}
