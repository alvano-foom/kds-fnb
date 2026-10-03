import { describe, expect, it } from 'vitest'
import { checklistProgress, consumedQty, isShort } from './bom'

describe('consumedQty', () => {
  it('scales a per-unit component to the requested qty', () => {
    expect(consumedQty({ qty: 200 }, 1, 10)).toBe(2000)
  })
  it('divides by the BoM output qty (BoM yields 2, make 6 → 3x)', () => {
    expect(consumedQty({ qty: 600 }, 2, 6)).toBe(1800)
  })
  it('rounds away float noise', () => {
    expect(consumedQty({ qty: 0.1 }, 1, 3)).toBe(0.3)
  })
  it('falls back to 1 when output_qty is missing or zero', () => {
    expect(consumedQty({ qty: 5 }, 0, 2)).toBe(10)
    expect(consumedQty({ qty: 5 }, undefined, 2)).toBe(10)
  })
})

describe('isShort', () => {
  it('is true only when consumption exceeds available', () => {
    expect(isShort({ qty: 150, available_qty: 450 }, 1, 3)).toBe(false)
    expect(isShort({ qty: 150, available_qty: 450 }, 1, 4)).toBe(true)
  })
  it('is false when availability is unknown', () => {
    expect(isShort({ qty: 150 }, 1, 100)).toBe(false)
  })
})

describe('checklistProgress', () => {
  it('computes percent', () => {
    expect(checklistProgress(4, 1)).toEqual({ done: 1, total: 4, percent: 25 })
    expect(checklistProgress(3, 3).percent).toBe(100)
  })
  it('treats an empty list as complete', () => {
    expect(checklistProgress(0, 0).percent).toBe(100)
  })
})
