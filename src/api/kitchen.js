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
 * `shiftId` (foom.attendance.shift id, from listShifts below) is the
 * preferred way to say which shift this is; `shift` (free text) stays
 * accepted so a backend without the shift endpoint yet — or a company
 * with no shifts configured — still works exactly as before.
 */
export function openKitchenSession({ companyId, employeeCode, shift, shiftId }) {
  return apiFetch('/kitchen/sessions', {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, employee_code: employeeCode, shift, shift_id: shiftId }),
  })
}

/**
 * Shift master data from Odoo's foom.attendance.shift (Attendances →
 * Configuration → Shift). NOT in the foom_fnb_api docs yet — this is the
 * proposed contract, see docs/kitchen-shift-bom-api-contract.md.
 * @returns {Promise<{company_id: string, shifts: {id: string, name: string, code?: string, start_time: string, end_time: string, crosses_midnight: boolean, duration_hours?: number}[]}>}
 */
export function listShifts({ companyId } = {}) {
  const params = new URLSearchParams()
  if (companyId) params.set('company_id', companyId)
  return apiFetch(`/kitchen/shifts?${params.toString()}`)
}

/**
 * BOM preview for the pre-create checklist: the finished product's
 * default BoM and its components, quantities expressed per `output_qty`
 * of finished product (the caller scales them by the qty being made — see
 * src/lib/bom.js). NOT in the foom_fnb_api docs yet — proposed contract,
 * see docs/kitchen-shift-bom-api-contract.md. 409 `no_bom` when the
 * product has no Bill of Materials.
 * @returns {Promise<import('../lib/bom').BomPreview>}
 */
export function getBomPreview({ companyId, productId }) {
  const params = new URLSearchParams()
  if (companyId) params.set('company_id', companyId)
  params.set('product_id', productId)
  return apiFetch(`/kitchen/boms?${params.toString()}`)
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
