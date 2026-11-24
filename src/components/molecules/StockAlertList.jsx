const TONES = {
  insufficient: 'border-red-200 bg-red-50 text-red-800',
  out: 'border-orange-200 bg-orange-50 text-orange-800',
  low: 'border-amber-200 bg-amber-50 text-amber-800',
}

const LABELS = { insufficient: 'Not enough', out: 'Last portion', low: 'Low stock' }

/** @param {{alerts: import('@/lib/stockCheck').BoardStockAlert[]}} props */
export function StockAlertList({ alerts }) {
  return (
    <ul className="space-y-1.5" aria-label="Stock alerts">
      {alerts.map((alert) => (
        <li
          key={alert.key}
          className={`flex flex-wrap items-baseline gap-x-2 rounded-lg border px-3 py-1.5 text-sm ${TONES[alert.level]}`}
        >
          <span className="text-xs font-semibold uppercase tracking-wide">{LABELS[alert.level]}</span>
          <span>{alert.message}</span>
          <span className="text-xs opacity-75">{alert.orders.join(', ')}</span>
        </li>
      ))}
    </ul>
  )
}
