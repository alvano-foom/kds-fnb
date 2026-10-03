import { useState } from 'react'
import { useCreateProductionScraps, useProductionComponents } from '../../hooks/useKitchenSession'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'
import { Spinner } from '../atoms/Spinner'

/**
 * One manufacturing order / prep meal in the Close Kitchen list. Collapsed it
 * is just a header with its scrap status; expanded it lists the MO's
 * ingredients (GET /kitchen/productions/{id}/components — the finished good
 * is deliberately not in that list, so it can't be scrapped by mistake) with
 * a scrap qty + reason per ingredient. "Record scrap" posts them straight
 * away (the scrap is created and validated by Odoo immediately), so what
 * the operator sees afterwards is what Odoo has.
 */
export function ProductionScrapRow({ mo, expanded, onToggle, hasScrap, markedNoScrap, onMarkNoScrap, employeeCode }) {
  const components = useProductionComponents(expanded ? mo.id : null)
  const createScraps = useCreateProductionScraps()
  const [entries, setEntries] = useState({}) // { [productId]: { qty, reason } }

  const status = hasScrap ? 'recorded' : markedNoScrap ? 'none' : 'todo'
  const statusLabel = { recorded: 'Scrap recorded', none: 'No scrap', todo: 'Needs review' }[status]
  const statusStyle = {
    recorded: 'bg-emerald-50 text-emerald-700',
    none: 'bg-gray-100 text-gray-600',
    todo: 'bg-amber-50 text-amber-700',
  }[status]

  function setEntry(productId, patch) {
    setEntries((prev) => ({ ...prev, [productId]: { ...prev[productId], ...patch } }))
  }

  const items = Object.entries(entries)
    .filter(([, e]) => Number(e?.qty) > 0)
    .map(([productId, e]) => ({ product_id: productId, qty: Number(e.qty), ...(e.reason ? { reason: e.reason } : {}) }))

  function handleRecord() {
    createScraps.mutate(
      { productionId: mo.id, employeeCode, items },
      { onSuccess: () => setEntries({}) },
    )
  }

  return (
    <li className="rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-800">
            {mo.name} — {mo.product_name}
          </span>
          <span className="block text-xs text-gray-500">
            {mo.qty} {mo.uom}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}>{statusLabel}</span>
          <span aria-hidden="true" className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-gray-100 px-3 py-3">
          {components.isLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Spinner className="h-4 w-4" /> Loading ingredients…
            </div>
          )}
          {components.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {components.error?.message || 'Could not load the ingredients of this manufacturing order.'}
            </p>
          )}

          {components.data && components.data.components.length === 0 && (
            <p className="text-sm text-gray-500">This manufacturing order has no ingredients to scrap.</p>
          )}

          {components.data?.components.map((c) => (
            <div key={c.product_id} className="space-y-1.5">
              <p className="text-sm font-medium text-gray-700">{c.name}</p>
              <p className="text-xs text-gray-500">
                To consume {c.to_consume_qty} {c.uom}
                {c.scrapped_qty > 0 && (
                  <span className="font-medium text-amber-700">
                    {' '}
                    · already scrapped {c.scrapped_qty} {c.uom}
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={entries[c.product_id]?.qty ?? ''}
                  onChange={(e) => setEntry(c.product_id, { qty: e.target.value })}
                  placeholder={`Scrap qty (${c.uom})`}
                  aria-label={`Scrap qty for ${c.name}`}
                  className="w-36"
                />
                <Input
                  value={entries[c.product_id]?.reason ?? ''}
                  onChange={(e) => setEntry(c.product_id, { reason: e.target.value })}
                  placeholder="Reason (optional)"
                  aria-label={`Scrap reason for ${c.name}`}
                />
              </div>
            </div>
          ))}

          {createScraps.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {createScraps.error?.message || 'Could not record the scrap.'}
            </p>
          )}

          {components.data && components.data.components.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleRecord} disabled={items.length === 0 || createScraps.isPending}>
                {createScraps.isPending && <Spinner className="h-4 w-4" />}
                Record scrap
              </Button>
              {!hasScrap && !markedNoScrap && (
                <Button type="button" variant="secondary" onClick={onMarkNoScrap} disabled={createScraps.isPending}>
                  No scrap for this one
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  )
}
