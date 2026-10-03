import { useKitchenSessionDetail, useSetProductionState } from '../../hooks/useKitchenSession'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'
import { Spinner } from '../atoms/Spinner'

const STATE_STYLES = {
  done: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
  confirmed: 'bg-amber-50 text-amber-800',
  in_progress: 'bg-amber-50 text-amber-800',
}

function scrapFor(session, productionId) {
  return (session.scraps || []).find((s) => s.production_id === productionId) || null
}

export function ProductionList() {
  const employee = useKitchenSessionStore((s) => s.employee)
  const { data: session, isLoading } = useKitchenSessionDetail()
  const setProductionState = useSetProductionState()

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="h-6 w-6 text-brand" />
      </div>
    )
  }
  if (!session || session.productions.length === 0) {
    return <p className="text-sm text-gray-400">No manufacturing orders / prep meals created yet this session.</p>
  }

  return (
    <ul className="space-y-1.5">
      {session.productions.map((mo) => {
        const needsAttention = !['done', 'cancelled'].includes(mo.state)
        const scrap = scrapFor(session, mo.id)
        return (
          <li key={mo.id} className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {mo.name} — {mo.product_name}
                </p>
                <p className="text-xs text-gray-400">
                  {mo.qty} {mo.uom} · requested by {mo.requested_by}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLES[mo.state] || 'bg-gray-100 text-gray-500'}`}>
                {mo.state.replace('_', ' ')}
              </span>
            </div>

            {mo.state === 'done' && (
              <p className="mt-1 text-xs">
                {scrap ? (
                  <span className="font-medium text-emerald-700">Scrap recorded: {scrap.qty}</span>
                ) : (
                  <span className="font-medium text-amber-700">Scrap needed before closing</span>
                )}
              </p>
            )}

            {needsAttention && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={setProductionState.isPending}
                  onClick={() =>
                    setProductionState.mutate({
                      productionId: mo.id,
                      employeeCode: employee.code,
                      action: 'done',
                      qty: mo.qty,
                    })
                  }
                  className="text-xs font-medium text-brand underline disabled:opacity-50"
                >
                  Retry — mark done
                </button>
                <button
                  type="button"
                  disabled={setProductionState.isPending}
                  onClick={() =>
                    setProductionState.mutate({ productionId: mo.id, employeeCode: employee.code, action: 'cancel' })
                  }
                  className="text-xs font-medium text-gray-400 underline hover:text-red-500 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
