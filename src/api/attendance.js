import { normalizeAttendanceShift } from '@/lib/shifts'

/**
 * foom_attendance public API: separate from the KDS API, all POST, token in the body.
 * Base URL: VITE_ATTENDANCE_API_URL, else the KDS API's host + /foom/attendance/api.
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
 * Active shifts (with tasks) of the token's company, normalised to the app shape.
 * @returns {Promise<{timezone: string, shifts: import('@/lib/shifts').Shift[]}>}
 */
export async function listAttendanceShifts({ token }) {
  const data = await attendancePost('/shifts', { token })
  return { timezone: data.timezone, shifts: (data.shifts ?? []).map(normalizeAttendanceShift) }
}
