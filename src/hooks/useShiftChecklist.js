import { useShifts } from './useKitchenSession'
import { useKitchenSessionStore } from '../store/kitchenSessionStore'
import { useDoneTaskIds, useShiftChecklistStore } from '../store/shiftChecklistStore'

/**
 * The open kitchen session's shift (looked up by `shift_id` in the shifts
 * Odoo sends), its reminder tasks, and which of them are ticked. `tasks` is
 * empty when the kitchen was opened with a free-text shift, the shift has no
 * tasks, or the shift endpoint isn't available.
 */
export function useShiftChecklist() {
  const session = useKitchenSessionStore((s) => s.session)
  const shifts = useShifts()
  const toggleStored = useShiftChecklistStore((s) => s.toggle)
  const doneIds = useDoneTaskIds(session?.id)

  const shift = session?.shift_id ? (shifts.data ?? []).find((s) => s.id === session.shift_id) ?? null : null
  const tasks = shift?.tasks ?? []

  return {
    shift,
    shiftName: shift?.name ?? session?.shift ?? null,
    tasks,
    doneIds,
    doneCount: tasks.filter((t) => doneIds.includes(t.id)).length,
    isLoading: Boolean(session?.shift_id) && shifts.isLoading,
    toggle: (taskId) => toggleStored(session.id, taskId),
  }
}
