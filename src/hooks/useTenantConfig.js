import { useQuery } from '@tanstack/react-query'
import { getTenantConfig } from '@/api/tenant'

/** Outlet name and logo from the backend. */
export function useTenantConfig() {
  return useQuery({ queryKey: ['tenant-config'], queryFn: getTenantConfig, staleTime: Infinity })
}
