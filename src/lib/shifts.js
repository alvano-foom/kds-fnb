/**
 * @typedef {Object} Shift
 * @property {string} id
 * @property {string} name
 * @property {string} [code]
 * @property {string} start_time        "HH:MM" 24h, Odoo's Jam Masuk
 * @property {string} end_time          "HH:MM" 24h, Odoo's Jam Pulang
 * @property {boolean} crosses_midnight Odoo's Lintas Hari — end_time falls on the next day
 * @property {number} [duration_hours]
 */

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + (m || 0)
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
