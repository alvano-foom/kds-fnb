import { useMemo, useState } from 'react'
import { useKitchenSessionDetail, useCloseKitchenSession } from '../../hooks/useKitchenSession'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'
import { ProductionScrapRow } from '../molecules/ProductionScrapRow'
import { Button } from '../atoms/Button'

/**
 * Lists this session's done manufacturing orders / prep meals; tapping one
 * expands its ingredients (from /kitchen/productions/{id}/components) so
 * scrap can be recorded per ingredient. Scrap is recorded immediately via
 * POST /kitchen/productions/{id}/scraps, so closing itself sends no scraps.
 *
 * Client-side policy (decided with the user, not enforced by the real
 * backend): every done MO has to be reviewed before this button will let you
 * close — either it has scrap recorded, or the operator said "No scrap for
 * this one". The backend's own rule is narrower: it only blocks on
 * productions still stuck in a non-final state (`pending_productions`),
 * which `cancelPending`/`force` below can override when needed.
 */
export function CloseKitchenSessionPanel({ onCancel, onClosed }) {
  const employee = useKitchenSessionStore((s) => s.employee)
  const { data: session, isLoading } = useKitchenSessionDetail()
  const closeSession = useCloseKitchenSession()
  const [expandedId, setExpandedId] = useState(null)
  const [noScrap, setNoScrap] = useState(() => new Set()) // MO ids the operator explicitly marked "no scrap"
  const [cancelPending, setCancelPending] = useState(false)
  const [force, setForce] = useState(false)

  const pending = useMemo(
    () => (session?.productions || []).filter((p) => !['done', 'cancelled'].includes(p.state)),
    [session],
  )
  const doneMos = useMemo(() => (session?.productions || []).filter((p) => p.state === 'done'), [session])
  const scrappedIds = useMemo(() => new Set((session?.scraps || []).map((s) => s.production_id)), [session])
  const unreviewed = doneMos.filter((mo) => !scrappedIds.has(mo.id) && !noScrap.has(mo.id))

  const canSubmit = unreviewed.length === 0 && (pending.length === 0 || cancelPending || force)

  function handleSubmit() {
    // Scrap was already recorded per MO as it was entered, so nothing to send here.
    closeSession.mutate({ employeeCode: employee.code, scraps: [], cancelPending, force }, { onSuccess: onClosed })
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

      {doneMos.length === 0 ? (
        <p className="text-sm text-gray-600">No manufacturing orders / prep meals were completed this session — nothing to scrap.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Tap each manufacturing order / prep meal to record scrapped ingredients. Every one needs a review before closing
            {unreviewed.length > 0 ? ` (${unreviewed.length} left)` : ''}:
          </p>
          <ul className="space-y-2">
            {doneMos.map((mo) => (
              <ProductionScrapRow
                key={mo.id}
                mo={mo}
                expanded={expandedId === mo.id}
                onToggle={() => setExpandedId(expandedId === mo.id ? null : mo.id)}
                hasScrap={scrappedIds.has(mo.id)}
                markedNoScrap={noScrap.has(mo.id)}
                onMarkNoScrap={() => setNoScrap((prev) => new Set(prev).add(mo.id))}
                employeeCode={employee.code}
              />
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
