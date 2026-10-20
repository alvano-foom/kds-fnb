import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateLineState } from '../api/orders'
import { orderLinesQueryKey } from './useOrderLines'

/** Optimistic drag-and-drop: move the card immediately, roll back on error. */
export function useUpdateLineState(companyId) {
  const queryClient = useQueryClient()
  const key = orderLinesQueryKey(companyId)

  return useMutation({
    mutationFn: ({ lineId, kitchenState }) => updateLineState(lineId, kitchenState),
    onMutate: async ({ lineId, kitchenState }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (cards = []) =>
        cards.map((c) => (c.id === lineId ? { ...c, kitchen_state: kitchenState } : c)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/**
 * Per-transaction board: dropping an order's card moves several lines at
 * once. `moves` comes from planOrderMove() — each line with the states to
 * step it through. Same optimistic move / roll back / refetch as above; if
 * any one line is refused, the whole drop is rolled back and the refetch
 * shows what the server really has.
 */
export function useUpdateOrderState(companyId) {
  const queryClient = useQueryClient()
  const key = orderLinesQueryKey(companyId)

  return useMutation({
    mutationFn: async ({ moves }) => {
      const results = await Promise.allSettled(
        moves.map(async ({ lineId, steps }) => {
          for (const step of steps) await updateLineState(lineId, step)
        }),
      )
      const failed = results.find((r) => r.status === 'rejected')
      if (failed) throw failed.reason
    },
    onMutate: async ({ moves }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      const finalState = new Map(moves.map((m) => [m.lineId, m.steps[m.steps.length - 1]]))
      queryClient.setQueryData(key, (cards = []) =>
        cards.map((c) => (finalState.has(c.id) ? { ...c, kitchen_state: finalState.get(c.id) } : c)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
