import { useShiftChecklist } from '../../hooks/useShiftChecklist'
import { checklistProgress } from '../../lib/bom'
import { ShiftTaskList } from '../molecules/ShiftTaskList'
import { Spinner } from '../atoms/Spinner'

/**
 * "What do I actually have to do this shift?" — the tasks Odoo defines for
 * the shift the kitchen was opened with, as a tickable reminder. Lives on
 * its own page (/shift-checklist), separate from Production. Ticks are a
 * reminder only: stored on this tablet per kitchen session, never sent to
 * the backend.
 */
export function ShiftChecklistPanel() {
  const { shift, shiftName, tasks, doneIds, doneCount, isLoading, toggle } = useShiftChecklist()

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-6 w-6 text-brand" />
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <section aria-label="Shift checklist" className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-gray-700">No tasks for this shift.</p>
        <p className="mt-1 text-xs text-gray-400">
          {shiftName
            ? `Nothing is set up for ${shiftName} in Odoo yet.`
            : 'This kitchen was opened without a shift, so there is no checklist.'}
        </p>
      </section>
    )
  }

  const progress = checklistProgress(tasks.length, doneCount)

  return (
    <section aria-label="Shift checklist" className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Shift checklist · {shift.name}</p>
        <p className="text-xs text-gray-400">
          {progress.done} of {progress.total} done
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Shift tasks done"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="h-1.5 overflow-hidden rounded-full bg-gray-100"
      >
        <div className="h-full bg-brand transition-all" style={{ width: `${progress.percent}%` }} />
      </div>
      <ShiftTaskList tasks={tasks} doneIds={doneIds} onToggle={toggle} />
    </section>
  )
}
