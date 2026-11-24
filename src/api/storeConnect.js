/**
 * Store Connect KDM stock webhook. Each item's qty replaces the store's on-hand
 * stock (it is not added), so resending the same payload is safe.
 * Responses are {api_id, status, message, data}; keep api_id for tracing.
 */
const RETRY_DELAYS_MS = [1000, 3000]
const TIMEOUT_MS = 10_000

export class StoreConnectError extends Error {
  constructor(status, message, apiId) {
    super(message)
    this.status = status
    this.apiId = apiId ?? null
  }

  /** 4xx means the payload or mapping is wrong; resending it unchanged won't help. */
  get retryable() {
    return this.status === 0 || this.status >= 500
  }
}

export function isStoreConnectEnabled() {
  return Boolean(import.meta.env.VITE_STORE_CONNECT_URL)
}

function toPositiveInt(value, field) {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new StoreConnectError(400, `${field} must be a positive integer (got "${value}").`)
  return n
}

async function postOnce(body) {
  const base = import.meta.env.VITE_STORE_CONNECT_URL.replace(/\/$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(`${base}/api/v3/webhooks/kdm/stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_STORE_CONNECT_SECRET ?? ''}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    throw new StoreConnectError(0, 'Could not reach Store Connect (timeout, network error or CORS).')
  } finally {
    clearTimeout(timer)
  }
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new StoreConnectError(res.status, json?.message ?? res.statusText, json?.api_id)
  return json
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Later requests win on the server, so requests for one store must not overlap.
const queues = new Map()

/**
 * @param {{companyId: string|number, warehouseId: string|number, locationId: string|number, items: {barcode: string, qty: number}[]}} payload
 * @param {{retryDelaysMs?: number[]}} [options]
 * @returns {Promise<{api_id: string, status: number, message: string, data: {store_uuid: string, items: object[]}}>}
 */
export async function pushKdmStock({ companyId, warehouseId, locationId, items }, { retryDelaysMs = RETRY_DELAYS_MS } = {}) {
  const body = {
    company_id: toPositiveInt(companyId, 'company_id'),
    location_id: toPositiveInt(locationId, 'location_id'),
    warehouse_id: toPositiveInt(warehouseId, 'warehouse_id'),
    items: items.map(({ barcode, qty }) => ({ barcode: String(barcode).trim(), qty: Math.max(0, Math.floor(qty)) })),
  }

  async function send() {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await postOnce(body)
      } catch (err) {
        if (!err.retryable || attempt >= retryDelaysMs.length) throw err
        await wait(retryDelaysMs[attempt])
      }
    }
  }

  const key = `${body.company_id}:${body.warehouse_id}:${body.location_id}`
  const run = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(send)
  queues.set(key, run)
  return run
}
