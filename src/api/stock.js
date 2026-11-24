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
