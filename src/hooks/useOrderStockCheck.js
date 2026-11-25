import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { checkStock } from '@/api/stock'
import { mergeStockAlerts, pendingOrderBaskets } from '@/lib/stockCheck'
import { useTenantStore } from '@/store/tenantStore'

/**
 * Runs /stock/check for every order that still has pending lines; returns the merged alerts.
 * Stock is read from the warehouse and location chosen on /config.
 */
export function useOrderStockCheck(companyId, cards) {
  const warehouseId = useTenantStore((s) => s.warehouseId)
  const locationId = useTenantStore((s) => s.locationId)
  const baskets = useMemo(() => pendingOrderBaskets(cards ?? []), [cards])

  const results = useQueries({
    queries: baskets.map((basket) => ({
      queryKey: ['stock-check', companyId, warehouseId, locationId, basket.orderId, basket.lines],
      queryFn: () => checkStock({ companyId, warehouseId, locationId, lines: basket.lines }),
      enabled: Boolean(companyId && locationId),
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
