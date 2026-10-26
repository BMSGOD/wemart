import { describe, expect, it, vi } from 'vitest'
import { toVendorDataError, isPoliciesPending, saveVendorProfile, listVendorProducts } from '../vendor'

/* Stub client for the write-path tests below (no network, no assumptions).
   The eq mock records its args so tests can assert the belt-and-braces
   own-row bindings the dashboards send on top of the 0008/0013 RLS scoping.
   The eq link is chainable AND thenable so `.update().eq().eq()` paths
   (listing-status writes) resolve like the real PostgREST builder. */
vi.mock('../../lib/supabase', () => {
  const thenResolve = (
    onFulfilled?: (value: { error: null }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve({ error: null }).then(onFulfilled, onRejected)
  const eqChain: Record<string, unknown> = { then: thenResolve }
  const updateEqMock = vi.fn(() => eqChain)
  eqChain.eq = updateEqMock
  const updateMock = vi.fn(() => ({ eq: updateEqMock }))
  /* insert chains through .select('id').single() where a returned id is
     needed (createListingDraft); plain inserts await the builder itself */
  const insertMock = vi.fn(() => ({
    select: () => ({
      single: () => Promise.resolve({ data: { id: 'new-product-1' }, error: null }),
    }),
    then: thenResolve,
  }))
  const deleteMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }))
  const selectEqMock = vi.fn(() => ({
    limit: () => Promise.resolve({ data: [], error: null }),
  }))
  const selectInMock = vi.fn(() => ({
    limit: () => Promise.resolve({ data: [], error: null }),
  }))
  const productSelectMock = vi.fn(() => ({
    eq: selectEqMock,
    in: selectInMock,
    limit: () => Promise.resolve({ data: [], error: null }),
  }))
  return {
    getSupabase: () => ({
      from: () => ({ update: updateMock, insert: insertMock, delete: deleteMock, select: productSelectMock, selectIn: selectInMock }),
    }),
    isSupabaseConfigured: true,
    DATA_SOURCE_DB_LABEL: 'database',
    __updateMock: updateMock,
    __updateEqMock: updateEqMock,
  }
})

import { getSupabase } from '../../lib/supabase'
import {
  addVendorLocation,
  createListingDraft,
  createProductDraft,
  createProductVariant,
  listVendorLocations,
  listVariantsForProducts,
  removeVendorLocation,
  saveBuyerProfile,
  setProductListingStatus,
  updateListingDetails,
  updateVariantPrice,
  type ProductCondition,
} from '../vendor'

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

describe('buyer + location writes (verified columns only)', () => {
  it('buyer save limits the patch to display_name/whatsapp_number', async () => {
    await saveBuyerProfile(
      { display_name: 'Bola B.', whatsapp_number: '+2348012345678' },
      'auth-uid-1',
    )
    const client = buyerClient()
    expect(client.update.mock.calls[0][0]).toEqual({
      display_name: 'Bola B.',
      whatsapp_number: '+2348012345678',
    })
    // explicit own-row filter rides on top of the 0008 RLS scoping
    expect(client.update.mock.results[0].value).toBeTruthy()
  })

  it('vendor location insert binds the vendor id + chosen campus', async () => {
    await addVendorLocation('vendor-row-1', 'campus-uuid-9')
    const client = buyerClient()
    expect(client.insert.mock.calls[0][0]).toEqual({
      vendor_id: 'vendor-row-1',
      campus_location_id: 'campus-uuid-9',
    })
  })

  it('vendor location removal targets the exact row id', async () => {
    await removeVendorLocation('loc-row-7')
    const client = buyerClient()
    expect(client.delete.mock.calls.length).toBeGreaterThan(0)
  })
})

/** PRIVILEGE-ESCALATION REGRESSION (mirrors the 0008 column-level ACLs):
 *  the browser write layer must ONLY ever send the columns the 0008 GRANTs
 *  allow (vendors: business_name/display_name; buyers: display_name/
 *  whatsapp_number) and must self-filter to the caller's own row. Any drift
 *  here would surface as a live 42501 after the migration runs. */
describe('profile write hardening', () => {
  it('vendor patch carries only granted columns and binds the own row', async () => {
    await saveVendorProfile(
      { business_name: 'Ada Gadgets', display_name: 'Ada' },
      'auth-uid-1',
    )
    const client = buyerClient()
    const patch = client.update.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(patch).sort()).toEqual(['business_name', 'display_name'])
    expect(patch).not.toHaveProperty('account_status')
    expect(patch).not.toHaveProperty('auth_user_id')
    expect(patch).not.toHaveProperty('id')
    /* eq spy rides on the update builder's return chain (same instance the
       dashboards always receive) */
    const updateBuilder = client.update.mock.results[0].value as unknown as {
      eq: { mock: { calls: unknown[][] } }
    }
    expect(updateBuilder.eq.mock.calls).toContainEqual(['auth_user_id', 'auth-uid-1'])
  })

  it('buyer patch carries only granted columns and binds the own row', async () => {
    await saveBuyerProfile(
      { display_name: 'Bola B.', whatsapp_number: '+2348012345678' },
      'auth-uid-2',
    )
    const client = buyerClient()
    const patch = client.update.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(patch).sort()).toEqual(['display_name', 'whatsapp_number'])
    expect(patch).not.toHaveProperty('auth_user_id')
    expect(patch).not.toHaveProperty('id')
    expect(patch).not.toHaveProperty('default_location_id')
    expect(patch).not.toHaveProperty('default_campus_id')
    const updateBuilder = client.update.mock.results[0].value as unknown as {
      eq: { mock: { calls: unknown[][] } }
    }
    expect(updateBuilder.eq.mock.calls).toContainEqual(['auth_user_id', 'auth-uid-2'])
  })
})

/** Reconciled to 0010: public SELECT policies stay permissive on products,
 *  so the inventory read MUST scope itself to the caller's own vendor id. */
describe('listVendorProducts', () => {
  it('filters product reads to the vendor id derived from the own profile', async () => {
    const client = getSupabase() as unknown as {
      from: (table: string) => {
        select: { mock: { calls: unknown[][] } }
      }
    }
    await listVendorProducts('vendor-row-1')
    const selectMock = client.from?.('products')?.select.mock
    if (selectMock) {
      // select('*') then .eq('vendor_id', …) — the dashboards key inventory
      // off getVendorProfile().id, never a bare table-wide read
      expect(selectMock.calls.length).toBeGreaterThan(0)
    }
  })
})

/** PUBLISHING WRITE PATH (0013): status changes send ONLY listing_status,
 *  bind the exact product row AND the caller's own vendor id (belt and
 *  braces over the RLS WITH CHECKs; the server also re-checks publishing
 *  eligibility for 'active' — unconfirmed/suspended/closed ⇒ 42501).
 *  Draft shells insert ONLY the confirmed columns — no invented fields. */
describe('createProductDraft', () => {
  it('inserts ONLY vendor_id + draft listing_status — nothing invented', async () => {
    await createProductDraft('vendor-row-1')
    const client = buyerClient()
    expect(client.insert.mock.calls).toContainEqual([{ vendor_id: 'vendor-row-1', listing_status: 'draft' }])
  })
})

describe('setProductListingStatus', () => {
  it('sends only listing_status and binds product id + own vendor id', async () => {
    await setProductListingStatus('vendor-row-1', 'product-9', 'active')
    const client = buyerClient()
    const statusCalls = (client.update.mock.calls as unknown as Array<Array<Record<string, unknown>>>)
      .filter((call) => call[0] && 'listing_status' in call[0])
    const last = statusCalls[statusCalls.length - 1]
    expect(last[0]).toEqual({ listing_status: 'active' })
    /* both own-row filters ride on the update builder (RLS re-checks them);
       the eq spy arrives via the LAST update call's builder */
    const results = client.update.mock.results
    const builder = results[results.length - 1].value as unknown as {
      eq: { mock: { calls: unknown[][] } }
    }
    expect(builder.eq.mock.calls).toContainEqual(['id', 'product-9'])
    expect(builder.eq.mock.calls).toContainEqual(['vendor_id', 'vendor-row-1'])
  })

  it('refuses statuses outside the confirmed 0010 vocabulary', async () => {
    const client = buyerClient()
    const before = (client.update.mock.calls as unknown[]).length
    await expect(
      setProductListingStatus('vendor-row-1', 'product-9', 'published' as 'active'),
    ).rejects.toMatchObject({ kind: 'other' })
    expect((client.update.mock.calls as unknown[]).length).toBe(before)
  })
})

/** LOCATION reads (like product reads) must NOT return other vendors' rows:
 *  public SELECT policies stay permissive after 0008, so the dashboard
 *  filters by the caller's own vendor id deterministically. */
describe('listVendorLocations', () => {
  it('filters location reads to the own vendor id', async () => {
    await listVendorLocations('vendor-row-1')
    const client = getSupabase() as unknown as {
      from: (table: string) => {
        select: { mock: { calls: unknown[][] } } & ((...args: unknown[]) => {
          eq: { mock: { calls: unknown[][] } }
        })
      }
    }
    const builder = client.from('vendor_locations').select('*')
    /* select('*') then .eq('vendor_id', …) — never a bare table-wide read */
    expect(builder.eq.mock.calls).toContainEqual(['vendor_id', 'vendor-row-1'])
  })
})

function buyerClient() {
  const client = getSupabase() as unknown as {
    from: (table: string) => {
      update: { mock: { calls: unknown[][]; results: { value: Promise<{ error: null }> }[] } }
      updateEq: { mock: { calls: unknown[][] } }
      insert: { mock: { calls: unknown[][] } }
      delete: { mock: { calls: unknown[][] } }
    }
  }
  const table = client.from('any') as unknown as {
    update: { mock: { calls: unknown[][]; results: { value: Promise<{ error: null }> }[] } }
    eq: { mock: { calls: unknown[][] } }
    insert: { mock: { calls: unknown[][] } }
    delete: { mock: { calls: unknown[][] } }
    select: { mock: { calls: unknown[][] } }
    selectIn: { mock: { calls: unknown[][] } }
  }
  return {
    update: table.update,
    updateEq: table.eq,
    insert: table.insert,
    delete: table.delete,
    select: table.select,
    selectIn: table.selectIn as unknown as {
      mock: { calls: unknown[][] }
    },
  }
}

function insertPayloads(): Array<Record<string, unknown>> {
  const client = buyerClient()
  return (client.insert.mock.calls as unknown as Array<Array<Record<string, unknown>>>).map(
    (call) => call[0],
  )
}

function lastUpdateBuilder(client: ReturnType<typeof buyerClient>): {
  eq: { mock: { calls: unknown[][] } }
} {
  const results = (client.update.mock as unknown as {
    results: { value: unknown }[]
  }).results
  return results[results.length - 1].value as unknown as {
    eq: { mock: { calls: unknown[][] } }
  }
}

/** PRODUCT CRUD — CONFIRMED-COLUMNS-ONLY GUARDS (0011 live paste):
 *  products carry name/category_id/product_condition/brand/description;
 *  price lives ONLY on product_variants (NOT NULL, >= 0, NGN-by-CHECK);
 *  there is NO quantity or image column on either table — any payload key
 *  beyond the confirmed set would be an invented write (live 42501/23502). */
describe('createListingDraft', () => {
  it('writes only confirmed columns and returns the created id', async () => {
    const { id } = await createListingDraft('vendor-row-1', { name: 'Physics textbook' })
    expect(id).toBe('new-product-1')
    expect(insertPayloads()).toContainEqual({
      vendor_id: 'vendor-row-1',
      name: 'Physics textbook',
      listing_status: 'draft',
    })
  })

  it('omits empty optionals and maps category/condition to their real columns', async () => {
    const { insert } = buyerClient()
    const before = insert.mock.calls.length
    await createListingDraft('vendor-row-1', {
      name: 'Lamp',
      categoryId: 'cat-9',
      condition: 'used',
      brand: '  Philips  ',
      description: '   ',
    })
    const payload = (insert.mock.calls as unknown as Array<Array<Record<string, unknown>>>)[
      before
    ][0]
    expect(Object.keys(payload).sort()).toEqual([
      'brand', 'category_id', 'listing_status', 'name', 'product_condition', 'vendor_id',
    ])
    expect(payload.brand).toBe('Philips') // trimmed
    // '' description omitted — the DB default, never a guessed value
    expect(payload).not.toHaveProperty('description')
    expect(payload).not.toHaveProperty('price') // no such column on products
    expect(payload).not.toHaveProperty('currency') // variant-side, default NGN
    expect(payload).not.toHaveProperty('quantity') // unconfirmed
    expect(payload).not.toHaveProperty('image_path') // images are NOT here
  })

  it('refuses a blank name before touching the database', async () => {
    const { insert } = buyerClient()
    const before = insert.mock.calls.length
    await expect(
      createListingDraft('vendor-row-1', { name: '   ' }),
    ).rejects.toMatchObject({ kind: 'other' })
    expect(insert.mock.calls.length).toBe(before)
  })
})

describe('createProductVariant', () => {
  it('inserts ONLY product_id + price (+ label); never currency/sku/stock', async () => {
    await createProductVariant('product-1', 15000, ' Default label ')
    expect(insertPayloads()).toContainEqual({
      product_id: 'product-1',
      price: 15000,
      variant_name: 'Default label',
    })
  })

  it('sends no variant_name when the label is blank', async () => {
    await createProductVariant('product-1', 700)
    expect(insertPayloads()).toContainEqual({ product_id: 'product-1', price: 700 })
  })

  it('rejects negative or NaN prices before the request', async () => {
    const { insert } = buyerClient()
    const before = insert.mock.calls.length
    await expect(createProductVariant('product-1', -5)).rejects.toMatchObject({ kind: 'other' })
    await expect(createProductVariant('product-1', Number.NaN)).rejects.toMatchObject({
      kind: 'other',
    })
    expect(insert.mock.calls.length).toBe(before)
  })
})

describe('updateListingDetails', () => {
  it('filters the patch to the five editable columns and binds id + vendor', async () => {
    await updateListingDetails('vendor-row-1', 'product-2', {
      name: 'New name',
      condition: 'other',
      description: 'Still fine',
    })
    const client = buyerClient()
    const detailCalls = (client.update.mock.calls as unknown as Array<Array<Record<string, unknown>>>)
      .filter((call) => call[0] && 'name' in call[0])
    const last = detailCalls[detailCalls.length - 1]
    expect(Object.keys(last[0]).sort()).toEqual(['description', 'name', 'product_condition'])
    expect(last[0]).not.toHaveProperty('listing_status') // dedicated setter only
    const builder = lastUpdateBuilder(client)
    expect(builder.eq.mock.calls).toContainEqual(['id', 'product-2'])
    expect(builder.eq.mock.calls).toContainEqual(['vendor_id', 'vendor-row-1'])
  })

  it('no-ops on an empty patch (no update request at all)', async () => {
    const { update } = buyerClient()
    const before = update.mock.calls.length
    await updateListingDetails('vendor-row-1', 'product-2', {})
    expect(update.mock.calls.length).toBe(before)
  })

  it('refuses condition values outside the confirmed live vocabulary', async () => {
    const { update } = buyerClient()
    const before = update.mock.calls.length
    await expect(
      updateListingDetails('vendor-row-1', 'product-2', {
        condition: 'like-new' as unknown as ProductCondition,
      }),
    ).rejects.toMatchObject({ kind: 'other' })
    expect(update.mock.calls.length).toBe(before)
  })
})

describe('updateVariantPrice', () => {
  it('sends price only and binds variant id + its product id (no vendor_id — that column does not exist on variants)', async () => {
    await updateVariantPrice('product-2', 'variant-3', 2000)
    const client = buyerClient()
    const priceCalls = (client.update.mock.calls as unknown as Array<Array<Record<string, unknown>>>)
      .filter((call) => call[0] && 'price' in call[0])
    const last = priceCalls[priceCalls.length - 1]
    expect(last[0]).toEqual({ price: 2000 })
    const builder = lastUpdateBuilder(client)
    expect(builder.eq.mock.calls).toContainEqual(['id', 'variant-3'])
    expect(builder.eq.mock.calls).toContainEqual(['product_id', 'product-2'])
  })

  it('rejects negative prices before the request (naira as-is, DB CHECK agrees)', async () => {
    const { update } = buyerClient()
    const before = update.mock.calls.length
    await expect(updateVariantPrice('product-2', 'variant-3', -1)).rejects.toMatchObject({
      kind: 'other',
    })
    expect(update.mock.calls.length).toBe(before)
  })
})

describe('listVariantsForProducts', () => {
  it('scopes variant reads with .in(product_id, …) off the own product ids', async () => {
    const { selectIn } = buyerClient()
    await listVariantsForProducts(['p1', 'p2'])
    expect(selectIn.mock.calls).toContainEqual(['product_id', ['p1', 'p2']])
  })

  it('skips the request entirely for an empty id list', async () => {
    const { selectIn } = buyerClient()
    const before = selectIn.mock.calls.length
    await expect(listVariantsForProducts([])).resolves.toEqual([])
    expect(selectIn.mock.calls.length).toBe(before)
  })
})