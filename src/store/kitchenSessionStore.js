import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Persisted across reloads; useKitchenSessionDetail clears it when the server disagrees.
 * `employee` is whoever identified last on this kiosk, with their Attendance Code (`code`),
 * which the API never echoes back but needs on every kitchen action.
 */
export const useKitchenSessionStore = create(
  persist(
    (set) => ({
      session: null, // { id, name, state, shift, warehouse_id, opened_by, opened_at, ... }
      employee: null, // { id, name, job_title, department, code }
      companyId: null, // captured at open/resume time — not necessarily echoed by the API response

      setSession: ({ session, employee, companyId }) => set({ session, employee, companyId }),
      clear: () => set({ session: null, employee: null, companyId: null }),
    }),
    { name: 'kds_kitchen_session' },
  ),
)

export function useIsKitchenSessionOpen() {
  return useKitchenSessionStore((s) => s.session?.state === 'open')
}
