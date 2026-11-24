import { useOrderStockCheck } from '@/hooks/useOrderStockCheck'
import { StockAlertList } from '@/components/molecules/StockAlertList'

/** Non-blocking stock warnings for the orders still waiting to be cooked. */
export function OrderStockAlerts({ companyId, cards }) {
  const { alerts } = useOrderStockCheck(companyId, cards)
  if (!alerts.length) return null
  return (
    <section className="mb-4 max-h-40 overflow-y-auto">
      <StockAlertList alerts={alerts} />
    </section>
  )
}
