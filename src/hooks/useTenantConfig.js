import { useQuery } from '@tanstack/react-query'
import { getTenantConfig } from '../api/tenant'

/** Public branding (name/logo/color) for the header — same for every visitor of this tenant. */
export function useTenantConfig() {
  return useQuery({ queryKey: ['tenant-config'], queryFn: getTenantConfig, staleTime: Infinity })
}
