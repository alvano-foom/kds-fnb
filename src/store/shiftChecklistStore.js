import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Which of the shift's reminder tasks the operator has ticked off, for the
 * kitchen session currently open on this kiosk. Purely a reminder — never
 * sent to the backend — so it lives only here, persisted so a tablet
 * reload mid-shift doesn't wipe the ticks. Scoped by session id: a new
 * kitchen session (next shift) always starts with a clean list.
 */
export const useShiftChecklistStore = create(
  persist(
    (set) => ({
      sessionId: null,
      done: [], // task ids

      toggle: (sessionId, taskId) =>
        set((s) => {
          const base = s.sessionId === sessionId ? s.done : []
          const done = base.includes(taskId) ? base.filter((id) => id !== taskId) : [...base, taskId]
          return { sessionId, done }
        }),
      clear: () => set({ sessionId: null, done: [] }),
    }),
    { name: 'kds_shift_checklist' },
  ),
)

/** Ticked task ids for this session — empty if the stored ticks belong to another session. */
export function useDoneTaskIds(sessionId) {
  return useShiftChecklistStore((s) => (s.sessionId === sessionId ? s.done : EMPTY))
}
const EMPTY = []
