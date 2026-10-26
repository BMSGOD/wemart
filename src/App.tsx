import { RouterProvider, useRouter, Link } from './lib/router'
import { AuthProvider } from './lib/auth'
import { isSupabaseConfigured } from './lib/supabase'
import BottomNav from './components/BottomNav'
import SetupNotice from './components/SetupNotice'
import SimpleTopBar from './components/SimpleTopBar'
import HomePage from './pages/HomePage'
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './pages/AuthPages'
import VendorDashboardPage from './pages/VendorDashboardPage'
import AccountPage, { OrdersPage } from './pages/AccountPages'

/**
 * App shell — v2: the same product discovery at '/' (HomePage is the
 * previous App component, moved verbatim — SAME catalog API calls, SAME
 * filters, SAME pagination) wrapped in a micro router, plus these routes:
 *
 *   /auth/login /auth/register /auth/forgot  — Supabase auth pages
 *   /verify  /reset-password                  — email-link landings
 *   /sell                                     — vendor dashboard
 *   /account /orders                          — buyer surfaces
 *
 * No Supabase config ⇒ the whole app is still the friendly setup screen.
 * Email links are absolute `${origin}/verify?…` so they work locally and on
 * the deployed Workers site (SPA fallback serves index.html for every path).
 */
export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <RouterProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </RouterProvider>
  )
}

function Shell() {
  const { path } = useRouter()
  const home = path === '/' || path === ''
  if (home) {
    /* HomePage composes its own sticky Header + BottomNav (moved verbatim). */
    return <HomePage />
  }
  const clean = path.replace(/\/$/, '')
  return (
    <>
      <NavRoute path={clean} />
      <BottomNav path={clean} />
    </>
  )
}

function NavRoute({ path }: { path: string }) {
  const bar = (title: string) => (
    <>
      <SimpleTopBar title={title} />
      {contentFor(path)}
    </>
  )
  switch (path) {
    case '/auth/login':
      return bar('Sign in')
    case '/auth/register':
    case '/auth/create-account':
      return bar('Create account')
    case '/auth/forgot':
      return bar('Reset password')
    case '/verify':
    case '/auth/verify':
      return bar('Email verification')
    case '/reset-password':
    case '/auth/reset-password':
      return bar('New password')
    case '/sell':
      return bar('Selling')
    case '/account':
      return bar('Account')
    case '/orders':
      return bar('Orders')
    default:
      return <NotFound />
  }
}

function contentFor(path: string) {
  switch (path) {
    case '/auth/login':
      return <LoginPage />
    case '/auth/register':
    case '/auth/create-account':
      return <RegisterPage />
    case '/auth/forgot':
      return <ForgotPasswordPage />
    case '/verify':
    case '/auth/verify':
      return <VerifyEmailPage />
    case '/reset-password':
    case '/auth/reset-password':
      return <ResetPasswordPage />
    case '/sell':
      return <VendorDashboardPage />
    case '/account':
      return <AccountPage />
    case '/orders':
      return <OrdersPage />
    default:
      return null
  }
}

function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-bold text-ink">Page not found</h1>
      <p className="mt-2 text-sm text-ink/70">That link does not exist on Wemart.</p>
      <Link href="/" className="mt-4 inline-block text-sm font-bold text-orange-deep underline underline-offset-2">
        Back to browsing
      </Link>
    </main>
  )
}
