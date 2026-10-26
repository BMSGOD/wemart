import { Link } from '../lib/router'
import { friendlyAuthMessage, signOut, useAuth } from '../lib/auth'

/**
 * Buyer account dashboard — identity-only for now: the linked `buyers`
 * profile row and order history both wait on the 0008 policies (buyers)
 * and stay outside the buyer surface (orders are intentionally locked by
 * 0006 until real checkout exists — never render fake order flows).
 */

export default function AccountPage() {
  const { user, ready } = useAuth()

  if (!ready) {
    return <main className="mx-auto max-w-3xl px-4 py-6"><p className="text-sm text-ink/60">Checking your session…</p></main>
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <p className="text-xs font-bold uppercase tracking-wide text-orange-deep">Account</p>
      <h1 className="text-xl font-bold text-ink">Me</h1>

      {!user ? (
        <section className="mt-4 rounded-lg border border-border bg-white p-4">
          <h2 className="text-sm font-bold text-ink">You are not signed in</h2>
          <div className="mt-3 flex gap-2">
            <Link href="/auth/login" className="rounded-lg bg-orange px-4 py-2 text-sm font-bold text-ink hard-shadow hover:bg-orange-deep hover:text-white">Sign in</Link>
            <Link href="/auth/register" className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-bold text-ink hover:border-ink">Create account</Link>
          </div>
        </section>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <section className="rounded-lg border border-border bg-white p-4" data-testid="account-card">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-bold text-ink">Email</dt>
              <dd className="truncate text-ink/80">{user.email}</dd>
              <dt className="font-bold text-ink">Account type</dt>
              <dd className="capitalize text-ink/80">{user.role ?? 'unlabelled'}</dd>
              <dt className="font-bold text-ink">Name</dt>
              <dd className="text-ink/80">{user.fullName ?? '—'}</dd>
              <dt className="font-bold text-ink">Email verified</dt>
              <dd className={user.emailConfirmed ? 'text-green' : 'text-orange-deep'}>
                {user.emailConfirmed ? 'Yes' : 'No — check your inbox'}
              </dd>
            </dl>
            <button
              type="button"
              data-testid="account-sign-out"
              onClick={() => signOut().catch((err) => window.alert(friendlyAuthMessage(err)))}
              className="mt-4 rounded-lg border border-border bg-white px-4 py-2 text-sm font-bold text-ink hover:border-ink"
            >
              Sign out
            </button>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-bold text-ink">Orders</h2>
            <p className="mt-1 text-sm text-ink/70">
              Order history appears once Wemart launches real checkout. Your
              browsing stays anonymous-safe in the meantime.
            </p>
          </section>
        </div>
      )}
    </main>
  )
}

/** Mobile nav "Orders" — honest placeholder, no fabricated order rows. */
export function OrdersPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <p className="text-xs font-bold uppercase tracking-wide text-orange-deep">Orders</p>
      <h1 className="text-xl font-bold text-ink">Nothing here yet</h1>
      <p className="mt-2 max-w-md text-sm text-ink/70">
        Wemart does not store your orders until checkout is built. Everything
        you see while browsing stays local to your phone.
      </p>
      <Link href="/" className="mt-4 inline-block rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-ink hard-shadow hover:bg-orange-deep hover:text-white">
        Keep browsing
      </Link>
    </main>
  )
}
