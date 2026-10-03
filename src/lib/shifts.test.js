import { describe, expect, it } from 'vitest'
import { findCurrentShift, formatShiftWindow, normalizeAttendanceShift, pickInitialShift } from './shifts'

const pagi = { id: 's1', name: 'Pagi', start_time: '08:00', end_time: '17:00', crosses_midnight: false }
const malam = { id: 's3', name: 'Malam', start_time: '22:00', end_time: '06:00', crosses_midnight: true }
const at = (h, m = 0) => new Date(2026, 9, 3, h, m)

describe('formatShiftWindow', () => {
  it('formats a normal and an overnight shift', () => {
    expect(formatShiftWindow(pagi)).toBe('08:00–17:00')
    expect(formatShiftWindow(malam)).toBe('22:00–06:00 (+1)')
  })
})

describe('findCurrentShift', () => {
  it('matches inside the window, not at the end boundary', () => {
    expect(findCurrentShift([pagi, malam], at(8))?.id).toBe('s1')
    expect(findCurrentShift([pagi, malam], at(16, 59))?.id).toBe('s1')
    expect(findCurrentShift([pagi, malam], at(17))).toBeNull()
  })
  it('handles overnight shifts on both sides of midnight', () => {
    expect(findCurrentShift([pagi, malam], at(23, 30))?.id).toBe('s3')
    expect(findCurrentShift([pagi, malam], at(2))?.id).toBe('s3')
    expect(findCurrentShift([pagi, malam], at(6))).toBeNull()
  })
  it('returns null for no shifts', () => {
    expect(findCurrentShift([], at(9))).toBeNull()
  })
})

describe('pickInitialShift', () => {
  const siang = { id: 's2', name: 'Siang', start_time: '14:00', end_time: '22:00', crosses_midnight: false }
  it('prefers the shift running now, then the default, then nothing', () => {
    expect(pickInitialShift([pagi, { ...siang, is_default: true }], at(10))?.id).toBe('s1')
    expect(pickInitialShift([pagi, { ...siang, is_default: true }], at(23))?.id).toBe('s2')
    expect(pickInitialShift([pagi, siang], at(23))).toBeNull()
  })
})

describe('normalizeAttendanceShift', () => {
  it('maps the attendance API shape and sorts tasks by sequence', () => {
    const shift = normalizeAttendanceShift({
      id: 3, name: 'Pagi', code: 'P1', time_from: '08:00', time_to: '17:00', is_overnight: false, duration_hours: 9, is_default: true,
      tasks: [
        { id: 12, sequence: 2, name: 'B', description: '' },
        { id: 11, sequence: 1, name: 'A', description: 'hint' },
      ],
    })
    expect(shift).toMatchObject({ id: '3', start_time: '08:00', end_time: '17:00', crosses_midnight: false, is_default: true })
    expect(shift.tasks).toEqual([
      { id: '11', sequence: 1, name: 'A', description: 'hint' },
      { id: '12', sequence: 2, name: 'B', description: undefined },
    ])
  })
  it('tolerates a shift without tasks', () => {
    expect(normalizeAttendanceShift({ id: 1, name: 'X', time_from: '01:00', time_to: '02:00' }).tasks).toEqual([])
  })
})
