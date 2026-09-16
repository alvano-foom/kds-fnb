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
