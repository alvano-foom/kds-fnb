/**
 * foom_wms_api (/api/wms/v1): a different module and auth scheme from /api/kds.
 * Bearer is an Odoo user API key; X-Company-Id scopes every read to one company.
 * Responses are {status, message, data}; errors are {status, error_code, message}.
 */
function wmsBase() {
  const explicit = import.meta.env.VITE_WMS_API_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const kds = import.meta.env.VITE_API_BASE_URL ?? '/api'
  if (/^https?:\/\//.test(kds)) return `${new URL(kds).origin}/api/wms/v1`
  return '/api/wms/v1'
}

export class WmsError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function wmsGet(path, companyId) {
  const apiKey = import.meta.env.VITE_WMS_API_KEY
  if (!apiKey) {
    throw new WmsError(0, 'missing_api_key', 'VITE_WMS_API_KEY is not set. Add it to .env.local (or the host env) and restart.')
  }
  let res
  try {
    res = await fetch(`${wmsBase()}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Company-Id': String(companyId),
      },
    })
  } catch {
    throw new WmsError(0, 'network_error', 'Could not reach the WMS API (network error or blocked by CORS).')
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new WmsError(res.status, body?.error_code ?? 'unknown', body?.message ?? res.statusText)
  }
  return body?.data
}

/** Reads every page of a paginated list endpoint. */
async function wmsList(path, companyId) {
  const all = []
  for (let page = 1; ; page += 1) {
    const sep = path.includes('?') ? '&' : '?'
    const data = await wmsGet(`${path}${sep}page=${page}&limit=100`, companyId)
    all.push(...(data?.list ?? []))
    if (page >= (data?.pagination?.total_pages ?? 1)) return all
  }
}

/** @returns {Promise<{id: number, code: string, name: string}[]>} */
export function listWarehouses(companyId) {
  return wmsList('/config/warehouses', companyId)
}

/** Internal locations under the warehouse. @returns {Promise<{id: number, name: string, complete_name: string}[]>} */
export function listLocations(companyId, warehouseId) {
  return wmsList(`/config/warehouses/${warehouseId}/locations`, companyId)
}
