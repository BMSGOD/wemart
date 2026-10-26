/* Mobile-only bottom navigation. Replaces the old hamburger menu. */
import { Link } from '../lib/router'

const ITEMS = [
  {
    label: 'Home',
    href: '/',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M4 10.5L12 4l8 6.5V20h-5.5v-5h-5v5H4z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Browse',
    href: '/',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect x="4" y="4" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="4" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="4" y="13" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
        <rect x="13" y="13" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    label: 'Sell',
    href: '/sell',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: 'Me',
    href: '/account',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <path
          d="M4.5 20c1.5-3.5 4.2-5 7.5-5s6 1.5 7.5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
]

export default function BottomNav({ path = '/' }: { path?: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white sm:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map((item) => {
          /* Home owns the '/' state; 'Browse' ('/') never steals it. */
          const active =
            path === '/'
              ? item.label === 'Home'
              : path === item.href && item.href !== '/'
          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 pt-2 pb-3 text-[10px] transition ${
                  active
                    ? 'font-bold text-orange-deep'
                    : 'font-medium text-ink/70 hover:text-orange-deep'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
