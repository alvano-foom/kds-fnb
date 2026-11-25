import { apiFetch, SERVER_BASE_URL } from '@/api/client'
import { useTenantStore } from '@/store/tenantStore'
import { useErrorLogStore } from '@/store/errorLogStore'

/**
 * After a prep (MO done), ask this app's backend to push the product's on-hand to
 * Store Connect. The backend reads the qty from Odoo and holds the webhook secret.
 * Never throws; failures go to the Error Log.
 * @param {{barcode?: string, name?: string, product_name?: string}} production
 * @returns {Promise<{barcode: string, qty: number, apiId: string}|null>}
 */
export async function syncStoreStock(production) {
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
    const result = await apiFetch(
      '/store-stock',
      {
        method: 'POST',
        body: JSON.stringify({
          company_id: companyId,
          warehouse_id: warehouseId,
          location_id: locationId,
          barcode: production.barcode,
        }),
      },
      { baseUrl: SERVER_BASE_URL },
    )
    if (result?.skipped) return null
    return { barcode: result.barcode, qty: result.qty, apiId: result.api_id }
  } catch (err) {
    logError(`Store Connect stock not updated for ${label}.`, err.message)
    return null
  }
}
