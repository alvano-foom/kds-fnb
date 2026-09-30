import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Persisted so a kiosk tablet reload (or the browser being backgrounded
 * overnight) doesn't lose an open session — the source of truth for
 * whether it's *actually* still open still lives on the server; this is
 * just what lets the UI skip straight back to the working screen instead
 * of asking for the Kode Absensi again on every refresh.
 */
export const useSessionStore = create(
  persist(
    (set) => ({
      session: null, // { id, status, opened_at, closed_at? }
      employee: null, // { id, name }
      company: null, // { id, name }
      warehouseId: null,

      setSession: ({ session, employee, company }) => set({ session, employee, company, warehouseId: null }),
      setWarehouseId: (warehouseId) => set({ warehouseId }),
      markClosed: () => set({ session: null, employee: null, company: null, warehouseId: null }),
      /** Used when a GET on the resumed session comes back closed/gone from the server. */
      clear: () => set({ session: null, employee: null, company: null, warehouseId: null }),
    }),
    { name: 'kitchen_session' },
  ),
)

export function useIsSessionOpen() {
  return useSessionStore((s) => s.session?.status === 'open')
}
