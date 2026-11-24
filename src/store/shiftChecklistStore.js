import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Snapshot of the session's shift plus ticked task ids, scoped by session id.
 * Stored because re-fetching shifts needs the employee's PIN. Never sent to the backend.
 */
export const useShiftChecklistStore = create(
  persist(
    (set) => ({
      sessionId: null,
      shift: null, // { id, name, start_time, end_time, crosses_midnight, tasks: [...] }
      done: [], // task ids

      /** Keeps existing ticks when it is the same session. */
      setShift: (sessionId, shift) =>
        set((s) => (s.sessionId === sessionId ? { shift } : { sessionId, shift, done: [] })),

      toggle: (sessionId, taskId) =>
        set((s) => {
          const same = s.sessionId === sessionId
          const base = same ? s.done : []
          const done = base.includes(taskId) ? base.filter((id) => id !== taskId) : [...base, taskId]
          return { sessionId, shift: same ? s.shift : null, done }
        }),
      clear: () => set({ sessionId: null, shift: null, done: [] }),
    }),
    { name: 'kds_shift_checklist' },
  ),
)

const EMPTY = []

/** Ticked task ids for this session — empty if the stored ticks belong to another session. */
export function useDoneTaskIds(sessionId) {
  return useShiftChecklistStore((s) => (s.sessionId === sessionId ? s.done : EMPTY))
}
