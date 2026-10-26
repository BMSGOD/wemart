import { describe, expect, it, vi } from 'vitest'
import { toVendorDataError, isPoliciesPending, saveVendorProfile } from '../vendor'

/* Stub client for the write-path test below (no network, no assumptions). */
vi.mock('../../lib/supabase', () => {
  const updateMock = vi.fn(() => Promise.resolve({ eq: () => Promise.resolve({ error: null }) }))
  return {
    getSupabase: () => ({
      from: () => ({ update: updateMock }),
    }),
    isSupabaseConfigured: true,
    DATA_SOURCE_DB_LABEL: 'database',
  }
})

import { getSupabase } from '../../lib/supabase'

/** Auth error kinds map into honest UI states — no crash path. */
describe('vendor data error classification', () => {
  it('classifies Postgres 42501 as policies-pending', () => {
    const err = toVendorDataError({
      message: 'permission denied for table vendors',
      code: '42501',
    })
    expect(err.kind).toBe('policies-pending')
    expect(isPoliciesPending(err)).toBe(true)
  })

  it('classifies row-level-security wording even without a code', () => {
    expect(isPoliciesPending(toVendorDataError({
      message: 'new row violates row-level security policy',
    }))).toBe(true)
  })

  it('classifies missing-row responses as no-profile', () => {
    expect(toVendorDataError({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }).kind).toBe('no-profile')
  })

  it('leaves everything else other', () => {
    expect(toVendorDataError({ message: 'network boom' }).kind).toBe('other')
    expect(isPoliciesPending(toVendorDataError({ message: 'network boom' }))).toBe(false)
  })

  it('treats nulls defensively', () => {
    expect(toVendorDataError(null).kind).toBe('other')
  })
})

/** Profile saves write ONLY verified columns to the caller's own table. */
describe('saveVendorProfile', () => {
  it('sends the business_name/display_name patch unmodified', async () => {
    await saveVendorProfile({ business_name: 'Ada Gadgets Nigeria', display_name: 'Ada' })
    const client = getSupabase() as unknown as {
      from: (table: string) => { update: { mock: { calls: unknown[][] } } }
    }
    expect(client.from('vendors').update.mock.calls[0][0]).toEqual({
      business_name: 'Ada Gadgets Nigeria',
      display_name: 'Ada',
    })
  })
})
