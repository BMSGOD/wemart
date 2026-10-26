import { Icon } from './icons'

/**
 * Full site footer on Ink with orange column headings. Links that exist in
 * the app get real anchors; pages that do not exist yet render as plain
 * text (no fake destinations).
 */
export default function Footer() {
  const headingClass = 'text-xs font-bold uppercase tracking-wide text-orange'
  const linkClass = 'text-xs text-white/70 transition hover:text-white'
  const deadClass = 'text-xs text-white/40'

  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4">
        <section aria-label="About Wemart">
          <h2 className={headingClass}>About Wemart</h2>
          <p className="mt-2 text-xs text-white/60">
            The campus marketplace for Nigerian students — buy and sell with
            people on your campus.
          </p>
          <p className="mt-2 text-xs text-white/30">
            Browsing only; no checkout or payments yet.
          </p>
        </section>

        <section aria-label="Support">
          <h2 className={headingClass}>Support</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            <li className={deadClass}>Safety tips</li>
            <li className={deadClass}>Contact</li>
            <li>
              <a href="#" className={linkClass} onClick={(event) => event.preventDefault()}>
                Help
              </a>
            </li>
          </ul>
        </section>

        <section aria-label="Sell on Wemart">
          <h2 className={headingClass}>Sell on Wemart</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            <li>
              <a href="/sell" className={linkClass}>
                Vendor dashboard
              </a>
            </li>
            <li>
              <a href="/auth/register" className={linkClass}>
                Become a vendor
              </a>
            </li>
          </ul>
        </section>

        <section aria-label="Legal">
          <h2 className={headingClass}>Legal</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            <li className={deadClass}>Terms of use</li>
            <li className={deadClass}>Privacy policy</li>
          </ul>
        </section>
      </div>
      <div className="border-t border-white/10 py-3 text-center text-[11px] text-white/40">
        © 2026 Wemart · Aligned to meeting-safety rules. Vendors: meet in public places.
        <Icon name="pin" className="ml-1 inline h-3 w-3 align-text-bottom" />
      </div>
    </footer>
  )
}
