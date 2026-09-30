import { Button } from '../atoms/Button'

export function KitchenStatusCard({ session, showCloseButton, onCloseClick }) {
  const openedAt = new Date(session.opened_at)
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-semibold text-gray-900">
          {session.name} <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Open</span>
        </p>
        <p className="text-xs text-gray-400">
          Opened by {session.opened_by?.name} at {openedAt.toLocaleTimeString()}
          {session.shift ? ` · ${session.shift}` : ''}
        </p>
      </div>
      {showCloseButton && (
        <Button type="button" variant="secondary" onClick={onCloseClick}>
          Close Kitchen
        </Button>
      )}
    </div>
  )
}
