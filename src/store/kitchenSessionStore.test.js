import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKitchenSessionStore, useIsKitchenSessionOpen } from './kitchenSessionStore'

describe('kitchenSessionStore', () => {
  it('starts empty', () => {
    expect(useKitchenSessionStore.getState().session).toBeNull()
  })

  it('setSession stores session/employee/companyId together', () => {
    useKitchenSessionStore.getState().setSession({
      session: { id: 'ks1', name: 'KIT/202609/0001', state: 'open' },
      employee: { id: 'e1', name: 'Bisma Fauzan', code: 'F102345' },
      companyId: 'c1',
    })
    const state = useKitchenSessionStore.getState()
    expect(state.session.id).toBe('ks1')
    expect(state.employee.code).toBe('F102345')
    expect(state.companyId).toBe('c1')
  })

  it('useIsKitchenSessionOpen reflects session.state', () => {
    useKitchenSessionStore.setState({ session: { id: 'ks1', state: 'open' } })
    const { result, rerender } = renderHook(() => useIsKitchenSessionOpen())
    expect(result.current).toBe(true)

    useKitchenSessionStore.getState().clear()
    rerender()
    expect(result.current).toBe(false)
  })
})
