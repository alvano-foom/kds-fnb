import { apiFetch } from './client'

/**
 * @param {{sessionId?: string, employeeId?: string, companyId?: string, warehouseId?: string, state?: string, hasScrap?: boolean}} [query]
 * @returns {Promise<import('../types').ManufacturingOrder[]>}
 */
export function listManufacturingOrders(query = {}) {
  const params = new URLSearchParams()
  if (query.sessionId) params.set('session_id', query.sessionId)
  if (query.employeeId) params.set('employee_id', query.employeeId)
  if (query.companyId) params.set('company_id', query.companyId)
  if (query.warehouseId) params.set('warehouse_id', query.warehouseId)
  if (query.state) params.set('state', query.state)
  if (query.hasScrap !== undefined) params.set('has_scrap', String(query.hasScrap))
  const qs = params.toString()
  return apiFetch(`/manufacturing-orders${qs ? `?${qs}` : ''}`)
}

/**
 * Creates and immediately finalizes a manufacturing order for the given
 * open session. `employee_id`/`company_id` are deliberately NOT sent —
 * the server resolves both from `session_id` (see api/mocks/handlers.js).
 * @param {{sessionId: string, warehouseId: string, productId: string, qty: number, scrapQty?: number, scrapReason?: string}} input
 */
export function createManufacturingOrder({ sessionId, warehouseId, productId, qty, scrapQty, scrapReason }) {
  return apiFetch('/manufacturing-orders', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      warehouse_id: warehouseId,
      product_id: productId,
      qty,
      scrap_qty: scrapQty ?? null,
      scrap_reason: scrapReason ?? undefined,
    }),
  })
}

export function recordScrap(manufacturingOrderId, { qty, reason }) {
  return apiFetch(`/manufacturing-orders/${manufacturingOrderId}/scrap`, {
    method: 'PATCH',
    body: JSON.stringify({ qty, reason }),
  })
}
