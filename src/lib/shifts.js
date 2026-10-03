/**
 * @typedef {Object} Shift
 * @property {string} id
 * @property {string} name
 * @property {string} [code]
 * @property {string} start_time        "HH:MM" 24h, Odoo's Jam Masuk
 * @property {string} end_time          "HH:MM" 24h, Odoo's Jam Pulang
 * @property {boolean} crosses_midnight Odoo's Lintas Hari — end_time falls on the next day
 * @property {number} [duration_hours]
 * @property {boolean} [is_default]
 * @property {ShiftTask[]} tasks
 *
 * @typedef {Object} ShiftTask
 * @property {string} id
 * @property {number} sequence
 * @property {string} name
 * @property {string} [description]
 */

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Maps one shift from foom_attendance's POST /shifts (integer ids,
 * time_from / time_to, is_overnight) to the app's internal shape. Tasks are
 * sorted by `sequence` (the API already does, this just makes it a guarantee).
 */
export function normalizeAttendanceShift(raw) {
  return {
    id: String(raw.id),
    name: raw.name,
    code: raw.code || undefined,
    start_time: raw.time_from,
    end_time: raw.time_to,
    crosses_midnight: Boolean(raw.is_overnight),
    duration_hours: raw.duration_hours,
    is_default: Boolean(raw.is_default),
    tasks: (raw.tasks ?? [])
      .map((t) => ({ id: String(t.id), sequence: t.sequence ?? 0, name: t.name, description: t.description || undefined }))
      .sort((a, b) => a.sequence - b.sequence),
  }
}

/** "08:00–17:00" label for dropdowns/badges, with a "+1" marker when the shift runs past midnight. */
export function formatShiftWindow(shift) {
  return `${shift.start_time}–${shift.end_time}${shift.crosses_midnight ? ' (+1)' : ''}`
}

/**
 * The shift whose window contains `now` — used to pre-select the right
 * shift when someone opens the kitchen, so the common case is zero taps.
 * Handles overnight shifts (Lintas Hari): a 22:00–06:00 shift matches at
 * 23:30 and at 02:00. Returns the first match if windows overlap, or null
 * if none do (callers then just leave the selection empty).
 * @param {Shift[]} shifts
 * @param {Date} [now]
 * @returns {Shift | null}
 */
export function findCurrentShift(shifts, now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes()
  return (
    shifts.find((s) => {
      const start = toMinutes(s.start_time)
      const end = toMinutes(s.end_time)
      if (s.crosses_midnight || end <= start) return minutes >= start || minutes < end
      return minutes >= start && minutes < end
    }) || null
  )
}

/** What to pre-select in the picker: the shift running right now, else the employee's default shift, else nothing. */
export function pickInitialShift(shifts, now = new Date()) {
  return findCurrentShift(shifts, now) || shifts.find((s) => s.is_default) || null
}
