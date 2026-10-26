import { useEffect, useState, type FormEvent } from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import {
  friendlyAuthMessage,
  requestPasswordReset,
  resendVerification,
  setNewPassword,
  signIn,
  signOut,
  signUp,
  useAuth,
  verifyEmailToken,
  type AccountRole,
} from '../lib/auth'
import { Link, useRouter } from '../lib/router'

/**
 * All unauthenticated pages: register (buyer/vendor), sign-in, forgot
 * password, verify-email landing, and reset-password landing. Deliberately
 * plain — the auth forms are utility surfaces, not storefront chrome.
 */

const inputClass =
  'w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 focus-visible:outline-[3px]'
const primaryButtonClass =
  'w-full rounded-lg bg-orange px-4 py-2.5 text-sm font-bold text-ink hard-shadow transition hover:bg-orange-deep hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
const errorBoxClass =
  'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-orange-deep'

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-xl font-bold text-ink">{title}</h1>
        {children}
        <div className="mt-4 text-center text-xs">
          <Link href="/" className="text-ink/60 underline underline-offset-2 hover:text-orange-deep">
            ← Back to browsing
          </Link>
        </div>
      </div>
    </main>
  )
}

/* --------------------------------------------------------------- */
/* Register                                                          */
/* --------------------------------------------------------------- */

export function RegisterPage() {
  const [role, setRole] = useState<AccountRole>('buyer')
  const [fullName, setFullName] = useState('')
  const [shopName, setShopName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  if (!isSupabaseConfigured) {
    return (
      <AuthShell title="Create an account">
        <p className="text-sm text-ink/70">Wemart sign-in is being set up.</p>
      </AuthShell>
    )
  }

  if (sent) {
    return (
      <AuthShell title="Check your inbox">
        <p className="text-sm text-ink/70">
          We sent a confirmation link to <strong>{email}</strong>. Open it to
          activate your {role} account — the link lands on the /verify page.
        </p>
      </AuthShell>
    )
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!fullName.trim()) return setError('Enter your full name.')
    if (role === 'vendor' && !shopName.trim()) return setError('Enter your shop name.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    setBusy(true)
    signUp({ email, password, role, fullName: fullName.trim(), shopName: shopName.trim() })
      .then(() => setSent(true))
      .catch((err) => setError(friendlyAuthMessage(err)))
      .finally(() => setBusy(false))
  }

  return (
    <AuthShell title="Create an account">
      <div className="mb-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Account type">
        {(['buyer', 'vendor'] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={role === r}
            onClick={() => setRole(r)}
            className={`rounded-lg border px-3 py-2 text-sm font-bold capitalize transition ${
              role === r
                ? 'border-ink bg-orange text-ink hard-shadow'
                : 'border-border bg-white text-ink/70 hover:border-ink'
            }`}
          >
            {r === 'buyer' ? 'Buyer' : 'Vendor — I sell'}
          </button>
        ))}
      </div>

      {role === 'vendor' && (
        <p className="mb-3 text-xs text-ink/60">
          Your store is created automatically when you confirm your email
          (linked to this login — nobody else can claim it). You can rename
          it later in your vendor dashboard.
        </p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className={inputClass} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
        {role === 'vendor' && (
          <input className={inputClass} placeholder="Business name" value={shopName} onChange={(e) => setShopName(e.target.value)} required />
        )}
        <input className={inputClass} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <input className={inputClass} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required />
        {error && <p className={errorBoxClass}>{error}</p>}
        <button className={primaryButtonClass} disabled={busy} type="submit">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-ink/60">
        Already have an account? <Link href="/auth/login" className="font-bold text-orange-deep underline underline-offset-2">Sign in</Link>
      </p>
      {role === 'vendor' && (
        <p className="mt-2 text-center text-xs text-ink/60">
          Vendor already? <Link href="/sell" className="font-bold text-orange-deep underline underline-offset-2">Go to selling</Link>
        </p>
      )}
    </AuthShell>
  )
}

/* --------------------------------------------------------------- */
/* Sign in                                                           */
/* --------------------------------------------------------------- */

export function LoginPage() {
  const { navigate } = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isSupabaseConfigured) {
    return (
      <AuthShell title="Sign in">
        <p className="text-sm text-ink/70">Wemart sign-in is being set up.</p>
      </AuthShell>
    )
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    signIn(email, password)
      .then((user) => navigate(user.role === 'vendor' ? '/sell' : '/account'))
      .catch((err) => setError(friendlyAuthMessage(err)))
      .finally(() => setBusy(false))
  }

  return (
    <AuthShell title="Sign in">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className={inputClass} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <input className={inputClass} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <p className={errorBoxClass}>{error}</p>}
        <button className={primaryButtonClass} disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-3 flex justify-between text-xs text-ink/60">
        <Link href="/auth/forgot" className="underline underline-offset-2 hover:text-orange-deep">Forgot password?</Link>
        <Link href="/auth/register" className="font-bold text-orange-deep underline underline-offset-2">Create account</Link>
      </p>
    </AuthShell>
  )
}

/* --------------------------------------------------------------- */
/* Forgot password                                                   */
/* --------------------------------------------------------------- */

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isSupabaseConfigured) {
    return <AuthShell title="Reset password"><p className="text-sm text-ink/70">Wemart sign-in is being set up.</p></AuthShell>
  }

  if (sent) {
    return (
      <AuthShell title="Check your inbox">
        <p className="text-sm text-ink/70">If an account exists for <strong>{email}</strong>, a password-reset link is on its way. It opens /reset-password.</p>
      </AuthShell>
    )
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    requestPasswordReset(email)
      .then(() => setSent(true))
      .catch((err) => setError(friendlyAuthMessage(err)))
      .finally(() => setBusy(false))
  }

  return (
    <AuthShell title="Reset password">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className={inputClass} type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {error && <p className={errorBoxClass}>{error}</p>}
        <button className={primaryButtonClass} disabled={busy} type="submit">
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  )
}

/* --------------------------------------------------------------- */
/* Reset password landing (after the recovery email link)            */
/* --------------------------------------------------------------- */

export function ResetPasswordPage() {
  const { user, ready } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!isSupabaseConfigured) {
    return <AuthShell title="New password"><p className="text-sm text-ink/70">Wemart sign-in is being set up.</p></AuthShell>
  }

  if (done) {
    return (
      <AuthShell title="Password updated">
        <p className="text-sm text-ink/70">Your password has been changed.</p>
        <Link href="/" className="mt-3 inline-block text-sm font-bold text-orange-deep underline underline-offset-2">Back to Wemart</Link>
      </AuthShell>
    )
  }

  if (!ready) {
    return <AuthShell title="New password"><p className="text-sm text-ink/70">Loading your session…</p></AuthShell>
  }

  // A recovery link lands here WITH a session; without one, ask for a fresh link.
  if (!user) {
    return (
      <AuthShell title="New password">
        <p className="text-sm text-ink/70">This page needs a password-reset link from your email. Request a fresh one:</p>
        <Link href="/auth/forgot" className="mt-3 inline-block text-sm font-bold text-orange-deep underline underline-offset-2">Request a reset link</Link>
      </AuthShell>
    )
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirm) return setError('The two passwords do not match.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    setBusy(true)
    setNewPassword(password)
      .then(() => setDone(true))
      .catch((err) => setError(friendlyAuthMessage(err)))
      .finally(() => setBusy(false))
  }

  return (
    <AuthShell title="Set a new password">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className={inputClass} type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required />
        <input className={inputClass} type="password" placeholder="Repeat new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={6} required />
        {error && <p className={errorBoxClass}>{error}</p>}
        <button className={primaryButtonClass} disabled={busy} type="submit">
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthShell>
  )
}

/* --------------------------------------------------------------- */
/* Verify email landing — consumes the signup email link token       */
/* --------------------------------------------------------------- */

export function VerifyEmailPage() {
  const [status, setStatus] = useState<'working' | 'ok' | 'error'>('working')
  const [detail, setDetail] = useState('Confirming your email…')
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const typeParam = params.get('type')
    const code = params.get('code')
    const supabase = getSupabase()
    // The recovery flow verifies through /reset-password's session instead.
    if (typeParam === 'recovery') {
      setRecoveryMode(true)
      setStatus('ok')
      setDetail('Recovery link confirmed — set your new password below.')
      return
    }
    const doVerify = (promise: Promise<unknown>, okMessage: string) => {
      promise
        .then(() => {
          setStatus('ok')
          setDetail(okMessage)
        })
        .catch((err) => {
          setStatus('error')
          setDetail(String((err as Error)?.message ?? err))
        })
    }
    if (code && supabase) {
      doVerify(
        supabase.auth.exchangeCodeForSession(window.location.href),
        'Email confirmed — you are signed in.',
      )
    } else if (tokenHash && supabase && (typeParam === 'signup' || typeParam === 'email' || !typeParam)) {
      doVerify(
        verifyEmailToken(tokenHash, typeParam === 'signup' ? 'signup' : 'email'),
        'Email confirmed — you are signed in.',
      )
    } else {
      setStatus('error')
      setDetail('This verification link is missing its token. Please request a new confirmation email.')
    }
  }, [])

  return (
    <AuthShell title="Email verification">
      <p className={`text-sm ${status === 'error' ? 'text-orange-deep' : 'text-ink/70'}`}>{detail}</p>
      {status === 'ok' && !recoveryMode && (
        <Link href="/" className="mt-3 inline-block text-sm font-bold text-orange-deep underline underline-offset-2">
          Start browsing Wemart
        </Link>
      )}
      {status === 'ok' && recoveryMode && (
        <Link href="/reset-password" className="mt-3 inline-block text-sm font-bold text-orange-deep underline underline-offset-2">
          Set your new password
        </Link>
      )}
    </AuthShell>
  )
}

/* --------------------------------------------------------------- */
/* Shared account actions (used by dashboards) — kept here so the    */
/* sign-out + resend flows live with the auth surfaces.               */
/* --------------------------------------------------------------- */

export function useAccountActions() {
  return {
    signOut: () => signOut(),
    resend: (email: string) => resendVerification(email),
  }
}
