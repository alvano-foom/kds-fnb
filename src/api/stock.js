import { apiFetch } from './client'

/**
 * @param {{companyId: string, productIds?: string[], warehouseId?: string, kitchenOnly?: boolean, components?: boolean}} query
 * `kitchenOnly: true` is what the product picker uses to only ever offer
 * products from an `is_kitchen` category — the same scoping the order
 * board already relies on.
 */
export function getStock({ companyId, productIds, warehouseId, kitchenOnly, components } = {}) {
  const params = new URLSearchParams()
  if (companyId) params.set('company_id', companyId)
  if (productIds?.length) params.set('product_ids', productIds.join(','))
  if (warehouseId) params.set('warehouse_id', warehouseId)
  if (kitchenOnly) params.set('kitchen_only', '1')
  if (components) params.set('components', '1')
  return apiFetch(`/stock?${params.toString()}`)
}
