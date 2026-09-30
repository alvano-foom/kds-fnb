import { apiFetch } from './client'

/** @returns {Promise<import('../types').Warehouse[]>} */
export function listWarehouses(companyId) {
  const params = new URLSearchParams({ company_id: companyId })
  return apiFetch(`/warehouses?${params.toString()}`)
}
