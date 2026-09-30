import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * "Signed in as" — the employee whose Kode Absensi was last validated via
 * POST /kitchen/whoami on THIS device. This is deliberately separate from
 * the kitchen session itself (see api/kitchen.js): the kitchen can already
 * be open (opened by a co-worker's shift) while a different employee signs
 * in here just to create a production or close it — every action call
 * carries whichever employee_code is currently signed in, not necessarily
 * the one who opened the session.
 *
 * Persisted so re-opening the kiosk app doesn't force re-entering the code
 * immediately — "Switch operator" (in the top bar) clears it on demand.
 */
export const useOperatorStore = create(
  persist(
    (set) => ({
      employeeCode: null,
      employee: null, // { id, name, job_title, department }

      setOperator: ({ employeeCode, employee }) => set({ employeeCode, employee }),
      signOut: () => set({ employeeCode: null, employee: null }),
    }),
    { name: 'kitchen_operator' },
  ),
)
