import { normalizeAttendanceShift } from '../lib/shifts'

/**
 * foom_attendance's public API — a different module and a different auth
 * scheme from foom_fnb_api's /api/kds: plain JSON (not JSON-RPC), every
 * endpoint is POST, and the employee's session token travels in the body
 * (never a header or URL). Token comes from POST /login with the employee's
 * Kode Absensi *and PIN*, lives 12h by default, and is only ever used here to
 * read the shift list — KDS itself keeps identifying people by Kode Absensi
 * alone (see api/kitchen.js).
 *
 * Base URL: VITE_ATTENDANCE_API_URL if set, otherwise the same Odoo host as
 * the KDS API + /foom/attendance/api.
 */
function attendanceBase() {
  const explicit = import.meta.env.VITE_ATTENDANCE_API_URL
  if (explicit) return explicit.replace(/\/$/, '')
  const kds = import.meta.env.VITE_API_BASE_URL ?? '/api'
  if (/^https?:\/\//.test(kds)) return `${new URL(kds).origin}/foom/attendance/api`
  return '/foom/attendance/api'
}

export class AttendanceError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function attendancePost(path, body) {
  let res
  try {
    res = await fetch(`${attendanceBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AttendanceError(0, 'network_error', 'Could not reach the attendance service (network error or blocked by CORS)')
  }
  const data = await res.json().catch(() => null)
  // Errors look like {ok:false, error, message}; `disabled` even comes back as HTTP 200 — branch on `ok`, not status.
  if (!data || data.ok === false) {
    throw new AttendanceError(res.status, data?.error ?? 'unknown', data?.message ?? res.statusText ?? 'Attendance request failed.')
  }
  return data
}

/** @returns {Promise<{token: string, expire_at: string, employee: {name: string, code: string}}>} */
export function attendanceLogin({ code, pin }) {
  return attendancePost('/login', { code, pin })
}

/**
 * All active shifts of the token's employee's company, each with its task
 * list, normalised to the app's internal shape (string ids, start_time /
 * end_time / crosses_midnight).
 * @returns {Promise<{timezone: string, shifts: import('../lib/shifts').Shift[]}>}
 */
export async function listAttendanceShifts({ token }) {
  const data = await attendancePost('/shifts', { token })
  return { timezone: data.timezone, shifts: (data.shifts ?? []).map(normalizeAttendanceShift) }
}
