import { apiFetch } from './client'

// Kitchen session / production / scrap — see foom_fnb_api's API docs,
// section "Kitchen session & produksi". Every call here carries an
// employee_code (the Kode Absensi) so Odoo knows who actually performed
// the action, separate from whichever Odoo user is logged into this app
// (the JWT bearer token already attached by apiFetch satisfies this
// section's "API key OR bearer" auth requirement — no separate API key
// needed from this app).

/** Looks up an employee by Kode Absensi and reports any session they already have open — lets the UI offer "resume" instead of erroring. */
export function whoami({ companyId, employeeCode }) {
  return apiFetch('/kitchen/whoami', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, employee_code: employeeCode }),
  })
}

/**
 * `shift` is free text on the kitchen API (the display name of the shift the
 * operator picked — the shift list itself comes from foom_attendance, see
 * api/attendance.js).
 */
export function openKitchenSession({ companyId, employeeCode, shift }) {
  return apiFetch('/kitchen/sessions', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, employee_code: employeeCode, shift }),
  })
}

/**
 * Read-only BoM preview for the pre-create checklist: which components get
 * consumed for `qty` of the finished product, with free qty per component.
 * Safe to call repeatedly — creates nothing and reserves nothing. Same
 * numbers the MO will get (Odoo's bom.explode). `shortage_qty` / `ok` are
 * hints only; 409 done_failed on finishing the MO stays the authority.
 * Errors: 409 no_bom, 400 bom_mismatch, 404 not_found.
 * @returns {Promise<import('../lib/bom').BomPreview>}
 */
export function getBomPreview({ companyId, productId, qty, warehouseId }) {
  const params = new URLSearchParams()
  if (companyId) params.set('company_id', companyId)
  params.set('product_id', productId)
  if (qty != null) params.set('qty', String(qty))
  if (warehouseId) params.set('warehouse_id', warehouseId)
  return apiFetch(`/kitchen/boms?${params.toString()}`)
}

/**
 * The ingredients one MO consumes (the finished good is deliberately not in
 * the list) with how much of each has already been scrapped — the data
 * source for the Close Kitchen scrap screen.
 */
export function getProductionComponents(productionId) {
  return apiFetch(`/kitchen/productions/${productionId}/components`)
}

/**
 * Scrap ingredients of one MO. Each item's product must be a component of
 * that MO — the finished good is rejected (400 not_a_component). Scraps are
 * created and validated immediately; the response carries the refreshed
 * `components`. Errors: 401 invalid_employee_code, 409 scrap_failed (e.g.
 * not enough stock at that location).
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

/** Full detail incl. productions[], scraps[], logs[] — the source of truth for the Production page's list. */
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

/**
 * Creates a Manufacturing Order. Auto-confirmed by the backend unless
 * `confirm: false` is sent — this app never sends that, since the
 * decision made with the user is that a kitchen recording what it just
 * made should end up `done` immediately (see setProductionState below),
 * not sitting in a draft/confirmed state waiting on someone.
 */
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
