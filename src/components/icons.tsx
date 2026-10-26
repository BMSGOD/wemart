/**
 * Wemart Icon — tiny hand-written stroke-icon set (no dependencies).
 * Shapes are simple paths on a 24×24 viewBox, stroked with currentColor,
 * so every icon inherits text colour. Category names map to icons by
 * keyword; unknown categories get the neutral "box" icon.
 */

export type IconName =
  | 'search'
  | 'menu'
  | 'close'
  | 'pin'
  | 'cart'
  | 'user'
  | 'help'
  | 'sell'
  | 'chevron'
  | 'arrow'
  | 'plus'
  | 'phone'
  | 'book'
  | 'sofa'
  | 'shirt'
  | 'laptop'
  | 'beauty'
  | 'food'
  | 'toy'
  | 'bike'
  | 'box'

const PATHS: Record<IconName, React.ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" strokeLinecap="round" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />,
  close: <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />,
  pin: (
    <>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  cart: (
    <>
      <path d="M3.6 4.6h2.2l2.3 10.8a1.9 1.9 0 0 0 1.9 1.5h7.4a1.9 1.9 0 0 0 1.9-1.5L20.6 8H6.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17.6" cy="20" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.8" />
      <path d="M5 20c1.5-3.3 4-4.9 7-4.9s5.5 1.6 7 4.9" strokeLinecap="round" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.9c-.7.4-1 .8-1 1.7" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  sell: (
    <>
      <path d="M4 11.5 11.5 4h6a1.5 1.5 0 0 1 1.5 1.5v6L11.5 19 4 11.5Z" strokeLinejoin="round" />
      <circle cx="15" cy="9" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  chevron: <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />,
  arrow: <path d="M5 12h13m-5-5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
  phone: (
    <>
      <rect x="7.5" y="3.5" width="9" height="17" rx="2" />
      <path d="M11 18h2" strokeLinecap="round" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5h9.5A3.5 3.5 0 0 1 18 8v11.5H8.5A3.5 3.5 0 0 1 5 16V4.5Z" strokeLinejoin="round" />
      <path d="M18 15.5H8.5A3.5 3.5 0 0 0 5 19h13Z" strokeLinejoin="round" />
    </>
  ),
  sofa: (
    <>
      <path d="M5.5 11V8.5A2.5 2.5 0 0 1 8 6h8a2.5 2.5 0 0 1 2.5 2.5V11" strokeLinecap="round" />
      <path d="M4 13.5A2 2 0 0 1 6 11.5h12a2 2 0 0 1 2 2V17a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3.5Z" strokeLinejoin="round" />
      <path d="M6 18v1.5M18 18v1.5" strokeLinecap="round" />
    </>
  ),
  shirt: (
    <path d="M9 4 7.5 4.8C5 5.8 4 7.4 4 9.5V12l3 .8V19h10v-6.2l3-.8V9.5c0-2.1-1-3.7-3.5-4.7L15 4a3 3 0 0 1-6 0Z" strokeLinejoin="round" />
  ),
  laptop: (
    <>
      <rect x="5" y="5" width="14" height="9.5" rx="1.5" />
      <path d="M3 18.2c.5-1.1 1.2-1.7 2-1.7h14c.8 0 1.5.6 2 1.7.2.6-.2 1.3-1 1.3H4c-.8 0-1.2-.7-1-1.3Z" strokeLinejoin="round" />
    </>
  ),
  beauty: (
    <>
      <rect x="6" y="9" width="12" height="11" rx="2" />
      <path d="M9.5 9V6.2c0-1.3 1.1-2.2 2.5-2.2s2.5 1 2.5 2.2V9" strokeLinecap="round" />
      <path d="M10 11.5v4M14 11.5v4" strokeLinecap="round" />
    </>
  ),
  food: (
    <>
      <path d="M7 3.5v7M10 3.5v7M8.5 10.5v10" strokeLinecap="round" />
      <path d="M16 3.5c-1.7 0-3 2.2-3 5s1.3 5 3 5v7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  toy: (
    <>
      <circle cx="12" cy="13" r="5.5" />
      <path d="M12 7.5c0-2.5 1-4.5 3-4.5s3 2 3 4.5c-1.8-.6-4.2-.6-6 0Z" strokeLinejoin="round" />
      <circle cx="10" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <path d="M10 15.2c1.3.9 2.7.9 4 0" strokeLinecap="round" />
    </>
  ),
  bike: (
    <>
      <circle cx="6.5" cy="16.5" r="3" />
      <circle cx="17.5" cy="16.5" r="3" />
      <path d="M6.5 16.5 10 9h4.5M10 9 6.5 16.5M14.5 9l3 7.5M14.5 9l2.5-2.5h-3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  box: (
    <>
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" strokeLinejoin="round" />
      <path d="M4 8.5 12 13l8-4.5M12 13v7" strokeLinejoin="round" />
    </>
  ),
}

export function Icon({
  name,
  className = 'h-4 w-4',
  strokeWidth = 1.8,
}: {
  name: IconName
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

/* Keyword map: a category name → its icon (checked top down). */
const KEYWORDS: Array<[RegExp, IconName]> = [
  [/phone|gadget|electronic|computer|camera/i, 'laptop'],
  [/laptop/i, 'laptop'],
  [/book|text|station|media/i, 'book'],
  [/furni|home|kitchen|decor/i, 'sofa'],
  [/fashion|cloth|shoe|footwear|wear|accessor/i, 'shirt'],
  [/beauty|health|cosmetic|hair/i, 'beauty'],
  [/food|grocer/i, 'food'],
  [/toy|kid|baby|game/i, 'toy'],
  [/sport|bike|fitness/i, 'bike'],
]

export function categoryIcon(categoryName: string): IconName {
  for (const [pattern, icon] of KEYWORDS) {
    if (pattern.test(categoryName)) return icon
  }
  return 'box'
}
