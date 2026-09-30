import { useOperatorStore } from '../../store/operatorStore'

export function TopBar({ onOpenSettings }) {
  const employee = useOperatorStore((s) => s.employee)
  const signOut = useOperatorStore((s) => s.signOut)

  return (
    <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm">
      <p className="text-sm font-bold text-gray-900">Kitchen Production Session</p>
      <div className="flex items-center gap-3">
        {employee && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>
              Signed in as <span className="font-medium text-gray-700">{employee.name}</span>
            </span>
            <button type="button" onClick={signOut} className="font-medium text-brand underline">
              Switch
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Device Settings"
          title="Device Settings"
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          ⚙
        </button>
      </div>
    </div>
  )
}
