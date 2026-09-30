import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listStockProducts } from '../../api/stock'
import { useConfigStore } from '../../store/configStore'
import { Input } from '../atoms/Input'

/**
 * The real API has no name-search endpoint — GET /stock returns up to 200
 * kitchen-category products in one shot, so this fetches it once (cached
 * by react-query) and filters client-side. That also means availability
 * comes along for free, which is worth surfacing: it's a genuinely useful
 * signal for someone about to start cooking something.
 */
export function ProductPicker({ selected, onSelect }) {
  const companyId = useConfigStore((s) => s.companyId)
  const [term, setTerm] = useState('')

  const { data: products, isLoading } = useQuery({
    queryKey: ['stock-products', companyId],
    queryFn: () => listStockProducts({ companyId, kitchenOnly: true }),
    enabled: Boolean(companyId),
    staleTime: 60_000,
  })

  const results = useMemo(() => {
    if (!products || !term.trim()) return []
    const q = term.trim().toLowerCase()
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8)
  }, [products, term])

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-gray-700">{selected.name}</p>
          <p className="text-xs text-gray-400">
            {selected.uom}
            {selected.available_qty != null && ` · ${selected.available_qty} available`}
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
        placeholder={isLoading ? 'Loading products…' : 'Search product to manufacture…'}
        aria-label="Product to manufacture"
        disabled={isLoading}
      />
      {term && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
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
                <span className={`text-xs ${p.is_available ? 'text-gray-400' : 'text-amber-600'}`}>
                  {p.available_qty != null ? `${p.available_qty} avail.` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {term && !isLoading && results.length === 0 && (
        <p className="mt-1 text-xs text-gray-400">No products match "{term}".</p>
      )}
    </div>
  )
}
