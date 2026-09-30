import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { closeSession } from '../../api/session'
import { useSessionStore } from '../../store/sessionStore'
import { useSessionManufacturingOrders } from '../../hooks/useSessionManufacturingOrders'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'

/**
 * Requirement #3: closing is blocked until every manufacturing order made
 * during this session has a scrap quantity — this panel only shows the
 * ones still missing one and won't submit until all are filled in (0 is a
 * valid, explicit answer).
 */
export function CloseSessionPanel({ onCancel, onClosed }) {
  const session = useSessionStore((s) => s.session)
  const markClosed = useSessionStore((s) => s.markClosed)
  const { data: orders, isLoading } = useSessionManufacturingOrders()
  const [entries, setEntries] = useState({}) // { [moId]: { qty: string, reason: string } }

  const missing = useMemo(() => (orders || []).filter((mo) => mo.scrap == null), [orders])

  const mutation = useMutation({
    mutationFn: () =>
      closeSession(
        session.id,
        missing.map((mo) => ({
          manufacturing_order_id: mo.id,
          qty: Number(entries[mo.id]?.qty ?? 0),
          reason: entries[mo.id]?.reason || '',
        })),
      ),
    onSuccess: () => {
      markClosed()
      onClosed?.()
    },
  })

  function setEntry(id, patch) {
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const allFilled = missing.every((mo) => entries[mo.id]?.qty !== undefined && entries[mo.id]?.qty !== '')

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  if (missing.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Every manufacturing order this session already has scrap recorded. Ready to close.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Closing…' : 'Confirm & Close Session'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Enter scrap for each manufacturing order below before this session can close.
      </p>
      <ul className="space-y-2">
        {missing.map((mo) => (
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
                className="w-32"
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

      {mutation.isError && (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
          {mutation.error?.message || 'Could not close the session.'}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={() => mutation.mutate()} disabled={!allFilled || mutation.isPending}>
          {mutation.isPending ? 'Closing…' : 'Confirm & Close Session'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Back
        </Button>
      </div>
    </div>
  )
}
