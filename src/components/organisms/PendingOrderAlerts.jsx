import { useEffect, useRef, useState } from 'react'
import { useTtsStore } from '../../store/ttsStore'
import { formatAnnouncement, speakText } from '../../lib/speech'

const DISMISS_MS = 6000

/**
 * Watches the board's cards for lines newly entering "pending" — either a
 * fresh order line arriving over the WebSocket, or a card dragged back to
 * Pending — and raises a toast plus a spoken (Indonesian) announcement for
 * each one. The very first render is treated as the board's starting
 * snapshot, not as new arrivals, so loading an already-busy board doesn't
 * fire a toast per existing pending line.
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

  useEffect(() => {
    const prevStates = prevStatesRef.current
    const nextStates = new Map(cards.map((c) => [c.id, c.kitchen_state]))

    if (prevStates) {
      for (const card of cards) {
        const wasState = prevStates.get(card.id)
        if (card.kitchen_state !== 'pending' || wasState === 'pending') continue

        const message = formatAnnouncement(text, card)
        const alertId = `${card.id}-${card.updated_at}`
        setAlerts((current) => [...current, { id: alertId, message }])
        speakText(message, { voiceURI })
        setTimeout(() => {
          setAlerts((current) => current.filter((a) => a.id !== alertId))
        }, DISMISS_MS)
      }
    }

    prevStatesRef.current = nextStates
  }, [cards, voiceURI, text])

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
