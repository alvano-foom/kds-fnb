import { useEffect, useRef, useState } from 'react'
import { useTtsStore } from '../../store/ttsStore'
import { usePrinterStore } from '../../store/printerStore'
import { formatAnnouncement, speakText } from '../../lib/speech'
import { printCard } from '../../lib/printCard'

const DISMISS_MS = 6000

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
  const voiceURI = useTtsStore((s) => s.voiceURI)
  const text = useTtsStore((s) => s.text)
  const autoPrint = usePrinterStore((s) => s.autoPrint)
  const printerStatus = usePrinterStore((s) => s.status)
  const printerConnectionType = usePrinterStore((s) => s.connectionType)
  const printerCharacteristic = usePrinterStore((s) => s.characteristic)
  const printerNetworkHost = usePrinterStore((s) => s.networkHost)
  const printerNetworkPort = usePrinterStore((s) => s.networkPort)
  const printerNetworkSecure = usePrinterStore((s) => s.networkSecure)
  const printerAndroidTransport = usePrinterStore((s) => s.androidTransport)
  const printerAndroidMac = usePrinterStore((s) => s.androidMac)
  const printerAndroidHost = usePrinterStore((s) => s.androidHost)
  const printerAndroidPort = usePrinterStore((s) => s.androidPort)

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

        const message = formatAnnouncement(text, card)
        const alertId = `${card.id}-${card.updated_at}`
        setAlerts((current) => [...current, { id: alertId, message }])
        speakText(message, { voiceURI })
        if (autoPrint) {
          // Note for connectionType === 'android': this fires from a data
          // effect, not a click, and Chrome-on-Android's gesture
          // requirement for intent:// navigation is unverified for that
          // case — see androidPrintBridge.js. Confirm auto-print actually
          // reaches the companion app on a real tablet before relying on it.
          printCard(card, {
            status: printerStatus,
            connectionType: printerConnectionType,
            characteristic: printerCharacteristic,
            networkHost: printerNetworkHost,
            networkPort: printerNetworkPort,
            networkSecure: printerNetworkSecure,
            androidTransport: printerAndroidTransport,
            androidMac: printerAndroidMac,
            androidHost: printerAndroidHost,
            androidPort: printerAndroidPort,
          })
        }
        setTimeout(() => {
          setAlerts((current) => current.filter((a) => a.id !== alertId))
        }, DISMISS_MS)
      }
    }

    prevStatesRef.current = nextStates
  }, [
    cards,
    voiceURI,
    text,
    autoPrint,
    printerStatus,
    printerConnectionType,
    printerCharacteristic,
    printerNetworkHost,
    printerNetworkPort,
    printerNetworkSecure,
    printerAndroidTransport,
    printerAndroidMac,
    printerAndroidHost,
    printerAndroidPort,
  ])

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
