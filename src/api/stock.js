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
