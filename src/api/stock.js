import { apiFetch } from './client'

/** @param {{companyId?: string, productIds?: string[], barcodes?: string[], warehouseId?: string, locationId?: string, components?: boolean}} query */
export function getStock({ companyId, productIds, barcodes, warehouseId, locationId, components } = {}) {
  const params = new URLSearchParams()
  if (companyId) params.set('company_id', companyId)
  if (barcodes?.length) params.set('barcodes', barcodes.join(','))
  else if (productIds?.length) params.set('product_ids', productIds.join(','))
  if (warehouseId) params.set('warehouse_id', warehouseId)
  if (locationId) params.set('location_id', locationId)
  if (components) params.set('components', '1')
  return apiFetch(`/stock?${params.toString()}`)
}

/**
 * Read-only: can this basket be made from current stock? Reserves nothing.
 * Lines with order_line_id are existing orders: Odoo counts only their unreserved part.
 * The low-stock threshold stays in Odoo (foom_fnb_api.low_stock_portions).
 * @param {{companyId: string, warehouseId?: string, lines: ({barcode: string}|{product_id: string}) & {qty: number, order_line_id?: string}[]}} basket
 * @returns {Promise<import('@/lib/stockCheck').StockCheckResult>}
 */
export function checkStock({ companyId, warehouseId, lines }) {
  return apiFetch('/stock/check', {
    method: 'POST',
    body: JSON.stringify({
      company_id: companyId,
      warehouse_id: warehouseId || undefined,
      lines,
      stock_alerts: true,
      product_alerts: true,
    }),
  })
}
