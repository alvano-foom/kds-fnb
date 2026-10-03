import { useKitchenSessionStore } from '../store/kitchenSessionStore'
import { useDoneTaskIds, useShiftChecklistStore } from '../store/shiftChecklistStore'

/**
 * The open kitchen session's shift (the snapshot saved when it was picked —
 * see shiftChecklistStore), its reminder tasks, and which are ticked.
 * `tasks` is empty when the kitchen was opened with a free-text shift, the
 * shift has no tasks, or this tablet never learned the shift (e.g. someone
 * continued a session opened elsewhere without entering a PIN).
 */
export function useShiftChecklist() {
  const session = useKitchenSessionStore((s) => s.session)
  const toggleStored = useShiftChecklistStore((s) => s.toggle)
  const shift = useShiftChecklistStore((s) => (s.sessionId === session?.id ? s.shift : null))
  const doneIds = useDoneTaskIds(session?.id)

  const tasks = shift?.tasks ?? []

  return {
    shift,
    shiftName: shift?.name ?? session?.shift ?? null,
    tasks,
    doneIds,
    doneCount: tasks.filter((t) => doneIds.includes(t.id)).length,
    isLoading: false,
    toggle: (taskId) => toggleStored(session.id, taskId),
  }
}
