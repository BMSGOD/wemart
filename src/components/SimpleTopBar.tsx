import { Link } from '../lib/router'

/**
 * Plain top bar for auth + dashboard pages — a narrow version of the sticky
 * header (logo + home link). Product discovery keeps its full Header; these
 * utility pages keep the chrome light for phones.
 */
export default function SimpleTopBar({ title }: { title: string }) {
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Wemart home">
          <img
            src="/wemart-logo.png"
            alt="Wemart"
            width={512}
            height={512}
            className="h-8 w-8 rounded-lg"
          />
        </Link>
        <p className="text-sm font-bold text-ink">{title}</p>
        <Link
          href="/"
          className="ml-auto text-xs font-medium text-ink/60 underline underline-offset-2 hover:text-orange-deep"
        >
          Back to browsing
        </Link>
      </div>
    </header>
  )
}
