import { apiFetch } from './client'

/** Returns OrderLineCard[] — one entry per sale.order.line, scoped by company_id only. */
export function getOrderLines({ companyId, since }) {
  const params = new URLSearchParams({ company_id: companyId })
  if (since) params.set('since', since)
  return apiFetch(`/order-lines?${params.toString()}`)
}

export function updateLineState(lineId, kitchenState) {
  return apiFetch(`/order-lines/${lineId}/state`, {
    method: 'PATCH',
    body: JSON.stringify({ kitchen_state: kitchenState }),
  })
}
