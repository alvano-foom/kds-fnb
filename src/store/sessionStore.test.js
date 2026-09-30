import { describe, expect, test } from 'vitest'
import { useSessionStore, useIsSessionOpen } from './sessionStore'
import { renderHook } from '@testing-library/react'

describe('sessionStore', () => {
  test('starts with no session', () => {
    expect(useSessionStore.getState().session).toBeNull()
  })

  test('setSession stores session/employee/company and resets warehouseId', () => {
    useSessionStore.getState().setWarehouseId('w9') // stray value from a previous session
    useSessionStore.getState().setSession({
      session: { id: 's1', status: 'open' },
      employee: { id: 'e1', name: 'Bisma Fauzan' },
      company: { id: 'c1', name: 'PT KOLABORASI INOVASI BERSAMA' },
    })
    const state = useSessionStore.getState()
    expect(state.session.id).toBe('s1')
    expect(state.employee.name).toBe('Bisma Fauzan')
    expect(state.warehouseId).toBeNull()
  })

  test('useIsSessionOpen reflects session.status', () => {
    useSessionStore.setState({ session: { id: 's1', status: 'open' } })
    const { result, rerender } = renderHook(() => useIsSessionOpen())
    expect(result.current).toBe(true)

    useSessionStore.getState().markClosed()
    rerender()
    expect(result.current).toBe(false)
  })
})
