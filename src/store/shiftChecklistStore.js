import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * The shift this kitchen session was opened with (a snapshot of what the
 * attendance API returned — name, window, tasks) and which of its reminder
 * tasks the operator has ticked off. Purely a reminder: never sent to the
 * backend, kept here (persisted, so a tablet reload mid-shift doesn't wipe
 * it) and scoped by kitchen session id — the next session starts clean.
 *
 * The snapshot exists because the shift list needs the employee's PIN to
 * fetch (see api/attendance.js); the checklist page can't re-fetch it on
 * every visit, so the gate stores the shift the operator picked.
 */
export const useShiftChecklistStore = create(
  persist(
    (set) => ({
      sessionId: null,
      shift: null, // { id, name, start_time, end_time, crosses_midnight, tasks: [...] }
      done: [], // task ids

      /** Remember which shift this session is on. Keeps existing ticks if it's the same session (e.g. someone continues it on this tablet). */
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
