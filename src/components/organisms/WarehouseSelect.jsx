import { useQuery } from '@tanstack/react-query'
import { listWarehouses } from '../../api/warehouses'
import { useSessionStore } from '../../store/sessionStore'
import { Button } from '../atoms/Button'

/** One-time-per-session pick, done before any Manufacturing Order can be created. */
export function WarehouseSelect() {
  const company = useSessionStore((s) => s.company)
  const setWarehouseId = useSessionStore((s) => s.setWarehouseId)

  const { data: warehouses, isLoading, isError } = useQuery({
    queryKey: ['warehouses', company?.id],
    queryFn: () => listWarehouses(company.id),
    enabled: Boolean(company?.id),
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading warehouses…</p>
  if (isError) return <p className="text-sm text-amber-700">Could not load warehouses.</p>

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Choose a warehouse for this session</p>
      <div className="space-y-1.5">
        {(warehouses || []).map((w) => (
          <Button
            key={w.id}
            type="button"
            variant="secondary"
            className="w-full justify-between"
            onClick={() => setWarehouseId(w.id)}
          >
            <span>{w.name}</span>
            <span className="text-xs text-gray-400">{w.code}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
