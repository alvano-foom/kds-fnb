import { useEffect, useRef, useState } from 'react'
import { useTtsStore } from '@/store/ttsStore'
import { usePrinterStore, useActivePrinter } from '@/store/printerStore'
import { formatAnnouncement, speakText } from '@/lib/speech'
import { printCard } from '@/lib/printCard'
import { useOrderViewStore } from '@/store/orderViewStore'
import { buildOrderCard } from '@/lib/orderGroups'

const DISMISS_MS = 6000
// Per-transaction mode: an order's lines arrive as separate WS events a moment apart; lines turning pending within this window count as one order.
const BATCH_MS = 1000

/**
 * Toast + voice announcement (+ auto-print ticket, if enabled) for cards newly entering "pending".
 * The first render is the baseline, so loading a busy board does not announce existing orders.
 * @param {import('@/types').OrderLineCard[]} cards
 */
export function PendingOrderAlerts({ cards }) {
  const [alerts, setAlerts] = useState([])
  const prevStatesRef = useRef(null)
  const batchRef = useRef(new Map()) // order_id -> lines that newly turned pending (per-transaction mode)
  const batchTimerRef = useRef(null)
  const raiseRef = useRef(() => {})
  const voiceURI = useTtsStore((s) => s.voiceURI)
  const text = useTtsStore((s) => s.text)
  const autoPrint = usePrinterStore((s) => s.autoPrint)
  const printerStatus = usePrinterStore((s) => s.status)
  const printerConnectionType = usePrinterStore((s) => s.connectionType)
  const printerCharacteristic = usePrinterStore((s) => s.characteristic)
  const perTransaction = useOrderViewStore((s) => s.perTransaction)
  const activePrinter = useActivePrinter()

  // In a ref so the batch timer always uses the latest voice/printer settings.
  useEffect(() => {
    raiseRef.current = (card) => {
      const lines = card.lines
      // An order card has no single product/qty; announce its lines as a list ("2 Nasi Goreng, 1 Es Teh").
      const announced = lines
        ? { ...card, qty: '', product_name: lines.map((l) => `${l.qty} ${l.product_name}`).join(', ') }
        : card
      const message = formatAnnouncement(text, announced).replace(/\s+/g, ' ').trim()
      const alertId = `${card.id}-${card.updated_at}`
      setAlerts((current) => [...current, { id: alertId, message }])
      speakText(message, { voiceURI })
      if (autoPrint) {
        printCard(card, {
          status: printerStatus,
          connectionType: printerConnectionType,
          characteristic: printerCharacteristic,
          activePrinter,
        })
      }
      setTimeout(() => {
        setAlerts((current) => current.filter((a) => a.id !== alertId))
      }, DISMISS_MS)
    }
  })

  useEffect(() => () => clearTimeout(batchTimerRef.current), [])

  useEffect(() => {
    const prevStates = prevStatesRef.current
    const nextStates = new Map(cards.map((c) => [c.id, c.kitchen_state]))

    if (prevStates) {
      for (const card of cards) {
        const wasState = prevStates.get(card.id)
        if (card.kitchen_state !== 'pending' || wasState === 'pending') continue
        // Ready/Served -> Pending is always rejected (409): this is an optimistic flash about to roll back.
        if (wasState === 'ready' || wasState === 'served') continue

        if (!perTransaction) {
          raiseRef.current(card)
          continue
        }

        // Collect the order's newly pending lines; raise once when none arrive for BATCH_MS.
        const key = card.order_id ?? card.order_name
        batchRef.current.set(key, [...(batchRef.current.get(key) ?? []), card])
        clearTimeout(batchTimerRef.current)
        batchTimerRef.current = setTimeout(() => {
          const batches = [...batchRef.current.values()]
          batchRef.current = new Map()
          for (const lines of batches) raiseRef.current(buildOrderCard(lines))
        }, BATCH_MS)
      }
    }

    prevStatesRef.current = nextStates
  }, [cards, perTransaction])

  if (alerts.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-50 flex w-80 flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          role="status"
          className="pointer-events-auto rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">New Order</p>
          <p className="mt-0.5 text-sm text-gray-800">{alert.message}</p>
        </div>
      ))}
    </div>
  )
}
