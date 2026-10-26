import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Auth façade tests — the Supabase client module is stubbed, so these
 * verify OUR contract: role metadata, redirect URLs, and error mapping.
 * Real-auth integration is the owner-run V-block checklist (0008 V6–V8).
 */
const authMock = {
  signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
  signInWithPassword: vi.fn(async () => ({
    data: {
      session: {
        user: {
          id: 'u1',
          email: 'vendor@wemart.ng',
          user_metadata: { role: 'vendor', full_name: 'Ada' },
          email_confirmed_at: '2026-10-27T00:00:00Z',
        },
      },
    },
    error: null,
  })),
  signOut: vi.fn(async () => ({ error: null })),
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  resend: vi.fn(async () => ({ error: null })),
  updateUser: vi.fn(async () => ({ error: null })),
}

vi.mock('../supabase', () => ({
  getSupabase: () => ({ auth: authMock }),
  isSupabaseConfigured: true,
  DATA_SOURCE_DB_LABEL: 'database',
}))

import {
  friendlyAuthMessage,
  requestPasswordReset,
  setNewPassword,
  signIn,
  signOut,
  signUp,
} from '../auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('signUp', () => {
  it('records buyer role + full name and redirects to /verify', async () => {
    await signUp({
      email: 'b@wemart.ng',
      password: 'secret1',
      role: 'buyer',
      fullName: 'Bola Buyer',
    })
    expect(authMock.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'b@wemart.ng',
        options: expect.objectContaining({
          emailRedirectTo: `${window.location.origin}/verify`,
          data: { role: 'buyer', full_name: 'Bola Buyer' },
        }),
      }),
    )
  })

  it('carries vendor shop_name metadata and never buyer fields', async () => {
    await signUp({
      email: 'v@wemart.ng',
      password: 'secret1',
      role: 'vendor',
      fullName: 'Ada Vendor',
      shopName: 'Ada Gadgets',
    })
    expect(authMock.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          data: { role: 'vendor', full_name: 'Ada Vendor', shop_name: 'Ada Gadgets' },
        }),
      }),
    )
  })
})

describe('signIn / signOut', () => {
  it('returns a SessionUser with the vendor role', async () => {
    const user = await signIn('vendor@wemart.ng', 'secret1')
    expect(user).toMatchObject({
      id: 'u1',
      role: 'vendor',
      fullName: 'Ada',
      emailConfirmed: true,
    })
  })

  it('signs out through the client', async () => {
    await signOut()
    expect(authMock.signOut).toHaveBeenCalledOnce()
  })
})

describe('password recovery', () => {
  it('requests a reset link that lands on /reset-password', async () => {
    await requestPasswordReset('b@wemart.ng')
    expect(authMock.resetPasswordForEmail).toHaveBeenCalledWith(
      'b@wemart.ng',
      { redirectTo: `${window.location.origin}/reset-password` },
    )
  })

  it('sets the new password against the recovery session', async () => {
    await setNewPassword('newpass1')
    expect(authMock.updateUser).toHaveBeenCalledWith({ password: 'newpass1' })
  })
})

describe('friendlyAuthMessage', () => {
  it('maps wrong credentials and unconfirmed email to honest copy', () => {
    expect(friendlyAuthMessage(new Error('Invalid login credentials'))).toContain(
      'Wrong email or password',
    )
    expect(friendlyAuthMessage(new Error('Email not confirmed'))).toContain(
      'confirm your email',
    )
  })

  it('passes unknown messages through', () => {
    expect(friendlyAuthMessage(new Error('Something else'))).toContain('Something else')
  })
})
