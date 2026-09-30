import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createManufacturingOrder } from '../../api/manufacturingOrders'
import { useSessionStore } from '../../store/sessionStore'
import { ProductPicker } from '../molecules/ProductPicker'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'

/**
 * Requirement #2: while a session is open, creating a Manufacturing Order
 * only needs a product + qty (warehouse was already chosen once for the
 * whole session). Scrap here is optional — it can also be filled in later,
 * but at latest it's forced at session close (see CloseSessionPanel).
 */
export function CreateMOForm() {
  const queryClient = useQueryClient()
  const session = useSessionStore((s) => s.session)
  const warehouseId = useSessionStore((s) => s.warehouseId)

  const [product, setProduct] = useState(null)
  const [qty, setQty] = useState('')
  const [scrapEnabled, setScrapEnabled] = useState(false)
  const [scrapQty, setScrapQty] = useState('')
  const [scrapReason, setScrapReason] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      createManufacturingOrder({
        sessionId: session.id,
        warehouseId,
        productId: product.id,
        qty: Number(qty),
        scrapQty: scrapEnabled && scrapQty !== '' ? Number(scrapQty) : undefined,
        scrapReason: scrapEnabled ? scrapReason : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing-orders', session.id] })
      setProduct(null)
      setQty('')
      setScrapEnabled(false)
      setScrapQty('')
      setScrapReason('')
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!product || !qty || Number(qty) <= 0) return
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">New Manufacturing Order</p>

      <ProductPicker selected={product} onSelect={setProduct} />

      <Input
        type="number"
        min="0"
        step="any"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="Qty to manufacture"
        aria-label="Quantity to manufacture"
      />

      <label className="flex items-center gap-2 text-xs text-gray-500">
        <input
          type="checkbox"
          checked={scrapEnabled}
          onChange={(e) => setScrapEnabled(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-gray-300"
        />
        Record scrap now (optional — can be entered later, but is required before this session can close)
      </label>

      {scrapEnabled && (
        <div className="flex gap-2">
          <Input
            type="number"
            min="0"
            step="any"
            value={scrapQty}
            onChange={(e) => setScrapQty(e.target.value)}
            placeholder="Scrap qty"
            aria-label="Scrap quantity"
            className="w-32"
          />
          <Input
            value={scrapReason}
            onChange={(e) => setScrapReason(e.target.value)}
            placeholder="Reason (optional)"
            aria-label="Scrap reason"
          />
        </div>
      )}

      {mutation.isError && (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
          {mutation.error?.message || 'Could not create the manufacturing order.'}
        </p>
      )}

      <Button type="submit" disabled={mutation.isPending || !product || !qty} className="w-full">
        {mutation.isPending ? 'Creating…' : 'Create Manufacturing Order'}
      </Button>
    </form>
  )
}
