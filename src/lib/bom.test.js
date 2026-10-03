import { describe, expect, it } from 'vitest'
import { checklistProgress } from './bom'

describe('checklistProgress', () => {
  it('computes percent', () => {
    expect(checklistProgress(4, 1)).toEqual({ done: 1, total: 4, percent: 25 })
    expect(checklistProgress(3, 3).percent).toBe(100)
  })
  it('treats an empty list as complete', () => {
    expect(checklistProgress(0, 0).percent).toBe(100)
  })
})
