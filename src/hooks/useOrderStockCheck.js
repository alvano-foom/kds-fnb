import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { checkStock } from '@/api/stock'
import { mergeStockAlerts, pendingOrderBaskets } from '@/lib/stockCheck'
import { useKitchenSessionStore } from '@/store/kitchenSessionStore'

/** Runs /stock/check for every order that still has pending lines; returns the merged alerts. */
export function useOrderStockCheck(companyId, cards) {
  const warehouseId = useKitchenSessionStore((s) => s.session?.warehouse_id)
  const baskets = useMemo(() => pendingOrderBaskets(cards ?? []), [cards])

  const results = useQueries({
    queries: baskets.map((basket) => ({
      queryKey: ['stock-check', companyId, warehouseId, basket.orderId, basket.lines],
      queryFn: () => checkStock({ companyId, warehouseId, lines: basket.lines }),
      enabled: Boolean(companyId),
      staleTime: 30_000,
      retry: false,
    })),
  })

  const alerts = mergeStockAlerts(
    baskets
      .map((basket, i) => ({ orderName: basket.orderName, result: results[i]?.data }))
      .filter((check) => check.result),
  )

  return { alerts, isError: results.some((r) => r.isError) }
}
