import { useMemo, useState } from 'react'
import { useKitchenSessionDetail, useCloseKitchenSession } from '../../hooks/useKitchenSession'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'

/**
 * Client-side policy (decided with the user, not enforced by the real
 * backend): every manufacturing order made this session needs a scrap
 * quantity before this button will let you close — an explicit 0 counts
 * as answered. The backend's own rule is narrower: it only blocks on
 * productions still stuck in a non-final state (`pending_productions`),
 * which `cancelPending`/`force` below can override when needed.
 */
export function CloseKitchenSessionPanel({ onCancel, onClosed }) {
  const employee = useKitchenSessionStore((s) => s.employee)
  const { data: session, isLoading } = useKitchenSessionDetail()
  const closeSession = useCloseKitchenSession()
  const [entries, setEntries] = useState({}) // { [productionId]: { qty, reason } }
  const [cancelPending, setCancelPending] = useState(false)
  const [force, setForce] = useState(false)

  const pending = useMemo(
    () => (session?.productions || []).filter((p) => !['done', 'cancelled'].includes(p.state)),
    [session],
  )
  const doneWithoutScrap = useMemo(() => {
    if (!session) return []
    const scrapped = new Set((session.scraps || []).map((s) => s.production_id))
    return session.productions.filter((p) => p.state === 'done' && !scrapped.has(p.id))
  }, [session])

  function setEntry(id, patch) {
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const scrapReady = doneWithoutScrap.every((mo) => entries[mo.id]?.qty !== undefined && entries[mo.id]?.qty !== '')
  const canSubmit = scrapReady && (pending.length === 0 || cancelPending || force)

  function handleSubmit() {
    const scraps = doneWithoutScrap.map((mo) => ({
      product_id: mo.product_id,
      production_id: mo.id,
      qty: Number(entries[mo.id]?.qty ?? 0),
      reason: entries[mo.id]?.reason || '',
    }))
    closeSession.mutate(
      { employeeCode: employee.code, scraps, cancelPending, force },
      { onSuccess: onClosed },
    )
  }

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">Close Kitchen Session</p>

      {pending.length > 0 && (
        <div className="space-y-2 rounded-lg bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            {pending.length} manufacturing order{pending.length > 1 ? 's' : ''} / prep meal{pending.length > 1 ? 's are' : ' is'} still not done or cancelled (
            {pending.map((p) => p.name).join(', ')}). Resolve them above with Retry/Cancel, or:
          </p>
          <label className="flex items-center gap-2 text-sm text-amber-800">
            <input
              type="checkbox"
              checked={cancelPending}
              onChange={(e) => setCancelPending(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            Cancel all of them automatically and close anyway
          </label>
          <label className="flex items-center gap-2 text-sm text-amber-800">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            Close anyway and leave them running (force)
          </label>
        </div>
      )}

      {doneWithoutScrap.length === 0 ? (
        <p className="text-sm text-gray-600">Every manufacturing order / prep meal already has scrap recorded.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Enter scrap for each manufacturing order / prep meal before closing:</p>
          <ul className="space-y-2">
            {doneWithoutScrap.map((mo) => (
              <li key={mo.id} className="rounded-lg border border-gray-200 p-2.5">
                <p className="text-sm font-medium text-gray-700">
                  {mo.name} — {mo.product_name} ({mo.qty} {mo.uom})
                </p>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={entries[mo.id]?.qty ?? ''}
                    onChange={(e) => setEntry(mo.id, { qty: e.target.value })}
                    placeholder="Scrap qty"
                    aria-label={`Scrap qty for ${mo.name}`}
                    className="w-28"
                  />
                  <Input
                    value={entries[mo.id]?.reason ?? ''}
                    onChange={(e) => setEntry(mo.id, { reason: e.target.value })}
                    placeholder="Reason (optional)"
                    aria-label={`Scrap reason for ${mo.name}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {closeSession.isError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {closeSession.error?.message || 'Could not close the kitchen session.'}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={!canSubmit || closeSession.isPending}>
          {closeSession.isPending ? 'Closing…' : 'Confirm & Close Kitchen'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Back
        </Button>
      </div>
    </div>
  )
}
