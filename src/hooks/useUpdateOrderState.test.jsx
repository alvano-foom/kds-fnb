import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '../test/server'
import { useUpdateOrderState } from './useUpdateLineState'
import { orderLinesQueryKey } from './useOrderLines'

function setup(initial) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  client.setQueryData(orderLinesQueryKey('c1'), initial)
  const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, ...renderHook(() => useUpdateOrderState('c1'), { wrapper }) }
}

const cards = [
  { id: 'l1', order_id: 'o1', kitchen_state: 'pending' },
  { id: 'l2', order_id: 'o1', kitchen_state: 'cooking' },
]

describe('useUpdateOrderState', () => {
  it('steps each line through its states and moves them all', async () => {
    const calls = []
    server.use(
      http.patch('*/api/order-lines/:id/state', async ({ request, params }) => {
        const { kitchen_state } = await request.json()
        calls.push(`${params.id}:${kitchen_state}`)
        return HttpResponse.json({ id: params.id, kitchen_state })
      }),
      http.get('*/api/order-lines', () => HttpResponse.json([])),
    )
    const { result } = setup(cards)

    await act(async () => {
      await result.current.mutateAsync({
        moves: [
          { lineId: 'l1', steps: ['cooking', 'ready'] },
          { lineId: 'l2', steps: ['ready'] },
        ],
      })
    })

    expect(calls.filter((c) => c.startsWith('l1:'))).toEqual(['l1:cooking', 'l1:ready']) // in order
    expect(calls).toContain('l2:ready')
  })

  it('rolls the whole drop back when the API refuses any one line', async () => {
    server.use(
      http.patch('*/api/order-lines/:id/state', ({ params }) =>
        params.id === 'l2'
          ? HttpResponse.json({ error: 'invalid_transition', message: 'No.' }, { status: 409 })
          : HttpResponse.json({ id: params.id }),
      ),
      http.get('*/api/order-lines', () => HttpResponse.json(cards)),
    )
    const { result, client } = setup(cards)

    await act(async () => {
      await result.current.mutateAsync({ moves: [{ lineId: 'l1', steps: ['cooking'] }, { lineId: 'l2', steps: ['pending'] }] }).catch(() => {})
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(client.getQueryData(orderLinesQueryKey('c1')).map((c) => c.kitchen_state)).toEqual(['pending', 'cooking'])
  })
})
