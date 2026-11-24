import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { storeConnectRequests } from '@/mocks/fixtures'
import { pushKdmStock } from './storeConnect'

const STORE = { companyId: '1', warehouseId: '1', locationId: '12' }
const NO_WAIT = { retryDelaysMs: [0, 0] }

describe('pushKdmStock', () => {
  it('sends integer ids and whole, non-negative qty, and returns the response with api_id', async () => {
    const res = await pushKdmStock({ ...STORE, items: [{ barcode: ' NASGOR-01 ', qty: 6.8 }, { barcode: 'AYAM-01', qty: -2 }] })

    expect(storeConnectRequests.at(-1)).toEqual({
      company_id: 1,
      location_id: 12,
      warehouse_id: 1,
      items: [{ barcode: 'NASGOR-01', qty: 6 }, { barcode: 'AYAM-01', qty: 0 }],
    })
    expect(res.api_id).toEqual(expect.any(String))
    expect(res.data.items[0]).toEqual({ barcode: 'NASGOR-01', previous_qty: 0, qty: 6, difference: 6 })
  })

  it('replaces stock: resending the same qty reports no difference', async () => {
    await pushKdmStock({ ...STORE, items: [{ barcode: 'AYAM-01', qty: 3 }] })
    const again = await pushKdmStock({ ...STORE, items: [{ barcode: 'AYAM-01', qty: 3 }] })
    expect(again.data.items[0].difference).toBe(0)
  })

  it('does not retry a 404 and keeps the api_id on the error', async () => {
    let calls = 0
    server.use(
      http.post('*/api/v3/webhooks/kdm/stock', () => {
        calls += 1
        return HttpResponse.json({ api_id: 'abc123', status: 404, message: 'Barcode not found: X' }, { status: 404 })
      }),
    )
    await expect(pushKdmStock({ ...STORE, items: [{ barcode: 'X', qty: 1 }] }, NO_WAIT)).rejects.toMatchObject({
      status: 404,
      apiId: 'abc123',
      message: 'Barcode not found: X',
    })
    expect(calls).toBe(1)
  })

  it('retries a 500 and succeeds once the server recovers', async () => {
    let calls = 0
    server.use(
      http.post('*/api/v3/webhooks/kdm/stock', () => {
        calls += 1
        return calls < 3 ? HttpResponse.json({ api_id: 'x', status: 500, message: 'Internal Server Error' }, { status: 500 }) : undefined
      }),
    )
    const res = await pushKdmStock({ ...STORE, items: [{ barcode: 'SATE-01', qty: 2 }] }, NO_WAIT)
    expect(calls).toBe(3)
    expect(res.message).toBe('Stock updated')
  })

  it('rejects a bad secret with INVALID_WEBHOOK_SECRET and an unknown store with Store not found', async () => {
    await expect(
      pushKdmStock({ companyId: '1', warehouseId: '3', locationId: '31', items: [{ barcode: 'AYAM-01', qty: 1 }] }),
    ).rejects.toMatchObject({ status: 404, message: 'Store not found' })

    server.use(
      http.post('*/api/v3/webhooks/kdm/stock', () =>
        HttpResponse.json({ api_id: 'y', status: 401, message: 'INVALID_WEBHOOK_SECRET' }, { status: 401 }),
      ),
    )
    await expect(pushKdmStock({ ...STORE, items: [{ barcode: 'AYAM-01', qty: 1 }] }, NO_WAIT)).rejects.toMatchObject({
      status: 401,
      message: 'INVALID_WEBHOOK_SECRET',
    })
  })

  it('refuses non-numeric ids before calling Store Connect', async () => {
    await expect(pushKdmStock({ ...STORE, companyId: 'c1', items: [{ barcode: 'AYAM-01', qty: 1 }] })).rejects.toThrow(
      /company_id must be a positive integer/,
    )
    expect(storeConnectRequests).toHaveLength(0)
  })

  it('sends requests for the same store one after another, in call order', async () => {
    const order = []
    server.use(
      http.post('*/api/v3/webhooks/kdm/stock', async ({ request }) => {
        const body = await request.clone().json()
        order.push(`start ${body.items[0].qty}`)
        await new Promise((r) => setTimeout(r, body.items[0].qty === 1 ? 30 : 0))
        order.push(`end ${body.items[0].qty}`)
        return undefined
      }),
    )
    await Promise.all([
      pushKdmStock({ ...STORE, items: [{ barcode: 'AYAM-01', qty: 1 }] }),
      pushKdmStock({ ...STORE, items: [{ barcode: 'AYAM-01', qty: 2 }] }),
    ])
    expect(order).toEqual(['start 1', 'end 1', 'start 2', 'end 2'])
  })
})
