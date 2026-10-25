/**
 * The Wemart 7-point starburst (matches the logo's badge shape).
 * Pure inline SVG polygon — no image files. Color via `currentColor`,
 * so the parent sets `text-orange` / `text-green` / `text-orange-tint`.
 */
import type { ReactNode } from 'react'

const STARBURST_POINTS =
  '50.0,2.0 61.3,26.6 87.5,20.1 75.3,44.2 96.8,60.7 70.3,66.2 70.8,93.2 50.0,76.0 29.2,93.2 29.7,66.2 3.2,60.7 24.7,44.2 12.5,20.1 38.7,26.6'

type Props = {
  /** Pixel size (square) */
  size?: number
  /** Classes for the wrapper (e.g. `absolute ... text-orange`) */
  className?: string
  /** Content drawn centred on the star (SVG or text) */
  children?: ReactNode
  /** Screen-reader-only text when the star carries meaning alone */
  title?: string
}

export default function Starburst({ size = 64, className = '', children, title }: Props) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full fill-current"
      >
        <polygon points={STARBURST_POINTS} />
      </svg>
      {children != null && (
        <span className="relative grid place-items-center leading-none">{children}</span>
      )}
      {title && <span className="sr-only">{title}</span>}
    </span>
  )
}
