import { apiFetch, SERVER_BASE_URL } from './client'

// Served by this app's backend (server/handlers.js), which holds the WMS API key.

/** @returns {Promise<{id: number, code: string, name: string}[]>} */
export function listWarehouses(companyId) {
  const query = new URLSearchParams({ company_id: companyId })
  return apiFetch(`/wms/warehouses?${query}`, {}, { baseUrl: SERVER_BASE_URL })
}

/** Internal locations under the warehouse. @returns {Promise<{id: number, name: string, complete_name: string}[]>} */
export function listLocations(companyId, warehouseId) {
  const query = new URLSearchParams({ company_id: companyId, warehouse_id: warehouseId })
  return apiFetch(`/wms/locations?${query}`, {}, { baseUrl: SERVER_BASE_URL })
}
