import { useSessionManufacturingOrders } from '../../hooks/useSessionManufacturingOrders'

export function ManufacturingOrderList() {
  const { data: orders, isLoading } = useSessionManufacturingOrders()

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>
  if (!orders || orders.length === 0) {
    return <p className="text-sm text-gray-400">No manufacturing orders created yet this session.</p>
  }

  return (
    <ul className="space-y-1.5">
      {orders.map((mo) => (
        <li
          key={mo.id}
          className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2"
        >
          <div>
            <p className="text-sm font-medium text-gray-700">
              {mo.name} — {mo.product_name}
            </p>
            <p className="text-xs text-gray-400">
              {mo.qty} {mo.uom} · {mo.state}
            </p>
          </div>
          {mo.scrap != null ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Scrap: {mo.scrap.qty}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              Scrap needed
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
