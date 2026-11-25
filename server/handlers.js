/**
 * The KDS backend: keeps the WMS API key and the Store Connect secret off the browser.
 * Plain web Request -> Response functions, so the same code runs on Vercel (api/),
 * on a standalone Node server (server/index.js), in `vite dev`, and under MSW mocks.
 *
 * Every route needs the caller's own KDS access token. It is forwarded to Odoo, which
 * decides whether it is valid and which companies the user may touch.
 *
 * env: KDS_API_BASE_URL (falls back to VITE_API_BASE_URL), WMS_API_URL (optional),
 *      WMS_API_KEY, STORE_CONNECT_URL (empty = sync off), STORE_CONNECT_SECRET
 */
import { pushKdmStock, StoreConnectError } from './storeConnect.js'

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fail = (status, code, message) => json(status, { error: { code, message } })

class HttpFailure extends Error {
  constructor(response) {
    super('upstream failure')
    this.response = response
  }
}

function kdsBase(env) {
  const base = (env.KDS_API_BASE_URL || env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  if (!/^https?:\/\//.test(base)) throw new HttpFailure(fail(500, 'server_misconfigured', 'KDS_API_BASE_URL must be an absolute URL.'))
  return base
}

function wmsBase(env) {
  if (env.WMS_API_URL) return env.WMS_API_URL.replace(/\/$/, '')
  return `${new URL(kdsBase(env)).origin}/api/wms/v1`
}

/** GET from the KDS API as the calling user. Odoo's own 401/403 is passed straight back. */
async function kdsGet(request, env, path) {
  const auth = request.headers.get('authorization')
  if (!auth) throw new HttpFailure(fail(401, 'unauthorized', 'Missing access token.'))
  const url = `${kdsBase(env)}${path}`
  let res
  try {
    res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } })
  } catch {
    throw new HttpFailure(fail(502, 'upstream_unreachable', 'Could not reach the KDS API.'))
  }
  if (!res.ok) {
    throw new HttpFailure(new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } }))
  }
  return res.json()
}

async function requireCompanyAccess(request, env, companyId) {
  if (!companyId) throw new HttpFailure(fail(400, 'bad_request', 'company_id is required.'))
  const companies = await kdsGet(request, env, '/companies')
  if (!companies.some((c) => String(c.id) === String(companyId))) {
    throw new HttpFailure(fail(403, 'forbidden', 'You do not have access to this company.'))
  }
}

async function wmsList(env, companyId, path) {
  if (!env.WMS_API_KEY) throw new HttpFailure(fail(500, 'server_misconfigured', 'WMS_API_KEY is not set on the server.'))
  const base = wmsBase(env)
  const all = []
  for (let page = 1; ; page += 1) {
    let res
    try {
      res = await fetch(`${base}${path}?page=${page}&limit=100`, {
        headers: { Authorization: `Bearer ${env.WMS_API_KEY}`, 'X-Company-Id': String(companyId), Accept: 'application/json' },
      })
    } catch {
      throw new HttpFailure(fail(502, 'wms_unreachable', 'Could not reach the WMS API.'))
    }
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new HttpFailure(fail(502, 'wms_failed', `WMS: ${body?.message ?? res.statusText}`))
    all.push(...(body?.data?.list ?? []))
    if (page >= (body?.data?.pagination?.total_pages ?? 1)) return all
  }
}

function route(handler) {
  return async (request, env) => {
    try {
      return await handler(request, env)
    } catch (err) {
      if (err instanceof HttpFailure) return err.response
      console.error('[kds-server]', err)
      return fail(500, 'server_error', 'Unexpected server error.')
    }
  }
}

/** GET /api/wms/warehouses?company_id= */
export const handleWarehouses = route(async (request, env) => {
  const companyId = new URL(request.url).searchParams.get('company_id')
  await requireCompanyAccess(request, env, companyId)
  const list = await wmsList(env, companyId, '/config/warehouses')
  return json(200, list.map(({ id, code, name }) => ({ id, code, name })))
})

/** GET /api/wms/locations?company_id=&warehouse_id= */
export const handleLocations = route(async (request, env) => {
  const params = new URL(request.url).searchParams
  const companyId = params.get('company_id')
  const warehouseId = params.get('warehouse_id')
  if (!/^\d+$/.test(warehouseId ?? '')) return fail(400, 'bad_request', 'warehouse_id must be a number.')
  await requireCompanyAccess(request, env, companyId)
  const list = await wmsList(env, companyId, `/config/warehouses/${warehouseId}/locations`)
  return json(200, list.map(({ id, name, complete_name }) => ({ id, name, complete_name })))
})

/**
 * POST /api/store-stock {company_id, warehouse_id, location_id, barcode}
 * Reads the product's on-hand from Odoo as the calling user (so the browser cannot
 * choose the qty), then pushes it to Store Connect with the server-held secret.
 */
export const handleStoreStock = route(async (request, env) => {
  if (!request.headers.get('authorization')) return fail(401, 'unauthorized', 'Missing access token.')
  if (!env.STORE_CONNECT_URL) return json(200, { skipped: 'disabled' })
  if (!env.STORE_CONNECT_SECRET) return fail(500, 'server_misconfigured', 'STORE_CONNECT_SECRET is not set on the server.')

  const body = await request.json().catch(() => null)
  const ids = ['company_id', 'warehouse_id', 'location_id']
  if (!body || ids.some((k) => !/^\d+$/.test(String(body[k] ?? ''))) || !String(body.barcode ?? '').trim()) {
    return fail(400, 'bad_request', 'company_id, warehouse_id and location_id must be numbers, and barcode is required.')
  }
  const barcode = String(body.barcode).trim()
  const query = new URLSearchParams({
    company_id: body.company_id,
    barcodes: barcode,
    warehouse_id: body.warehouse_id,
    location_id: body.location_id,
  })
  const stock = await kdsGet(request, env, `/stock?${query}`)
  const row = stock.products?.find((p) => p.barcode === barcode)
  const qty = Math.max(0, Math.floor(row?.on_hand ?? 0))

  try {
    const result = await pushKdmStock(
      { url: env.STORE_CONNECT_URL, secret: env.STORE_CONNECT_SECRET },
      { companyId: body.company_id, warehouseId: body.warehouse_id, locationId: body.location_id, items: [{ barcode, qty }] },
    )
    return json(200, { barcode, qty, api_id: result.api_id, items: result.data?.items ?? [] })
  } catch (err) {
    if (!(err instanceof StoreConnectError)) throw err
    const trace = err.apiId ? ` (api_id ${err.apiId})` : ''
    return fail(502, 'store_connect_failed', `Store Connect: ${err.message}${trace}`)
  }
})

/** Method + path -> handler, shared by every adapter. */
export const routes = {
  'GET /api/wms/warehouses': handleWarehouses,
  'GET /api/wms/locations': handleLocations,
  'POST /api/store-stock': handleStoreStock,
}
