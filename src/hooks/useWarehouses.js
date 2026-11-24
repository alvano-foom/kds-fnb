import { useQuery } from '@tanstack/react-query'
import { listLocations, listWarehouses } from '@/api/wms'

export function useWarehouses(companyId) {
  return useQuery({
    queryKey: ['wms-warehouses', companyId],
    queryFn: () => listWarehouses(companyId),
    enabled: Boolean(companyId),
    staleTime: 5 * 60_000,
  })
}

export function useLocations(companyId, warehouseId) {
  return useQuery({
    queryKey: ['wms-locations', companyId, warehouseId],
    queryFn: () => listLocations(companyId, warehouseId),
    enabled: Boolean(companyId && warehouseId),
    staleTime: 5 * 60_000,
  })
}
