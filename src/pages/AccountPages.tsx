import { useEffect, useState } from 'react'
import { Link } from '../lib/router'
import { friendlyAuthMessage, signOut, useAuth } from '../lib/auth'
import {
  getBuyerProfile,
  isPoliciesPending,
  saveBuyerProfile,
  toVendorDataError,
} from '../data/vendor'

/**
 * Buyer account dashboard — identity-only for now: the linked `buyers`
 * profile row is live via the 0008 policies (executed 2026-10-27) and
 * order history stays outside the buyer surface (orders are intentionally
 * locked by 0006 until real checkout exists — never render fake flows).
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

          <BuyerProfilePanel authUid={user.id} />

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

/** Buyer profile editor — verified columns ONLY (display_name,
 *  whatsapp_number), scoped to the caller's own row via RLS + explicit
 *  auth_user_id filter. The "pending" branch is a legacy fallback for
 *  honest 42501 handling now that 0008 is live. */
function BuyerProfilePanel({ authUid }: { authUid: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'pending' | 'error'>('loading')
  const [displayName, setDisplayName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let active = true
    getBuyerProfile()
      .then((row) => {
        if (!active) return
        setDisplayName(typeof row?.display_name === 'string' ? row.display_name : '')
        setWhatsapp(typeof row?.whatsapp_number === 'string' ? row.whatsapp_number : '')
        setState('ready')
      })
      .catch((err) => {
        if (!active) return
        setState(isPoliciesPending(toVendorDataError(err)) ? 'pending' : 'error')
      })
    return () => {
      active = false
    }
  }, [])

  const inputClass =
    'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink focus-visible:outline-[3px]'

  return (
    <section className="rounded-lg border border-border bg-white p-4" data-testid="buyer-profile-panel">
      <h2 className="text-sm font-bold text-ink">Buyer profile</h2>
      {state === 'loading' && <p className="mt-2 text-sm text-ink/60">Loading…</p>}
      {state === 'pending' && (
        <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink/70">
          Buyer profile editing could not reach the database yet. If this
          keeps appearing, ask the owner to verify the account policies.
        </p>
      )}
      {state === 'error' && (
        <p className="mt-2 text-sm text-orange-deep">Your buyer profile could not be loaded.</p>
      )}
      {state === 'ready' && (
        <div className="mt-3 flex flex-col gap-3">
          <label className="text-xs font-bold text-ink" htmlFor="buyer-display-name">Display name</label>
          <input id="buyer-display-name" className={inputClass} placeholder="Shown on your account"
            value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <label className="text-xs font-bold text-ink" htmlFor="buyer-whatsapp">WhatsApp number</label>
          <input id="buyer-whatsapp" className={inputClass} placeholder="+234…"
            value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <button
            type="button"
            data-testid="buyer-profile-save"
            disabled={busy}
            className="self-start rounded-lg bg-orange px-4 py-2 text-sm font-bold text-ink hard-shadow transition hover:bg-orange-deep hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            onClick={() => {
              setBusy(true)
              setMessage(null)
              saveBuyerProfile(
                {
                  display_name: displayName.trim() || undefined,
                  whatsapp_number: whatsapp.trim() || undefined,
                },
                authUid,
              )
                .then(() => setMessage({ ok: true, text: 'Saved to your own profile.' }))
                .catch((err) => {
                  const mapped = toVendorDataError(err)
                  setMessage(
                    isPoliciesPending(mapped)
                      ? { ok: false, text: 'Policies pending approval — the save could not reach the database yet.' }
                      : { ok: false, text: friendlyAuthMessage(mapped) },
                  )
                })
                .finally(() => setBusy(false))
            }}
          >
            {busy ? 'Saving…' : 'Save profile'}
          </button>
          {message && <p className={`text-sm ${message.ok ? 'text-green' : 'text-orange-deep'}`}>{message.text}</p>}
        </div>
      )}
    </section>
  )
}
