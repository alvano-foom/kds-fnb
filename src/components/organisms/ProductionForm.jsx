import { useState } from 'react'
import { useBomPreview, useCreateProduction, useSetProductionState } from '../../hooks/useKitchenSession'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'
import { KitchenProductPicker } from '../molecules/KitchenProductPicker'
import { BomChecklist } from '../molecules/BomChecklist'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'
import { Spinner } from '../atoms/Spinner'

/**
 * Two steps before anything is written to Odoo:
 *
 *   1. Pick the product + qty, then "Process manufacture order".
 *   2. Review the BoM — every ingredient with the qty this run will
 *      consume — and tick each one off like a todo. "Create Manufacturing
 *      Order / Prep Meal" stays disabled until 100% are ticked.
 *
 * The ticks are a kitchen aid only (see BomChecklist): they are never
 * sent to or validated by the backend.
 *
 * Creating is a two-step call under the hood (create, then mark done) —
 * the decision made with the user is that a kitchen recording what it
 * just made should show up done immediately, not sit around waiting for
 * someone to confirm it. If the "mark done" step fails (e.g. a component
 * ran short — a real possibility, since availability can shift between
 * people at the same kiosk), the MO still exists — it just shows up in
 * the list below flagged for attention, with Retry/Cancel, rather than
 * silently vanishing or blocking the whole form.
 */
export function ProductionForm() {
  const employee = useKitchenSessionStore((s) => s.employee)
  const createProduction = useCreateProduction()
  const setProductionState = useSetProductionState()

  const [step, setStep] = useState('select') // 'select' | 'review'
  const [product, setProduct] = useState(null)
  const [qty, setQty] = useState('')
  const [checked, setChecked] = useState(() => new Set())
  const [notice, setNotice] = useState(null)

  const qtyNumber = Number(qty)
  const reviewing = step === 'review'
  const bomQuery = useBomPreview(reviewing ? product?.product_id : null)
  const bom = bomQuery.data

  const isBusy = createProduction.isPending || setProductionState.isPending
  const allChecked = Boolean(bom) && checked.size === bom.components.length
  const canProcess = Boolean(product) && qtyNumber > 0

  function reset() {
    setStep('select')
    setProduct(null)
    setQty('')
    setChecked(new Set())
  }

  function handleProcess() {
    if (!canProcess) return
    setNotice(null)
    setChecked(new Set()) // a fresh checklist every time — never inherit ticks from a previous run
    setStep('review')
  }

  function handleBack() {
    setNotice(null)
    setChecked(new Set())
    setStep('select')
  }

  function toggle(productId) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!reviewing) {
      handleProcess()
      return
    }
    if (!allChecked || isBusy) return
    setNotice(null)

    createProduction.mutate(
      { employeeCode: employee.code, productId: product.product_id, qty: qtyNumber, bomId: bom.bom_id },
      {
        onSuccess: (production) => {
          reset()
          setProductionState.mutate(
            { productionId: production.id, employeeCode: employee.code, action: 'done', qty: qtyNumber },
            {
              onError: (err) => {
                setNotice({
                  type: 'warning',
                  text: `${production.name} was created but couldn't be finished automatically: ${
                    err?.message || 'unknown error'
                  }. Retry or cancel it in the list below.`,
                })
              },
            },
          )
        },
        onError: (err) => {
          setNotice({ type: 'error', text: err?.message || 'Could not create the manufacturing order / prep meal.' })
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          New Manufacturing Order / Prep Meal
        </p>
        <p className="text-xs text-gray-400">Step {reviewing ? 2 : 1} of 2</p>
      </div>

      {!reviewing ? (
        <>
          <KitchenProductPicker selected={product} onSelect={setProduct} />

          <Input
            type="number"
            min="0"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qty to manufacture"
            aria-label="Quantity to manufacture"
          />

          <Button type="submit" disabled={!canProcess} className="w-full">
            Process manufacture order
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-gray-700">{product.name}</p>
              <p className="text-xs text-gray-500">
                Making {qtyNumber} {product.uom}
                {bom?.bom_code ? ` · ${bom.bom_code}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={handleBack}
              disabled={isBusy}
              className="text-xs font-medium text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
            >
              Edit
            </button>
          </div>

          {bomQuery.isLoading && (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
              <Spinner className="h-4 w-4" /> Loading bill of materials…
            </div>
          )}

          {bomQuery.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {bomQuery.error?.message || 'Could not load the bill of materials for this product.'}{' '}
              <button type="button" onClick={handleBack} className="font-medium underline">
                Pick a different product
              </button>
            </p>
          )}

          {bom && <BomChecklist bom={bom} qty={qtyNumber} checked={checked} onToggle={toggle} />}

          {notice && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                notice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {notice.text}
            </p>
          )}

          <Button type="submit" disabled={isBusy || !allChecked} className="w-full">
            {isBusy && <Spinner className="h-4 w-4" />}
            Create Manufacturing Order / Prep Meal
          </Button>
          {bom && !allChecked && (
            <p className="text-center text-xs text-gray-400">Tick every ingredient to enable this button.</p>
          )}
        </>
      )}

      {/* Shown on step 1 too — a "created but couldn't finish" warning from the run that just ended lands here. */}
      {!reviewing && notice && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            notice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {notice.text}
        </p>
      )}
    </form>
  )
}
