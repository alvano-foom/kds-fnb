import { apiFetch } from './client'

/** Opens a kitchen session by validating a Kode Absensi (foom_att_code). */
export function openSession(code) {
  return apiFetch('/kitchen/sessions', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

export function getSession(sessionId) {
  return apiFetch(`/kitchen/sessions/${sessionId}`)
}

/**
 * @param {string} sessionId
 * @param {{manufacturing_order_id: string, qty: number, reason?: string}[]} [scraps]
 *   Only the manufacturing orders still missing a scrap entry need to be
 *   included — see api/mocks/handlers.js for the exact rule.
 */
export function closeSession(sessionId, scraps = []) {
  return apiFetch(`/kitchen/sessions/${sessionId}/close`, {
    method: 'POST',
    body: JSON.stringify({ scraps }),
  })
}
