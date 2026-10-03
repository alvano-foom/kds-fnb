import { describe, expect, it } from 'vitest'
import { useShiftChecklistStore } from './shiftChecklistStore'

describe('shiftChecklistStore', () => {
  it('toggles a task on and off', () => {
    const { toggle } = useShiftChecklistStore.getState()
    toggle('ks1', 't1')
    expect(useShiftChecklistStore.getState().done).toEqual(['t1'])
    toggle('ks1', 't1')
    expect(useShiftChecklistStore.getState().done).toEqual([])
  })

  it('starts a clean list when the session changes', () => {
    const { toggle } = useShiftChecklistStore.getState()
    toggle('ks1', 't1')
    toggle('ks2', 't2')
    const s = useShiftChecklistStore.getState()
    expect(s.sessionId).toBe('ks2')
    expect(s.done).toEqual(['t2'])
  })
})
