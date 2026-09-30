import { apiFetch } from './client'

/**
 * Creates a production against the open kitchen session for this company
 * (there's no session_id in the request — the backend resolves it). Auto-
 * confirmed by default, matching the real API's default.
 * @returns {Promise<import('../types').Production>}
 */
export function createProduction({ companyId, employeeCode, productId, qty, bomId, confirm = true }) {
  return apiFetch('/kitchen/productions', {
    method: 'POST',
    body: JSON.stringify({
      company_id: companyId,
      employee_code: employeeCode,
      product_id: productId,
      qty,
      bom_id: bomId || undefined,
      confirm,
    }),
  })
}

/**
 * @param {string} productionId
 * @param {'confirm'|'start'|'done'|'cancel'} action
 * @param {{employeeCode: string, qty?: number, backorder?: boolean}} extra
 */
export function setProductionState(productionId, action, { employeeCode, qty, backorder } = {}) {
  return apiFetch(`/kitchen/productions/${productionId}/state`, {
    method: 'POST',
    body: JSON.stringify({ employee_code: employeeCode, action, qty, backorder: backorder || undefined }),
  })
}
