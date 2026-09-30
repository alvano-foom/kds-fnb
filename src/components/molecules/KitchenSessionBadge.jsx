import { useNavigate } from 'react-router-dom'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'

/** Shown in the header on Board/Production — who's attributed to actions right now, and an escape hatch to switch. */
export function KitchenSessionBadge() {
  const navigate = useNavigate()
  const session = useKitchenSessionStore((s) => s.session)
  const employee = useKitchenSessionStore((s) => s.employee)

  if (!session) return null

  return (
    <div className="flex items-center gap-2 text-sm text-brand-contrast/80">
      <span className="truncate">
        {session.name}
        {session.shift ? ` · ${session.shift}` : ''} · {employee?.name}
      </span>
      <button
        type="button"
        onClick={() => navigate('/kitchen-session')}
        className="shrink-0 text-xs font-medium underline decoration-brand-contrast/40 hover:decoration-brand-contrast"
      >
        Switch operator
      </button>
    </div>
  )
}
