import { describe, expect, it } from 'vitest'
import { findCurrentShift, formatShiftWindow } from './shifts'

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
