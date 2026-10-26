import { Icon } from './icons'

/**
 * Full site footer — flat sand panel, ink text, bold ink headings, thin
 * border lines. Links that exist in the app get real anchors; pages that do
 * not exist yet render as plain text (no fake destinations). No dark/black
 * background areas, no orange headings.
 */
export default function Footer() {
  const headingClass = 'text-xs font-bold uppercase tracking-wide text-ink'
  const linkClass =
    'text-xs text-ink/80 transition-colors duration-150 hover:text-ink underline-offset-2 hover:underline'
  const deadClass = 'text-xs text-taupe'

  return (
    <footer className="bg-sand text-ink">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4">
        <section aria-label="About Wemart">
          <h2 className={headingClass}>About Wemart</h2>
          <p className="mt-2 text-xs text-ink/80">
            The campus marketplace for Nigerian students — buy and sell with
            people on your campus.
          </p>
          <p className="mt-2 text-xs text-taupe">
            Browsing only; no checkout or payments yet.
          </p>
        </section>

        <section aria-label="Support" className="border-t border-brown/20 pt-4 sm:border-t-0 sm:pt-0">
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

        <section aria-label="Sell" className="border-t border-brown/20 pt-4 sm:border-t-0 sm:pt-0">
          <h2 className={headingClass}>Sell</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {/* Single quiet sell entry in the footer — plain text link */}
            <li>
              <a href="/sell" className={linkClass}>
                Sell on Wemart
              </a>
            </li>
          </ul>
        </section>

        <section aria-label="Legal" className="border-t border-brown/20 pt-4 sm:border-t-0 sm:pt-0">
          <h2 className={headingClass}>Legal</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            <li className={deadClass}>Terms of use</li>
            <li className={deadClass}>Privacy policy</li>
          </ul>
        </section>
      </div>
      <div className="border-t border-brown/20 py-3 text-center text-[11px] text-taupe">
        © 2026 Wemart · Meet sellers in public places and pay in person.
        <Icon name="pin" className="ml-1 inline h-3 w-3 align-text-bottom text-taupe" />
      </div>
    </footer>
  )
}
