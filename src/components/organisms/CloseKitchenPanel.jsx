import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { closeKitchenSession } from '../../api/kitchen'
import { useConfigStore } from '../../store/configStore'
import { useOperatorStore } from '../../store/operatorStore'
import { kitchenSessionQueryKey } from '../../hooks/useKitchenSession'
import { ProductionList } from './ProductionList'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'

const NON_TERMINAL = new Set(['draft', 'confirmed', 'in_progress'])

/**
 * Requirement #3: every production that finished (`done`) during this
 * session needs a scrap entry before Close is enabled — the real backend
 * doesn't enforce this itself (it only enforces `pending_productions`, see
 * below), this app does, on purpose, as a reconciliation step.
 */
export function CloseKitchenPanel({ session, onCancel, onClosed }) {
  const companyId = useConfigStore((s) => s.companyId)
  const employeeCode = useOperatorStore((s) => s.employeeCode)
  const queryClient = useQueryClient()
  const [entries, setEntries] = useState({}) // { [productId]: { qty, reason, production_id } }
  const [forceClose, setForceClose] = useState(false)

  const pending = useMemo(() => session.productions.filter((p) => NON_TERMINAL.has(p.state)), [session.productions])
  const done = useMemo(() => session.productions.filter((p) => p.state === 'done'), [session.productions])

  const mutation = useMutation({
    mutationFn: () =>
      closeKitchenSession(session.id, {
        employeeCode,
        scraps: done.map((p) => ({
          product_id: p.product_id,
          production_id: p.id,
          qty: Number(entries[p.id]?.qty ?? 0),
          reason: entries[p.id]?.reason || '',
        })),
        force: pending.length > 0 ? forceClose : undefined,
      }),
    onSuccess: () => {
      queryClient.setQueryData(kitchenSessionQueryKey(companyId), null)
      onClosed?.()
    },
  })

  function setEntry(id, patch) {
    setEntries((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const allScrapFilled = done.every((p) => entries[p.id]?.qty !== undefined && entries[p.id]?.qty !== '')
  const canClose = allScrapFilled && (pending.length === 0 || forceClose)

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">
            {pending.length} manufacturing order{pending.length > 1 ? 's are' : ' is'} still in progress
          </p>
          <p className="text-xs text-amber-700">Mark each one Done or Cancel it, or force-close and leave them running.</p>
          <ProductionList productions={pending} />
          <label className="flex items-center gap-2 text-xs text-amber-800">
            <input
              type="checkbox"
              checked={forceClose}
              onChange={(e) => setForceClose(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-amber-300"
            />
            Force-close anyway and leave these running
          </label>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          {done.length === 0
            ? 'No finished manufacturing orders need scrap this session.'
            : 'Enter scrap for each finished manufacturing order before closing.'}
        </p>
        <ul className="space-y-2">
          {done.map((p) => (
            <li key={p.id} className="rounded-lg border border-gray-200 p-2.5">
              <p className="text-sm font-medium text-gray-700">
                {p.name} — {p.product_name} ({p.qty})
              </p>
              <div className="mt-1.5 flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={entries[p.id]?.qty ?? ''}
                  onChange={(e) => setEntry(p.id, { qty: e.target.value })}
                  placeholder="Scrap qty"
                  aria-label={`Scrap qty for ${p.name}`}
                  className="w-32"
                />
                <Input
                  value={entries[p.id]?.reason ?? ''}
                  onChange={(e) => setEntry(p.id, { reason: e.target.value })}
                  placeholder="Reason (optional)"
                  aria-label={`Scrap reason for ${p.name}`}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {mutation.isError && (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">{mutation.error.message}</p>
      )}

      <div className="flex gap-2">
        <Button onClick={() => mutation.mutate()} disabled={!canClose || mutation.isPending}>
          {mutation.isPending ? 'Closing…' : 'Confirm & Close Kitchen'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Back
        </Button>
      </div>
    </div>
  )
}
