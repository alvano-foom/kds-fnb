import { useKitchenSessionStore } from '@/store/kitchenSessionStore'
import { useDoneTaskIds, useShiftChecklistStore } from '@/store/shiftChecklistStore'

/** `tasks` is empty for a free-text shift or when this device never learned the shift (no PIN). */
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
