import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const EMPTY = {
  companyId: null,
  companyName: null,
  warehouseId: null,
  warehouseName: null,
  locationId: null,
  locationName: null,
}

/** Selected company, warehouse and stock location, one per device (a kitchen display is fixed to one outlet). */
export const useTenantStore = create(
  persist(
    (set) => ({
      ...EMPTY,

      setConfig: (config) => set(config),
      clearConfig: () => set(EMPTY),
    }),
    { name: 'kds_tenant_config' },
  ),
)

export function useIsTenantConfigured() {
  return useTenantStore((s) => Boolean(s.companyId && s.warehouseId && s.locationId))
}
