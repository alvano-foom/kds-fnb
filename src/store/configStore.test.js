import { describe, expect, test } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useConfigStore, useIsConfigured } from './configStore'

describe('configStore', () => {
  test('is not configured until apiBaseUrl, apiKey, and companyId are all set', () => {
    useConfigStore.setState({ apiBaseUrl: '', apiKey: '', companyId: '' })
    const { result, rerender } = renderHook(() => useIsConfigured())
    expect(result.current).toBe(false)

    useConfigStore.getState().setConfig({ apiBaseUrl: '/api/kds', apiKey: 'k', companyId: '1' })
    rerender()
    expect(result.current).toBe(true)
  })
})
