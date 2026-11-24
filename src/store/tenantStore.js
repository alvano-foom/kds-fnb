import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Selected company, one per device (a kitchen display is fixed to one outlet). */
export const useTenantStore = create(
  persist(
    (set) => ({
      companyId: null,
      companyName: null,

      setConfig: (config) => set(config),
      clearConfig: () => set({ companyId: null, companyName: null }),
    }),
    { name: 'kds_tenant_config' },
  ),
)
