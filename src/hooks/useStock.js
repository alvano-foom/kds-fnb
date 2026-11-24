import { useQuery } from '@tanstack/react-query'
import { getStock } from '@/api/stock'
import { useTenantStore } from '@/store/tenantStore'

/** Kitchen-category products with live availability, for the production form's picker. */
export function useKitchenStock() {
  const companyId = useTenantStore((s) => s.companyId)
  return useQuery({
    queryKey: ['stock', companyId, 'kitchen'],
    queryFn: () => getStock({ companyId }),
    enabled: Boolean(companyId),
    staleTime: 30_000,
  })
}
