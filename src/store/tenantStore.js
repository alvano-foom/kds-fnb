import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Selected company. A kitchen display is normally one device fixed to one
 * outlet, so a single persisted slot (not one-per-user) is the right
 * amount of complexity here — ponytail: add per-user namespacing only if
 * a shared device switching between logins turns out to matter.
 */
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
