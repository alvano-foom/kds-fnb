import { useQuery } from '@tanstack/react-query'
import { getOrderLines } from '../api/orders'

export function orderLinesQueryKey(companyId) {
  return ['order-lines', companyId]
}

/** @param {boolean} [options.polling] switch on when the WS connection is down */
export function useOrderLines(companyId, { polling = false } = {}) {
  return useQuery({
    queryKey: orderLinesQueryKey(companyId),
    queryFn: () => getOrderLines({ companyId }),
    enabled: Boolean(companyId),
    refetchInterval: polling ? 5000 : false,
  })
}
