import { useState } from 'react'
import { useCreateProduction, useSetProductionState } from '../../hooks/useKitchenSession'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'
import { KitchenProductPicker } from '../molecules/KitchenProductPicker'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'
import { Spinner } from '../atoms/Spinner'

/**
 * Creating a Manufacturing Order here is a two-step call under the hood
 * (create, then mark it done) — the decision made with the user is that
 * a kitchen recording what it just made should show up done immediately,
 * not sit around waiting for someone to confirm it. If the "mark done"
 * step fails (e.g. a component ran short — a real possibility this app
 * checks for up front via available_qty, but availability can still
 * shift between people at the same kiosk), the MO still exists — it just
 * shows up in the list below flagged for attention, with Retry/Cancel,
 * rather than silently vanishing or blocking the whole form.
 */
export function ProductionForm() {
  const employee = useKitchenSessionStore((s) => s.employee)
  const createProduction = useCreateProduction()
  const setProductionState = useSetProductionState()

  const [product, setProduct] = useState(null)
  const [qty, setQty] = useState('')
  const [notice, setNotice] = useState(null)

  const isBusy = createProduction.isPending || setProductionState.isPending

  function handleSubmit(e) {
    e.preventDefault()
    if (!product || !qty || Number(qty) <= 0) return
    setNotice(null)
    const qtyNumber = Number(qty)

    createProduction.mutate(
      { employeeCode: employee.code, productId: product.product_id, qty: qtyNumber },
      {
        onSuccess: (production) => {
          setProduct(null)
          setQty('')
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
          setNotice({ type: 'error', text: err?.message || 'Could not create the manufacturing order.' })
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">New Manufacturing Order</p>

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

      {notice && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            notice.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {notice.text}
        </p>
      )}

      <Button type="submit" disabled={isBusy || !product || !qty} className="w-full">
        {isBusy && <Spinner className="h-4 w-4" />}
        Create Manufacturing Order
      </Button>
    </form>
  )
}
