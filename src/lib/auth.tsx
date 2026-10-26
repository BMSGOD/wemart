import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getSupabase } from './supabase'

/**
 * Supabase Auth façade — the ONLY place auth calls are made from UI code.
 *
 * Roles: 'vendor' | 'buyer' ride in `user_metadata` (auth-only metadata —
 * the user can read it, only service-side can normally mutate it). The
 * linked `vendors` / `buyers` profile rows are created by the (proposed)
 * database/0008 trigger once the owner approves it — never from the browser.
 *
 * Zero schema/policy dependency: everything here talks to the auth service,
 * which works today. Dashboard data access (vendors/products/buyers) stays
 * in src/data/vendor.ts behind the pending-RLS guard.
 */

export type AccountRole = 'vendor' | 'buyer'

export type SessionUser = {
  id: string
  email: string
  role: AccountRole | null
  fullName: string | null
  emailConfirmed: boolean
}

export class AuthError extends Error {
  readonly status: string
  readonly cause?: unknown
  constructor(message: string, status = 'other', cause?: unknown) {
    super(message)
    this.name = 'AuthError'
    this.status = status
    this.cause = cause
  }
}

const REDIRECT_VERIFY = `${window.location.origin}/verify`
const REDIRECT_RESET = `${window.location.origin}/reset-password`

function unconfigured(): never {
  throw new AuthError('Wemart sign-in is not configured yet.', 'unconfigured')
}

function roleOf(metadata: unknown): AccountRole | null {
  const role =
    metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>)['role']
      : undefined
  return role === 'vendor' || role === 'buyer' ? role : null
}

function userFrom(
  session: { user?: { id: string; email?: string; user_metadata?: unknown; email_confirmed_at?: string | null } | null } | null,
): SessionUser | null {
  const user = session?.user
  if (!user) return null
  const meta = user.user_metadata
  return {
    id: user.id,
    email: user.email ?? '',
    role: roleOf(meta),
    fullName:
      meta && typeof meta === 'object'
        ? ((meta as Record<string, unknown>)['full_name'] as string | undefined) ??
          null
        : null,
    emailConfirmed: Boolean(user.email_confirmed_at),
  }
}

type AuthApi = {
  user: SessionUser | null
  /** False until the first getSession/onAuthStateChange round-trips finish. */
  ready: boolean
}

const AuthContext = createContext<AuthApi>({ user: null, ready: false })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const client = getSupabase()
    if (!client) {
      setReady(true)
      return
    }
    let active = true
    void client.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(userFrom(data.session))
      setReady(true)
    })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUser(userFrom(session))
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({ user, ready }), [user, ready])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  return useContext(AuthContext)
}

/* ---------------------------------------------------------------- */
/* Actions (module functions — usable outside React too)            */
/* ---------------------------------------------------------------- */

function client() {
  const supabase = getSupabase()
  if (!supabase) unconfigured()
  return supabase!
}

/** Message map — terse auth errors become phone-friendly copy. */
export function friendlyAuthMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : String(error ?? '').toLowerCase()
  if (/invalid login credentials/i.test(raw)) {
    return 'Wrong email or password. Check them, or reset your password.'
  }
  if (/email not confirmed/i.test(raw)) {
    return 'Please confirm your email first — check your inbox for the Wemart link.'
  }
  if (/already registered/i.test(raw)) {
    return 'That email already has an account. Sign in instead.'
  }
  if (/at least/i.test(raw) && /password/i.test(raw)) {
    return 'Password is too short — use at least 6 characters.'
  }
  if (/rate limit/i.test(raw)) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  return raw
}

export type SignUpInput = {
  email: string
  password: string
  role: AccountRole
  fullName: string
  /** Vendors only; stored as user_metadata.shop_name until 0008 runs. */
  shopName?: string
}

export async function signUp(input: SignUpInput): Promise<SessionUser | null> {
  const supabase = client()
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // Email link returns to /verify — handled by AuthPages/VerifyPage.
      emailRedirectTo: REDIRECT_VERIFY,
      data: {
        role: input.role,
        full_name: input.fullName,
        ...(input.shopName ? { shop_name: input.shopName } : {}),
      },
    },
  })
  if (error) throw new AuthError(error.message, 'signup', error)
  return userFrom(data.session ?? null) // null ⇒ "check your inbox" flow
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const supabase = client()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw new AuthError(error.message, 'signin', error)
  const user = userFrom(data.session)
  if (!user) throw new AuthError('Sign-in returned no session.', 'signin')
  return user
}

export async function signOut(): Promise<void> {
  const supabase = client()
  const { error } = await supabase.auth.signOut()
  if (error) throw new AuthError(error.message, 'signout', error)
}

export async function resendVerification(email: string): Promise<void> {
  const supabase = client()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: REDIRECT_VERIFY },
  })
  if (error) throw new AuthError(error.message, 'resend', error)
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = client()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: REDIRECT_RESET,
  })
  if (error) throw new AuthError(error.message, 'reset-request', error)
}

/** Called on /verify — confirm the email link token for signup or recovery. */
export async function verifyEmailToken(
  tokenHash: string,
  type: 'signup' | 'recovery' | 'email',
): Promise<SessionUser | null> {
  const supabase = client()
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) throw new AuthError(error.message, 'verify', error)
  return userFrom(data.session)
}

/** New password after a recovery link lands (session exists post-verify). */
export async function setNewPassword(password: string): Promise<void> {
  const supabase = client()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new AuthError(error.message, 'password', error)
}
