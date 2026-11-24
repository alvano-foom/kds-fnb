import { getStock } from '@/api/stock'
import { isStoreConnectEnabled, pushKdmStock } from '@/api/storeConnect'
import { useTenantStore } from '@/store/tenantStore'
import { useErrorLogStore } from '@/store/errorLogStore'

/**
 * After a prep (MO done): read the finished product's on-hand at the configured
 * location and push it to Store Connect. Never throws; failures go to the Error Log.
 * @param {{barcode?: string, product_id?: string, name?: string, product_name?: string}} production
 * @returns {Promise<{barcode: string, qty: number, apiId: string}|null>}
 */
export async function syncStoreStock(production) {
  if (!isStoreConnectEnabled()) return null
  const { companyId, warehouseId, locationId } = useTenantStore.getState()
  const label = production.product_name ?? production.name ?? production.barcode ?? 'product'
  const logError = (message, detail) => useErrorLogStore.getState().logError({ category: 'store-connect', message, detail })

  if (!production.barcode) {
    logError(`Store Connect stock not sent for ${label}: the product has no barcode.`)
    return null
  }
  if (!companyId || !warehouseId || !locationId) {
    logError(`Store Connect stock not sent for ${label}: pick a warehouse and location in Settings.`)
    return null
  }

  try {
    const stock = await getStock({ companyId, barcodes: [production.barcode], warehouseId, locationId })
    const row = stock.products?.find((p) => p.barcode === production.barcode)
    const qty = Math.max(0, Math.floor(row?.on_hand ?? 0))
    const result = await pushKdmStock({
      companyId,
      warehouseId,
      locationId,
      items: [{ barcode: production.barcode, qty }],
    })
    return { barcode: production.barcode, qty, apiId: result.api_id }
  } catch (err) {
    const trace = err.apiId ? ` (api_id ${err.apiId})` : ''
    logError(`Store Connect stock not updated for ${label}${trace}.`, err.message)
    return null
  }
}
