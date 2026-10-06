import { useMemo, useState } from 'react'
import { useKitchenStock } from '../../hooks/useStock'
import { Input } from '../atoms/Input'

/**
 * Search-as-you-type over the kitchen's own product list (GET /stock —
 * there's no separate text-search endpoint, so filtering happens
 * client-side over what's already fetched). Showing `available_qty` next
 * to each option is the point: it lets someone avoid starting a
 * Manufacturing Order that's obviously going to run short, before they've
 * even submitted it.
 *
 * Every product stays selectable, including ones with 0 on hand: this is the
 * list of things to *make*, so a finished good with nothing in stock is the
 * normal case, not a reason to block it. (Earlier versions greyed those out
 * from `is_available`, which made every prep item un-pickable.) Whether the
 * product can actually be made is decided by the BoM step that follows.
 */
export function KitchenProductPicker({ selected, onSelect }) {
  const [term, setTerm] = useState('')
  const stock = useKitchenStock()

  const results = useMemo(() => {
    const products = stock.data?.products || []
    if (!term.trim()) return products
    const q = term.trim().toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [stock.data, term])

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-gray-700">{selected.name}</p>
          <p className="text-xs text-gray-400">
            {selected.uom}
            {selected.available_qty != null ? ` · ${selected.available_qty} available` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-xs font-medium text-gray-400 underline hover:text-gray-600"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search product to manufacture…"
        aria-label="Product to manufacture"
      />
      {stock.isLoading && <p className="mt-1 text-xs text-gray-400">Loading products…</p>}
      {!stock.isLoading && (
        <ul className="mt-1 max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          {results.length === 0 && <li className="px-3 py-2 text-xs text-gray-400">No products match.</li>}
          {results.map((p) => (
            <li key={p.product_id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p)
                  setTerm('')
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span>{p.name}</span>
                <span className="text-xs text-gray-400">
                  {p.available_qty != null ? `${p.available_qty} ${p.uom} on hand` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
