import { useCallback, useEffect, useState } from 'react'
import { Link } from '../lib/router'
import { friendlyAuthMessage, useAuth } from '../lib/auth'
import { getCampusDirectory, getCategories } from '../data/api'
import type { CampusDirectoryEntry, CategoryRef } from '../types'
import {
  addVendorLocation,
  createListingDraft,
  createProductVariant,
  getVendorProfile,
  isPoliciesPending,
  listVendorProducts,
  listVendorLocations,
  listVariantsForProducts,
  removeVendorLocation,
  saveVendorProfile,
  setProductListingStatus,
  toVendorDataError,
  updateListingDetails,
  updateVariantPrice,
  type ProductCondition,
  type ProductListingStatus,
  type VariantRow,
  type VendorLocationRow,
  type VendorProductRow,
  type VendorProfile,
} from '../data/vendor'

/**
 * Vendor dashboard — store profile + product listing read-out.
 *
 * DATA GATE (EXECUTED 2026-10-27): the 0008 RLS policies are now live on
 * the database, so the "pending-policies" branch below is a legacy fallback
 * (kept for honest 42501 handling — e.g. if the owner revokes a grant).
 * Every gate still surfaces real database errors instead of crashing.
 *
 * COLUMN FACTS (0011 live paste 2026-10-27): products carry id, vendor_id,
 * category_id, name (NOT NULL), description, brand, product_condition
 * (new/used/refurbished/other), listing_status (draft/active/paused/
 * sold_out/removed). Price lives ONLY on product_variants (NOT NULL,
 * >= 0, NGN). Stock/quantity and image storage are still UNKNOWN (no
 * columns on either table) — inventory counts and uploads stay out of
 * this UI pending 0015's image/inventory/storage-facts dump.
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
            New vendor sign-ups get a linked store row automatically at
            signup. Accounts created before that ran are linked by the
            owner — nothing was lost, it just is not connected yet.
          </p>
        </section>
      )}

      {profile.phase === 'error' && (
        <section className="mt-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-bold text-ink">Could not load your store</h2>
          <p className="mt-1 text-sm text-ink/70">{profile.message}</p>
        </section>
      )}

      {profile.phase === 'ready' && user && (
        <StoreProfileEditor
          profile={profile.profile}
          authUid={user.id}
          emailConfirmed={user.emailConfirmed}
        />
      )}
    </main>
  )
}

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/* Pending/approved store states: 'pending' is the CONFIRMED default; other
 * live values are unverified, so only the known state gets special copy. */
function PendingStoreBanner({ status }: { status: string | undefined }) {
  if (status !== 'pending') return null
  return (
    <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-ink/70" data-testid="store-pending-note">
      Your account status reads “{status}”. At launch this does not block
      anything — confirm your email and your listings can go live. Only a
      suspended or closed account is restricted from publishing.
    </p>
  )
}

function StoreProfileEditor({ profile, authUid, emailConfirmed }: { profile: VendorProfile | null; authUid: string; emailConfirmed: boolean }) {
  const [businessName, setBusinessName] = useState(() => stringify(profile?.business_name))
  const [displayName, setDisplayName] = useState(() => stringify(profile?.display_name))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const accountStatus = stringify(profile?.account_status)
  /* 0013 launch rule: publishing needs ONLY a confirmed email; suspended/
   * closed accounts are blocked; 'pending' does NOT block (no manual
   * approval at launch). The frontend hint below is cosmetic — the server
   * re-checks eligibility on every 'active' write (42501 when ineligible). */
  const blockedByAccount = accountStatus === 'suspended' || accountStatus === 'closed'
  const canPublish = emailConfirmed && !blockedByAccount
  const publishNote = !emailConfirmed
    ? 'Confirm your email (the link in your inbox) to publish listings.'
    : blockedByAccount
      ? `This account cannot publish (status: ${accountStatus}).`
      : null

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
        <PendingStoreBanner status={profile ? stringify(profile.account_status) : undefined} />
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

      <InventorySection vendorId={stringify(profile?.id)} canPublish={canPublish} publishNote={publishNote} />

      <LocationSection vendorId={stringify(profile?.id)} />
    </div>
  )
}

/* Vendor's permitted store locations — vendor_locations rows resolved
 * against the campus_directory view (the same source the public location
 * pickers use). Campuses are locations rows, so campus_location_id holds a
 * locations id; unknown ids degrade to a plain label, never invented. */
function LocationSection({ vendorId }: { vendorId: string }) {
  const [rows, setRows] = useState<VendorLocationRow[] | null>(null)
  const [state, setState] = useState<{ kind: 'loading' | 'pending' | 'error' | 'ready'; message?: string }>({ kind: 'loading' })
  const [directory, setDirectory] = useState<CampusDirectoryEntry[] | null>(null)
  const [chosen, setChosen] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setState({ kind: 'loading' })
    listVendorLocations(vendorId)
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
  }, [vendorId])

  useEffect(load, [load])
  if (directory === null) {
    getCampusDirectory()
      .then(setDirectory)
      .catch(() => setDirectory([]))
  }

  const campusName = (campusId: string | null | undefined): string => {
    if (!campusId) return '—'
    return directory?.find((entry) => entry.id === campusId)?.name ?? `Campus ${String(campusId).slice(0, 8)}`
  }

  return (
    <section className="rounded-lg border border-border bg-white p-4" data-testid="locations-section">
      <h2 className="text-sm font-bold text-ink">Store locations</h2>
      <p className="mt-1 text-xs text-ink/60">Campuses buyers see as your pickup point.</p>

      {state.kind === 'loading' && <p className="mt-2 text-sm text-ink/60">Loading locations…</p>}
      {state.kind === 'pending' && (
        <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink/70">
          Location editing opens after the 0008 RLS policies are approved and run.
        </p>
      )}
      {state.kind === 'error' && <p className="mt-2 text-sm text-orange-deep">{state.message}</p>}

      {state.kind === 'ready' && rows && (
        <>
          {rows.length > 0 ? (
            <ul className="mt-2 flex flex-col divide-y divide-border">
              {rows.map((row) => (
                <li key={String(row.id ?? '')} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate text-sm text-ink">{campusName(row.campus_location_id)}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:border-ink"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true)
                      setError(null)
                      removeVendorLocation(String(row.id))
                        .then(load)
                        .catch((err) => setError(toVendorDataError(err).message))
                        .finally(() => setBusy(false))
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink/60">No campus added yet.</p>
          )}

          {vendorId && directory && directory.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              <select
                aria-label="Add a campus"
                data-testid="add-campus-select"
                value={chosen}
                onChange={(event) => setChosen(event.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink"
              >
                <option value="">Add a campus…</option>
                {directory.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} — {entry.stateName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !chosen}
                className="self-start rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-ink hover:border-ink disabled:opacity-50"
                onClick={() => {
                  setBusy(true)
                  setError(null)
                  addVendorLocation(vendorId, chosen)
                    .then(() => {
                      setChosen('')
                      load()
                    })
                    .catch((err) => {
                      const mapped = toVendorDataError(err)
                      setError(
                        isPoliciesPending(mapped)
                          ? 'Policies pending approval.'
                          : friendlyAuthMessage(mapped),
                      )
                    })
                    .finally(() => setBusy(false))
                }}
              >
                {busy ? 'Adding…' : 'Add campus'}
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-orange-deep">{error}</p>}
        </>
      )}
    </section>
  )
}

function InventorySection({
  vendorId,
  canPublish,
  publishNote,
}: {
  vendorId: string
  canPublish: boolean
  publishNote: string | null
}) {
  const [rows, setRows] = useState<VendorProductRow[] | null>(null)
  const [variants, setVariants] = useState<Record<string, VariantRow[]>>({})
  const [categories, setCategories] = useState<CategoryRef[] | null>(null)
  const [state, setState] = useState<{ kind: 'loading' | 'pending' | 'error' | 'ready'; message?: string }>({ kind: 'loading' })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(() => {
    setState({ kind: 'loading' })
    listVendorProducts(vendorId)
      .then(async (list) => {
        setRows(list)
        const ids = list.map((row) => String(row.id ?? '')).filter(Boolean)
        const grouped: Record<string, VariantRow[]> = {}
        if (ids.length > 0) {
          try {
            for (const variant of await listVariantsForProducts(ids)) {
              const pid = String(variant.product_id ?? '')
              grouped[pid] = [...(grouped[pid] ?? []), variant]
            }
          } catch {
            /* variant read failure → prices show as unavailable; never crash */
          }
        }
        setVariants(grouped)
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
  }, [vendorId])

  useEffect(load, [load])

  /* Categories come from the same small public query the storefront chips
   * use — read-only, always safe. Failure degrades to "No category". */
  useEffect(() => {
    let active = true
    getCategories()
      .then((list) => {
        if (active) setCategories(list)
      })
      .catch(() => {
        if (active) setCategories([])
      })
    return () => {
      active = false
    }
  }, [])

  const setStatus = useCallback(
    (productId: string, status: ProductListingStatus) => {
      setBusyId(productId)
      setMessage(null)
      setProductListingStatus(vendorId, productId, status)
        .then(() =>
          setMessage({
            ok: true,
            text:
              status === 'active'
                ? 'Published — the listing is now public.'
                : 'Status saved.',
          }),
        )
        .then(load)
        .catch((err) => {
          const mapped = toVendorDataError(err)
          setMessage(
            isPoliciesPending(mapped)
              ? { ok: false, text: 'The database blocked this write — confirm your email, or the account cannot publish.' }
              : { ok: false, text: friendlyAuthMessage(mapped) },
          )
        })
        .finally(() => setBusyId(null))
    },
    [vendorId, load],
  )

  const saveDetails = useCallback(
    (
      productId: string,
      patch: { name?: string; description?: string; brand?: string; categoryId?: string; condition?: ProductCondition },
    ): Promise<void> => {
      setBusyId(productId)
      setMessage(null)
      return updateListingDetails(vendorId, productId, patch)
        .then(() => {
          setMessage({ ok: true, text: 'Listing details saved.' })
        })
        .catch((err) => {
          const mapped = toVendorDataError(err)
          setMessage(
            isPoliciesPending(mapped)
              ? { ok: false, text: 'The database blocked this write.' }
              : { ok: false, text: friendlyAuthMessage(mapped) },
          )
        })
        .then(load, () => load())
        .finally(() => setBusyId(null))
    },
    [vendorId, load],
  )

  const saveVariantPrice = useCallback(
    (productId: string, variantId: string, price: number): Promise<void> => {
      setBusyId(variantId)
      setMessage(null)
      return updateVariantPrice(productId, variantId, price)
        .then(() => {
          setMessage({ ok: true, text: 'Price saved (wrong? re-enter it).' })
        })
        .catch((err) => {
          const mapped = toVendorDataError(err)
          setMessage(
            isPoliciesPending(mapped)
              ? { ok: false, text: 'The database blocked this write.' }
              : { ok: false, text: friendlyAuthMessage(mapped) },
          )
        })
        .then(load, () => load())
        .finally(() => setBusyId(null))
    },
    [load],
  )

  return (
    <section className="rounded-lg border border-border bg-white p-4" data-testid="inventory-section">
      <h2 className="text-sm font-bold text-ink">Products &amp; inventory</h2>

      {state.kind === 'loading' && <p className="mt-2 text-sm text-ink/60">Loading products…</p>}

      {state.kind === 'pending' && (
        <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-ink/70" data-testid="inventory-pending">
          Product access could not be confirmed with the database. Ask the
          owner to verify the account policies (0008/0012/0013) if this keeps
          appearing.
        </p>
      )}

      {state.kind === 'error' && <p className="mt-2 text-sm text-orange-deep">{state.message}</p>}

      {state.kind === 'ready' && rows && (
        <InventoryList
          vendorId={vendorId}
          rows={rows}
          variants={variants}
          categories={categories}
          canPublish={canPublish}
          publishNote={publishNote}
          busyId={busyId}
          onSetStatus={setStatus}
          onSaveDetails={saveDetails}
          onSaveVariantPrice={saveVariantPrice}
          onNotify={setMessage}
          onReload={load}
        />
      )}

      {message && (
        <p className={`mt-2 text-sm ${message.ok ? 'text-green' : 'text-orange-deep'}`} data-testid="inventory-message">
          {message.text}
        </p>
      )}
    </section>
  )
}

const STATUS_LABELS: Record<ProductListingStatus, string> = {
  draft: 'Draft (only you can see it)',
  active: 'Published',
  paused: 'Paused',
  sold_out: 'Sold out',
  removed: 'Removed',
}

const CONDITION_OPTIONS: { value: ProductCondition; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Used' },
  { value: 'refurbished', label: 'Refurbished' },
  { value: 'other', label: 'Other' },
]

const formInputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink focus-visible:outline-[3px]'
const formLabelClass = 'text-xs font-bold text-ink'
const formSelectClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink'

/** Naira display — price is naira AS-IS, never kobo-divided. */
function formatNaira(value: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value)
}

function parsePriceInput(raw: string): { value: number | null; error: string | null } {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: null, error: null }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: null, error: 'Enter a price of 0 naira or more.' }
  }
  return { value: parsed, error: null }
}

function InventoryList({
  vendorId,
  rows,
  variants,
  categories,
  canPublish,
  publishNote,
  busyId,
  onSetStatus,
  onSaveDetails,
  onSaveVariantPrice,
  onNotify,
  onReload,
}: {
  vendorId: string
  rows: VendorProductRow[]
  variants: Record<string, VariantRow[]>
  categories: CategoryRef[] | null
  canPublish: boolean
  publishNote: string | null
  busyId: string | null
  onSetStatus: (productId: string, status: ProductListingStatus) => void
  onSaveDetails: (
    productId: string,
    patch: { name?: string; description?: string; brand?: string; categoryId?: string; condition?: ProductCondition },
  ) => Promise<void>
  onSaveVariantPrice: (productId: string, variantId: string, price: number) => Promise<void>
  onNotify: (message: { ok: boolean; text: string }) => void
  onReload: () => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <>
      {publishNote && (
        <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-ink/70" data-testid="publish-blocked-note">
          {publishNote}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink/60" data-testid="inventory-empty">
          No products on your store yet — create the first one below.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-border" data-testid="inventory-list">
          {rows.map((row) => {
            const rowId = String(row.id ?? '')
            const current = (stringify(row.listing_status) || 'draft') as ProductListingStatus
            const known = Object.prototype.hasOwnProperty.call(STATUS_LABELS, current)
            const name = stringify(row.name) || `Product #${rowId.slice(0, 8)}`
            const condition = stringify(row.product_condition)
            const ownsVariants = variants[rowId] ?? []
            const priced = ownsVariants
              .filter((v) => typeof v.price === 'number')
              .map((v) => v.price as number)
            const priceLabel = priced.length
              ? `from ${formatNaira(Math.min(...priced))}`
              : 'No price variant yet'
            return (
              <li key={rowId} className="py-3" data-testid={`inventory-row-${rowId}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">{name}</p>
                    <p className="text-xs text-ink/60">
                      {condition && <span className="font-bold capitalize">{condition} · </span>}
                      {priceLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <select
                      aria-label={`Listing status for ${name}`}
                      data-testid={`inventory-status-select-${rowId}`}
                      value={current}
                      disabled={busyId === rowId || !known}
                      onChange={(event) => {
                        const next = event.target.value as ProductListingStatus
                        if (next !== current) onSetStatus(rowId, next)
                      }}
                      className="w-40 rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-ink"
                    >
                      {/* Confirmed vocabulary only; 'active' additionally requires
                          publishing eligibility (frontend hint + server gate). */}
                      {(Object.keys(STATUS_LABELS) as ProductListingStatus[]).map((s) => (
                        <option
                          key={s}
                          value={s}
                          disabled={s === 'active' && !canPublish}
                          title={s === 'active' && !canPublish ? publishNote ?? 'Publishing not available' : undefined}
                        >
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      data-testid={`edit-listing-${rowId}`}
                      onClick={() => setEditingId(editingId === rowId ? null : rowId)}
                      disabled={busyId === rowId}
                      className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:border-ink disabled:opacity-50"
                    >
                      {editingId === rowId ? 'Close editor' : 'Edit'}
                    </button>
                  </div>
                </div>

                {editingId === rowId && (
                  <ListingEditor
                    row={row}
                    productVariants={ownsVariants}
                    categories={categories}
                    saving={busyId === rowId}
                    onSaveDetails={(patch) => onSaveDetails(rowId, patch)}
                    onSaveVariantPrice={(variantId, raw) => {
                      const { value, error } = parsePriceInput(raw)
                      if (error) {
                        onNotify({ ok: false, text: error })
                        return
                      }
                      if (value === null) {
                        onNotify({ ok: false, text: 'Enter a price first.' })
                        return
                      }
                      void onSaveVariantPrice(rowId, variantId, value)
                    }}
                    onDone={() => setEditingId(null)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* New listing form — product + first priced variant. Two SEPARATE
          requests by design (PostgREST is not transactional): a failed
          price save leaves an honest price-less draft the vendor completes
          on the row — never a half-faked product. */}
      <div className="mt-4">
        <button
          type="button"
          data-testid="new-listing-toggle"
          onClick={() => setCreating(!creating)}
          className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-ink hover:border-ink"
        >
          {creating ? 'Close new-listing form' : '＋ New listing'}
        </button>
        {creating && (
          <NewListingForm
            vendorId={vendorId}
            categories={categories}
            canPublish={canPublish}
            publishNote={publishNote}
            onDone={() => setCreating(false)}
            onReload={onReload}
            onNotify={onNotify}
          />
        )}
      </div>
    </>
  )
}

function categoryOptions(categories: CategoryRef[] | null) {
  const list = categories ?? []
  return (
    <>
      <option value="">No category</option>
      {list.map((category) => (
        <option key={category.id} value={category.id}>
          {category.parentCategoryId ? `— ${category.name}` : category.name}
        </option>
      ))}
    </>
  )
}

function ListingEditor({
  row,
  productVariants,
  categories,
  saving,
  onSaveDetails,
  onSaveVariantPrice,
  onDone,
}: {
  row: VendorProductRow
  productVariants: VariantRow[]
  categories: CategoryRef[] | null
  saving: boolean
  onSaveDetails: (patch: {
    name?: string
    description?: string
    brand?: string
    categoryId?: string
    condition?: ProductCondition
  }) => void
  onSaveVariantPrice: (variantId: string, rawPrice: string) => void
  onDone: () => void
}) {
  const [name, setName] = useState(() => stringify(row.name))
  const [description, setDescription] = useState(() => stringify(row.description))
  const [brand, setBrand] = useState(() => stringify(row.brand))
  const [categoryId, setCategoryId] = useState(() => stringify(row.category_id))
  const [condition, setCondition] = useState<ProductCondition>(
    () => (stringify(row.product_condition) || 'new') as ProductCondition,
  )
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})

  return (
    <div className="mt-2 rounded-lg bg-surface p-3" data-testid="listing-editor">
      <div className="flex flex-col gap-2.5">
        <label className={formLabelClass} htmlFor="edit-name">
          Name
        </label>
        <input id="edit-name" className={formInputClass} value={name} onChange={(e) => setName(e.target.value)} />
        <label className={formLabelClass} htmlFor="edit-description">
          Description
        </label>
        <textarea
          id="edit-description"
          className={`${formInputClass} min-h-16`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={formLabelClass}>Category</span>
            <select
              className={formSelectClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categoryOptions(categories)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={formLabelClass}>Condition</span>
            <select
              className={formSelectClass}
              value={condition}
              onChange={(e) => setCondition(e.target.value as ProductCondition)}
            >
              {CONDITION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={formLabelClass} htmlFor="edit-brand">
          Brand (optional)
        </label>
        <input id="edit-brand" className={formInputClass} value={brand} onChange={(e) => setBrand(e.target.value)} />
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-orange px-3.5 py-2 text-xs font-bold text-ink hard-shadow transition hover:bg-orange-deep hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
            disabled={saving}
            onClick={() =>
              onSaveDetails({
                name,
                description,
                brand,
                categoryId: categoryId || undefined,
                condition,
              })
            }
          >
            {saving ? 'Saving…' : 'Save details'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-bold text-ink hover:border-ink"
            onClick={onDone}
          >
            Done
          </button>
        </div>

        <p className="mt-1 text-xs font-bold text-ink">Variants &amp; prices (naira)</p>
        {productVariants.length === 0 ? (
          <p className="text-xs text-ink/60">
            No priced variant yet — a listing needs at least one price before it
            is worth publishing.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {productVariants.map((variant) => {
              const variantId = String(variant.id ?? '')
              if (!variantId) return null
              const draft = priceDrafts[variantId]
              const shown = draft ?? (typeof variant.price === 'number' ? String(variant.price) : '')
              return (
                <li key={variantId} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-ink/70">
                    {stringify(variant.variant_name) || 'Default variant'}
                    {variant.is_active === false ? ' — inactive' : ''}
                  </span>
                  <input
                    inputMode="decimal"
                    aria-label={`Price in naira for ${stringify(variant.variant_name) || 'variant'}`}
                    data-testid={`variant-price-${variantId}`}
                    className="w-28 rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-ink"
                    value={shown}
                    onChange={(e) =>
                      setPriceDrafts((prev) => ({ ...prev, [variantId]: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs font-bold text-ink hover:border-ink disabled:opacity-50"
                    disabled={saving}
                    onClick={() => onSaveVariantPrice(variantId, shown)}
                  >
                    Save price
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function NewListingForm({
  vendorId,
  categories,
  canPublish,
  publishNote,
  onDone,
  onReload,
  onNotify,
}: {
  vendorId: string
  categories: CategoryRef[] | null
  canPublish: boolean
  publishNote: string | null
  onDone: () => void
  onReload: () => void
  onNotify: (message: { ok: boolean; text: string }) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [condition, setCondition] = useState<ProductCondition>('new')
  const [brand, setBrand] = useState('')
  const [priceInput, setPriceInput] = useState('')
  const [variantName, setVariantName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async () => {
    setBusy(true)
    try {
      if (!name.trim()) throw new Error('Give the listing a name first.')
      const { value: price, error: priceError } = parsePriceInput(priceInput)
      if (priceError) throw new Error(priceError)
      const { id } = await createListingDraft(vendorId, {
        name,
        categoryId: categoryId || undefined,
        condition,
        brand,
        description,
      })
      if (!id) {
        onReload()
        onNotify({
          ok: true,
          text: 'Listing created, but its id could not be read back — set the price on its row.',
        })
        onDone()
        return
      }
      if (price === null) {
        onReload()
        onNotify({
          ok: true,
          text: 'Draft created — set a price on its row so buyers can buy it.',
        })
        onDone()
        return
      }
      try {
        await createProductVariant(id, price, variantName)
      } catch (variantError) {
        onReload()
        onNotify({
          ok: false,
          text: `Listing created, but the price was not saved (${friendlyAuthMessage(variantError)}). Set it on the row.`,
        })
        onDone()
        return
      }
      onReload()
      onNotify({
        ok: true,
        text: canPublish
          ? 'Listing created as a draft — publish it from its status menu when ready.'
          : 'Listing created as a draft. Publishing opens once your email is confirmed.',
      })
      onDone()
    } catch (err) {
      onNotify({ ok: false, text: friendlyAuthMessage(err) })
    } finally {
      setBusy(false)
    }
  }, [name, priceInput, categoryId, condition, brand, description, vendorId, variantName, canPublish, onDone, onReload, onNotify])

  return (
    <form
      className="mt-2 flex flex-col gap-2.5 rounded-lg bg-surface p-3"
      data-testid="new-listing-form"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <label className={formLabelClass} htmlFor="new-name">
        Name
      </label>
      <input
        id="new-name"
        data-testid="new-listing-name"
        className={formInputClass}
        placeholder="e.g. Physics textbook, 12th ed."
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label className={formLabelClass} htmlFor="new-description">
        Description (optional)
      </label>
      <textarea
        id="new-description"
        className={`${formInputClass} min-h-16`}
        placeholder="Condition details, what is included…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={formLabelClass}>Category</span>
          <select
            data-testid="new-listing-category"
            className={formSelectClass}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {/* categories failed to load → single "No category" option */}
            {categoryOptions(categories)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={formLabelClass}>Condition</span>
          <select
            data-testid="new-listing-condition"
            className={formSelectClass}
            value={condition}
            onChange={(e) => setCondition(e.target.value as ProductCondition)}
          >
            {CONDITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={formLabelClass} htmlFor="new-brand">
        Brand (optional)
      </label>
      <input
        id="new-brand"
        className={formInputClass}
        placeholder="e.g. Hisense"
        value={brand}
        onChange={(e) => setBrand(e.target.value)}
      />
      <label className={formLabelClass} htmlFor="new-price">
        Price in naira (stored on the first variant)
      </label>
      <input
        id="new-price"
        data-testid="new-listing-price"
        inputMode="decimal"
        className={formInputClass}
        placeholder="e.g. 15000"
        value={priceInput}
        onChange={(e) => setPriceInput(e.target.value)}
      />
      <label className={formLabelClass} htmlFor="new-variant-name">
        Variant label (optional)
      </label>
      <input
        id="new-variant-name"
        className={formInputClass}
        placeholder="Default"
        value={variantName}
        onChange={(e) => setVariantName(e.target.value)}
      />
      <button
        type="submit"
        data-testid="new-listing-submit"
        disabled={busy}
        className="self-start rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-ink hard-shadow transition hover:bg-orange-deep hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50"
      >
        {busy ? 'Creating…' : 'Create draft listing'}
      </button>
      <p className="text-xs text-ink/60">
        Saved as a draft first; publish from the status menu when ready.
        {canPublish
          ? ''
          : ` ${publishNote ?? 'Publishing needs a confirmed email.'}`}
        {' '}Stock counts and photos follow the pending image/inventory table
        review (0015).
      </p>
    </form>
  )
}
