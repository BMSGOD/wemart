import { useCallback, useEffect, useState } from 'react'
import { Link } from '../lib/router'
import { friendlyAuthMessage, useAuth } from '../lib/auth'
import {
  getVendorProfile,
  isPoliciesPending,
  listVendorProducts,
  saveVendorProfile,
  toVendorDataError,
  type VendorProductRow,
  type VendorProfile,
} from '../data/vendor'

/**
 * Vendor dashboard — store profile + product listing read-out.
 *
 * DATA GATE (binding): the vendors/products RLS policies live in
 * database/0008_vendor_buyer_rls_policies.sql and have NOT been approved
 * or run. Until then every query surfaces the "pending-policies" state —
 * implemented and tested, but inactive on the live DB by design.
 *
 * COLUMN FACTS (verified live schema 2026-10-27): the profile editor writes
 * ONLY business_name / display_name; product rows show listing_status.
 * Stock/quantity values come from the catalog view's composition and their
 * base-table columns are unconfirmed ⇒ inventory is READ-ONLY here (no
 * invented writes) pending owner-confirmed columns.
 */

type ProfileState =
  | { phase: 'loading' }
  | { phase: 'signed-out' }
  | { phase: 'not-vendor' }
  | { phase: 'pending-policies' }
  | { phase: 'no-row' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; profile: VendorProfile | null }

const PENDING_COPY = (
  <div className="rounded-lg border border-border bg-surface p-4" data-testid="pending-policies">
    <h2 className="text-sm font-bold text-ink">Database policies pending approval</h2>
    <p className="mt-1 text-sm text-ink/70">
      Your login works, but vendors/products row access opens only after the
      RLS policies in <code className="text-xs">database/0008_vendor_buyer_rls_policies.sql</code> are
      reviewed and run by the owner. Nothing is broken — this dashboard
      activates as soon as they are approved.
    </p>
  </div>
)

export default function VendorDashboardPage() {
  const { user, ready } = useAuth()
  const [profile, setProfile] = useState<ProfileState>({ phase: 'loading' })

  useEffect(() => {
    if (!ready) return
    if (!user) {
      setProfile({ phase: 'signed-out' })
      return
    }
    if (user.role !== 'vendor') {
      setProfile({ phase: 'not-vendor' })
      return
    }
    let active = true
    setProfile({ phase: 'loading' })
    getVendorProfile()
      .then((row) => {
        if (active) setProfile({ phase: 'ready', profile: row })
      })
      .catch((err) => {
        if (!active) return
        const mapped = toVendorDataError(err)
        setProfile(
          isPoliciesPending(mapped)
            ? { phase: 'pending-policies' }
            : mapped.kind === 'no-profile'
              ? { phase: 'no-row' }
              : { phase: 'error', message: friendlyAuthMessage(mapped) },
        )
      })
    return () => {
      active = false
    }
  }, [ready, user])

  const heading = (
    <header>
      <p className="text-xs font-bold uppercase tracking-wide text-orange-deep">Vendor dashboard</p>
      <h1 className="text-xl font-bold text-ink">My store</h1>
    </header>
  )

  if (!ready) return <main className="px-4 py-8">{heading}<p className="mt-4 text-sm text-ink/60">Checking your session…</p></main>

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {heading}

      {profile.phase === 'loading' && <p className="mt-4 text-sm text-ink/60">Loading your store…</p>}

      {profile.phase === 'signed-out' && (
        <section className="mt-4 rounded-lg border border-border bg-white p-4">
          <h2 className="text-sm font-bold text-ink">Sign in to open your store</h2>
          <p className="mt-1 text-sm text-ink/70">A vendor account is needed for the dashboard.</p>
          <div className="mt-3 flex gap-2">
            <Link href="/auth/login" className="rounded-lg bg-orange px-4 py-2 text-sm font-bold text-ink hard-shadow hover:bg-orange-deep hover:text-white">Sign in</Link>
            <Link href="/auth/register" className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-bold text-ink hover:border-ink">Create vendor account</Link>
          </div>
        </section>
      )}

      {profile.phase === 'not-vendor' && (
        <section className="mt-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-bold text-ink">This is a vendor area</h2>
          <p className="mt-1 text-sm text-ink/70">
            You are signed in as a buyer. Selling on Wemart uses a separate
            vendor account.
          </p>
        </section>
      )}

      {profile.phase === 'pending-policies' && <section className="mt-4">{PENDING_COPY}</section>}

      {profile.phase === 'no-row' && (
        <section className="mt-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-bold text-ink">No store linked yet</h2>
          <p className="mt-1 text-sm text-ink/70">
            New vendor sign-ups get a linked store row automatically (once 0008
            runs). Accounts created before that are linked by the owner —
            nothing was lost, it just is not connected yet.
          </p>
        </section>
      )}

      {profile.phase === 'error' && (
        <section className="mt-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-bold text-ink">Could not load your store</h2>
          <p className="mt-1 text-sm text-ink/70">{profile.message}</p>
        </section>
      )}

      {profile.phase === 'ready' && user && <StoreProfileEditor profile={profile.profile} authUid={user.id} />}
    </main>
  )
}

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function StoreProfileEditor({ profile, authUid }: { profile: VendorProfile | null; authUid: string }) {
  const [businessName, setBusinessName] = useState(() => stringify(profile?.business_name))
  const [displayName, setDisplayName] = useState(() => stringify(profile?.display_name))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const onSave = useCallback(() => {
    setBusy(true)
    setMessage(null)
    saveVendorProfile(
      {
        business_name: businessName.trim(),
        display_name: displayName.trim() || undefined,
      },
      authUid,
    )
      .then(() => setMessage({ ok: true, text: 'Saved to your own store row.' }))
      .catch((err) => {
        const mapped = toVendorDataError(err)
        setMessage(
          isPoliciesPending(mapped)
            ? { ok: false, text: 'Policies pending approval — the save could not reach the database yet.' }
            : { ok: false, text: friendlyAuthMessage(mapped) },
        )
      })
      .finally(() => setBusy(false))
  }, [businessName, displayName, authUid])

  return (
    <div className="mt-4 flex flex-col gap-5">
      <section className="rounded-lg border border-border bg-white p-4">
        <h2 className="text-sm font-bold text-ink">Store profile</h2>
        <p className="mt-1 text-xs text-ink/60">
          {profile
            ? `Status: ${stringify(profile.account_status) || '—'}. Only your own row is editable.`
            : 'Linked vendor row not loaded yet. Signing up after 0008 runs creates it automatically.'}
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <label className="text-xs font-bold text-ink" htmlFor="vendor-business-name">
            Business name
          </label>
          <input
            id="vendor-business-name"
            data-testid="vendor-business-name"
            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink focus-visible:outline-[3px]"
            placeholder="e.g. Ada Gadgets Nigeria"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
          />
          <label className="text-xs font-bold text-ink" htmlFor="vendor-display-name">
            Display name (optional)
          </label>
          <input
            id="vendor-display-name"
            data-testid="vendor-display-name"
            className="w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink focus-visible:outline-[3px]"
            placeholder="Shown on your listings"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="self-start rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-ink hard-shadow transition hover:bg-orange-deep hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          >
            {busy ? 'Saving…' : 'Save profile'}
          </button>
          {message && <p className={`text-sm ${message.ok ? 'text-green' : 'text-orange-deep'}`}>{message.text}</p>}
        </div>
      </section>

      <InventorySection />
    </div>
  )
}

function InventorySection() {
  const [rows, setRows] = useState<VendorProductRow[] | null>(null)
  const [state, setState] = useState<{ kind: 'loading' | 'pending' | 'error' | 'ready'; message?: string }>({ kind: 'loading' })

  const load = useCallback(() => {
    setState({ kind: 'loading' })
    listVendorProducts()
      .then((list) => {
        setRows(list)
        setState({ kind: 'ready' })
      })
      .catch((err) => {
        const mapped = toVendorDataError(err)
        setState(
          isPoliciesPending(mapped)
            ? { kind: 'pending' }
            : { kind: 'error', message: friendlyAuthMessage(mapped) },
        )
      })
  }, [])

  useEffect(load, [load])

  return (
    <section className="rounded-lg border border-border bg-white p-4" data-testid="inventory-section">
      <h2 className="text-sm font-bold text-ink">Products &amp; inventory</h2>

      {state.kind === 'loading' && <p className="mt-2 text-sm text-ink/60">Loading products…</p>}

      {state.kind === 'pending' && (
        <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink/70" data-testid="inventory-pending">
          Your products appear here after the 0008 RLS policies are approved and run.
        </p>
      )}

      {state.kind === 'error' && <p className="mt-2 text-sm text-orange-deep">{state.message}</p>}

      {state.kind === 'ready' && rows && <InventoryList rows={rows} />}
    </section>
  )
}

function InventoryList({ rows }: { rows: VendorProductRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="mt-2 text-sm text-ink/60" data-testid="inventory-empty">
        No products linked to your store yet. Product creation arrives with the
        next review round once the ownership policies are live.
      </p>
    )
  }

  return (
    <ul className="mt-2 flex flex-col divide-y divide-border" data-testid="inventory-list">
      {rows.map((row) => (
        <li key={String(row.id ?? '')} className="py-2">
          <p className="text-sm font-bold text-ink">
            Product #{String(row.id ?? '').slice(0, 8)}
          </p>
          <p className="text-xs text-ink/60">
            Listing status:{' '}
            <span className={stringify(row.listing_status) === 'draft' ? 'text-ink/50' : 'text-green'}>
              {stringify(row.listing_status) || 'unknown'}
            </span>
          </p>
        </li>
      ))}
    </ul>
  )
}
