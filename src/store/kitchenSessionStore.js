import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Persisted so a kiosk reload doesn't lose an open session — same
 * reasoning as tenantStore. The server (GET /kitchen/sessions/:id) stays
 * the source of truth for whether it's *actually* still open; see
 * useKitchenSessionDetail, which is what clears this on a stale reload
 * (someone else closed it, or the company selected in Settings changed).
 *
 * `employee` here is "whoever most recently identified themselves at
 * this kiosk" — it includes the Kode Absensi they typed (`code`), which
 * the API needs resent on every kitchen action, since neither
 * /kitchen/whoami nor /kitchen/sessions echoes it back. It is NOT
 * necessarily the same person who opened the shared kitchen session
 * (see "Switch operator" in KitchenSessionBadge) — one kitchen session
 * covers a whole shift, potentially several people using the same kiosk.
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
