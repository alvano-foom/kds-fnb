import { useNavigate } from 'react-router-dom'
import { useShiftChecklist } from '../../hooks/useShiftChecklist'
import { Button } from '../atoms/Button'

/** Header button to the shift checklist page, with "done/total" so unfinished tasks are visible from anywhere. Hidden when the shift has no tasks. */
export function ShiftChecklistLink() {
  const navigate = useNavigate()
  const { tasks, doneCount } = useShiftChecklist()
  if (tasks.length === 0) return null
  return (
    <Button variant="ghost" onClick={() => navigate('/shift-checklist')}>
      Shift Checklist <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">{doneCount}/{tasks.length}</span>
    </Button>
  )
}
