import { useEffect, useRef, useState } from 'react'
import { useTtsStore } from '../../store/ttsStore'
import { usePrinterStore, useActivePrinter } from '../../store/printerStore'
import { formatAnnouncement, speakText } from '../../lib/speech'
import { printCard } from '../../lib/printCard'
import { useOrderViewStore } from '../../store/orderViewStore'
import { buildOrderCard } from '../../lib/orderGroups'

const DISMISS_MS = 6000
// Per-transaction mode: an order's lines reach the board as separate
// websocket events a moment apart; lines that turn pending within this window
// are one transaction and get one toast / announcement / ticket.
const BATCH_MS = 1000

/**
 * Watches the board's cards for lines newly entering "pending" — either a
 * fresh order line arriving over the WebSocket, or a card dragged back to
 * Pending from Cooking (the one reversal the backend's KITCHEN_TRANSITIONS
 * table actually allows, see models/sale_order_line.py) — and raises a
 * toast plus a spoken (Indonesian) announcement for each one, and (if
 * "Automatically print each new order" is turned on in Settings → Receipt
 * Printer) prints a ticket for it too, the same way OrderCard's manual
 * Print button does. The very first render is treated as the board's
 * starting snapshot, not as new arrivals, so loading an already-busy board
 * doesn't fire a toast (or a ticket) per existing pending line.
 *
 * Dragging a Ready or Served card back to Pending is NOT one of those
 * allowed reversals — the API always rejects it with 409, and
 * useUpdateLineState rolls the card back once that rejection arrives. But
 * the drag is applied to the board OPTIMISTICALLY the instant it's
 * dropped, before the server has said yes or no — so for one render, this
 * component sees a card that just became "pending", even though that
 * transition is about to be undone. Without excluding wasState ready/served
 * below, every doomed drag-to-Pending would announce and print a ticket
 * for an order that was never actually reopened.
 *

 * Both the toast text and the spoken text come from the same configurable
 * "Announcement text" template (Settings → Voice Announcements, stored in
 * ttsStore), filled in per card via formatAnnouncement() — so there's no
 * wording hardcoded here.
 *
 * @param {import('../../types').OrderLineCard[]} cards
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

  // Toast + voice + (if on) ticket for one card — a single order line, or, in
  // per-transaction mode, a whole order. Kept in a ref so the batch timer
  // below always runs the latest voice/printer settings, not the ones from
  // when its batch started.
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
        // Ready/Served -> Pending is always rejected by the API (409) — this
        // is the optimistic-update flash of a drag that's about to be
        // rolled back, not a real reopening. See the note above.
        if (wasState === 'ready' || wasState === 'served') continue

        if (!perTransaction) {
          raiseRef.current(card)
          continue
        }

        // Per transaction: collect the order's newly pending lines, then raise
        // once for the whole order when no more arrive for BATCH_MS.
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
