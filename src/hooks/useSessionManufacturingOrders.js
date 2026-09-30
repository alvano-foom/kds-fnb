import { useQuery } from '@tanstack/react-query'
import { listManufacturingOrders } from '../api/manufacturingOrders'
import { useSessionStore } from '../store/sessionStore'

export function useSessionManufacturingOrders() {
  const session = useSessionStore((s) => s.session)
  return useQuery({
    queryKey: ['manufacturing-orders', session?.id],
    queryFn: () => listManufacturingOrders({ sessionId: session.id }),
    enabled: Boolean(session?.id),
  })
}
