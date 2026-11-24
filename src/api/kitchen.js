import { apiFetch } from './client'

// employee_code (the Attendance Code) records who performed each action, separate from the logged-in Odoo user.

/** Resolves an Attendance Code to an employee and reports the company's open session, if any. */
export function whoami({ companyId, employeeCode }) {
  return apiFetch('/kitchen/whoami', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, employee_code: employeeCode }),
  })
}

/** `shift` is free text: the display name of the shift picked from foom_attendance. */
export function openKitchenSession({ companyId, employeeCode, shift }) {
  return apiFetch('/kitchen/sessions', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, employee_code: employeeCode, shift }),
  })
}

/**
 * Read-only BoM preview (creates/reserves nothing). Shortage fields are hints; finishing the MO is the authority.
 * Errors: 409 no_bom, 400 bom_mismatch, 404 not_found.
 * @returns {Promise<import('@/lib/bom').BomPreview>}
 */
export function getBomPreview({ companyId, productId, qty, warehouseId }) {
  const params = new URLSearchParams()
  if (companyId) params.set('company_id', companyId)
  params.set('product_id', productId)
  if (qty != null) params.set('qty', String(qty))
  if (warehouseId) params.set('warehouse_id', warehouseId)
  return apiFetch(`/kitchen/boms?${params.toString()}`)
}

/** An MO's ingredients (finished good excluded) with the qty already scrapped. */
export function getProductionComponents(productionId) {
  return apiFetch(`/kitchen/productions/${productionId}/components`)
}

/**
 * Scraps are validated immediately; the response carries refreshed `components`.
 * Errors: 400 not_a_component, 401 invalid_employee_code, 409 scrap_failed.
 * @param {string} productionId
 * @param {{employeeCode: string, items: {product_id: string, qty: number, reason?: string}[]}} opts
 */
export function createProductionScraps(productionId, { employeeCode, items }) {
  return apiFetch(`/kitchen/productions/${productionId}/scraps`, {
    method: 'POST',
    body: JSON.stringify({ employee_code: employeeCode, items }),
  })
}

/** Every scrap ever recorded against one MO, newest first. */
export function listProductionScraps(productionId) {
  return apiFetch(`/kitchen/productions/${productionId}/scraps`)
}

/** Full detail incl. productions[], scraps[], logs[]. */
export function getKitchenSession(id) {
  return apiFetch(`/kitchen/sessions/${id}`)
}

export function listKitchenSessions({ companyId, state } = {}) {
  const params = new URLSearchParams()
  if (companyId) params.set('company_id', companyId)
  if (state) params.set('state', state)
  const qs = params.toString()
  return apiFetch(`/kitchen/sessions${qs ? `?${qs}` : ''}`)
}

/** Creates a Manufacturing Order; the backend auto-confirms it. */
export function createProduction({ companyId, employeeCode, productId, qty, bomId }) {
  return apiFetch('/kitchen/productions', {
    method: 'POST',
    body: JSON.stringify({
      company_id: companyId,
      employee_code: employeeCode,
      product_id: productId,
      qty,
      bom_id: bomId,
    }),
  })
}

/**
 * @param {string} id
 * @param {{employeeCode: string, action: 'confirm'|'start'|'done'|'cancel', qty?: number, backorder?: boolean}} opts
 */
export function setProductionState(id, { employeeCode, action, qty, backorder }) {
  return apiFetch(`/kitchen/productions/${id}/state`, {
    method: 'POST',
    body: JSON.stringify({ employee_code: employeeCode, action, qty, backorder }),
  })
}

/**
 * @param {string} id
 * @param {{employeeCode: string, scraps: {product_id: string, qty: number, production_id?: string, reason?: string}[], cancelPending?: boolean, force?: boolean}} opts
 */
export function closeKitchenSession(id, { employeeCode, scraps, cancelPending, force }) {
  return apiFetch(`/kitchen/sessions/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({
      employee_code: employeeCode,
      scraps,
      cancel_pending: cancelPending,
      force,
    }),
  })
}
