import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { login } from '@/api/auth'
import { MOCK_KDM_WEBHOOK_SECRET, MOCK_WMS_API_KEY, storeConnectRequests } from '@/mocks/fixtures'
import { handleLocations, handleStoreStock, handleWarehouses } from './handlers.js'

const ORIGIN = 'http://localhost:3000'
const ENV = {
  KDS_API_BASE_URL: `${ORIGIN}/api`,
  WMS_API_KEY: MOCK_WMS_API_KEY,
  STORE_CONNECT_URL: 'http://store-connect.test',
  STORE_CONNECT_SECRET: MOCK_KDM_WEBHOOK_SECRET,
}

let token
const get = (path, auth = token) =>
  new Request(`${ORIGIN}${path}`, { headers: auth ? { Authorization: `Bearer ${auth}` } : {} })
const post = (path, body, auth = token) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify(body),
  })

beforeEach(async () => {
  token = (await login('staff@kawahputih.test', 'password123')).access_token
})

describe('GET /api/wms/warehouses', () => {
  it("lists the company's warehouses with the server-held key, derived WMS URL", async () => {
    const res = await handleWarehouses(get('/api/wms/warehouses?company_id=1'), ENV)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      { id: 1, code: 'KP', name: 'Kawah Putih Main' },
      { id: 2, code: 'KPK', name: 'Kawah Putih Kitchen' },
    ])
  })

  it('needs a valid KDS login, and passes Odoo 401 back so the app can refresh', async () => {
    expect((await handleWarehouses(get('/api/wms/warehouses?company_id=1', null), ENV)).status).toBe(401)
    expect((await handleWarehouses(get('/api/wms/warehouses?company_id=1', 'not-a-token'), ENV)).status).toBe(401)
  })

  it("refuses a company the user can't access, before calling the WMS", async () => {
    const res = await handleWarehouses(get('/api/wms/warehouses?company_id=3'), ENV)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('forbidden')
  })

  it('says which server env is missing', async () => {
    const noKey = await handleWarehouses(get('/api/wms/warehouses?company_id=1'), { ...ENV, WMS_API_KEY: '' })
    expect(noKey.status).toBe(500)
    expect((await noKey.json()).error.message).toBe('WMS_API_KEY is not set on the server.')

    const noBase = await handleWarehouses(get('/api/wms/warehouses?company_id=1'), { ...ENV, KDS_API_BASE_URL: '' })
    expect((await noBase.json()).error.code).toBe('server_misconfigured')
  })

  it('turns a WMS rejection into a readable 502', async () => {
    const res = await handleWarehouses(get('/api/wms/warehouses?company_id=1'), { ...ENV, WMS_API_KEY: 'wrong' })
    expect(res.status).toBe(502)
    expect((await res.json()).error.message).toBe('WMS: The API key is invalid or expired.')
  })
})

describe('GET /api/wms/locations', () => {
  it('lists internal locations of the warehouse', async () => {
    const res = await handleLocations(get('/api/wms/locations?company_id=1&warehouse_id=1'), ENV)
    expect(await res.json()).toEqual([
      { id: 11, name: 'Stock', complete_name: 'KP/Stock' },
      { id: 12, name: 'Kitchen', complete_name: 'KP/Stock/Kitchen' },
    ])
  })

  it('rejects a non-numeric warehouse id', async () => {
    expect((await handleLocations(get('/api/wms/locations?company_id=1&warehouse_id=1/../x'), ENV)).status).toBe(400)
  })
})

describe('POST /api/store-stock', () => {
  const body = { company_id: '1', warehouse_id: '1', location_id: '12', barcode: 'NASGOR-01' }

  it("reads on-hand from Odoo as the user and pushes it with the server's secret", async () => {
    const res = await handleStoreStock(post('/api/store-stock', { ...body, qty: 999 }), ENV)
    expect(res.status).toBe(200)
    // qty comes from Odoo (4 on hand), never from the browser's body
    expect(await res.json()).toMatchObject({ barcode: 'NASGOR-01', qty: 4, api_id: expect.any(String) })
    expect(storeConnectRequests).toEqual([
      { company_id: 1, location_id: 12, warehouse_id: 1, items: [{ barcode: 'NASGOR-01', qty: 4 }] },
    ])
  })

  it('needs a login and a well-formed body', async () => {
    expect((await handleStoreStock(post('/api/store-stock', body, null), ENV)).status).toBe(401)
    expect((await handleStoreStock(post('/api/store-stock', { ...body, location_id: 'x' }), ENV)).status).toBe(400)
    expect(storeConnectRequests).toHaveLength(0)
  })

  it('reports a Store Connect rejection as 502 with the api_id', async () => {
    const res = await handleStoreStock(post('/api/store-stock', { ...body, barcode: 'RENDANG-01' }), ENV)
    expect(res.status).toBe(502)
    expect((await res.json()).error.message).toMatch(/^Store Connect: Barcode not found: RENDANG-01 \(api_id \w+\)$/)
  })

  it('skips when Store Connect is not configured on the server', async () => {
    const res = await handleStoreStock(post('/api/store-stock', body), { ...ENV, STORE_CONNECT_URL: '' })
    expect(await res.json()).toEqual({ skipped: 'disabled' })
  })

  it('never sends the secret anywhere but Store Connect', async () => {
    const seen = []
    server.events.on('request:start', ({ request }) => seen.push([request.url, request.headers.get('authorization')]))
    await handleStoreStock(post('/api/store-stock', body), ENV)
    server.events.removeAllListeners()
    const withSecret = seen.filter(([, auth]) => auth?.includes(MOCK_KDM_WEBHOOK_SECRET)).map(([url]) => new URL(url).host)
    expect(withSecret).toEqual(['store-connect.test'])
  })

  it('answers 502 when Odoo is unreachable', async () => {
    server.use(http.get(`${ORIGIN}/api/stock`, () => HttpResponse.error()))
    const res = await handleStoreStock(post('/api/store-stock', body), ENV)
    expect(res.status).toBe(502)
  })
})
