import { apiFetch } from './client'

/** @param {{companyId?: string, productIds?: string[], warehouseId?: string, components?: boolean}} query */
export function getStock({ companyId, productIds, warehouseId, components } = {}) {
  const params = new URLSearchParams()
  if (companyId) params.set('company_id', companyId)
  if (productIds?.length) params.set('product_ids', productIds.join(','))
  if (warehouseId) params.set('warehouse_id', warehouseId)
  if (components) params.set('components', '1')
  return apiFetch(`/stock?${params.toString()}`)
}

/**
 * Read-only: can this basket be made from current stock? Reserves nothing.
 * @param {{companyId: string, warehouseId?: string, lines: ({barcode: string}|{product_id: string}) & {qty: number}[]}} basket
 * @returns {Promise<import('@/lib/stockCheck').StockCheckResult>}
 */
export function checkStock({ companyId, warehouseId, lines }) {
  return apiFetch('/stock/check', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, warehouse_id: warehouseId || undefined, lines }),
  })
}
