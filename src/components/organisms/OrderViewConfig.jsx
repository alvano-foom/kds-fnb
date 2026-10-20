import { useOrderViewStore } from '../../store/orderViewStore'

/** Settings → Board & Tickets: what one board card / one printed ticket stands for. */
export function OrderViewConfig() {
  const perTransaction = useOrderViewStore((s) => s.perTransaction)
  const setPerTransaction = useOrderViewStore((s) => s.setPerTransaction)

  return (
    <div>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={perTransaction}
          onChange={(e) => setPerTransaction(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand/20"
        />
        <span className="text-sm font-medium text-gray-700">One card board per transaction</span>
      </label>
      <p className="mt-1 pl-6 text-xs text-gray-400">
        Print per transaction instead of per order line. 
      </p>
    </div>
  )
}
