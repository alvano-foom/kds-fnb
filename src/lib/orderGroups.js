import { KITCHEN_STATES } from '@/types'

const stateIndex = (state) => KITCHEN_STATES.indexOf(state)

/** True for a "per transaction" card (see groupByOrder), false for a plain one-order-line card. */
export function isOrderCard(card) {
  return Array.isArray(card?.lines)
}

/** The lines a ticket lists: an order card's lines, or the single-line card itself. */
export function ticketLines(card) {
  return isOrderCard(card) && card.lines.length > 0 ? card.lines : [card]
}

/**
 * One per-transaction card from some of an order's lines. Its kitchen_state is the EARLIEST
 * among the lines, so a half-finished order never looks finished; qty is the total.
 * @param {import('@/types').OrderLineCard[]} lines non-empty, all from the same order
 */
export function buildOrderCard(lines) {
  const first = lines[0]
  const earliest = lines.reduce((a, l) => (stateIndex(l.kitchen_state) < stateIndex(a) ? l.kitchen_state : a), first.kitchen_state)
  const created = lines.reduce((a, l) => (new Date(l.created_at) < new Date(a) ? l.created_at : a), first.created_at)
  const updated = lines.reduce((a, l) => (new Date(l.updated_at) > new Date(a) ? l.updated_at : a), first.updated_at)
  return {
    id: `order:${first.order_id}`,
    order_id: first.order_id,
    order_name: first.order_name,
    table_number: first.table_number,
    customer_name: first.customer_name,
    qty: lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0),
    kitchen_state: earliest,
    created_at: created,
    updated_at: updated,
    lines,
  }
}

/** One card per sale.order, in the order each order first appears. */
export function groupByOrder(cards) {
  const byOrder = new Map()
  for (const card of cards) {
    const key = card.order_id ?? card.order_name
    if (!byOrder.has(key)) byOrder.set(key, [])
    byOrder.get(key).push(card)
  }
  return [...byOrder.values()].map(buildOrderCard)
}

/**
 * Plan a per-transaction drop on `targetState` as `[{ lineId, steps }]`.
 * Forward: lines behind the target step up one state at a time (never skipping a state).
 * Backward: only lines in the card's own column move back one step.
 */
export function planOrderMove(card, targetState) {
  const target = stateIndex(targetState)
  const own = stateIndex(card.kitchen_state)
  if (target < 0 || target === own) return []

  if (target > own) {
    return card.lines
      .filter((l) => stateIndex(l.kitchen_state) < target)
      .map((l) => ({ lineId: l.id, steps: KITCHEN_STATES.slice(stateIndex(l.kitchen_state) + 1, target + 1) }))
  }
  return card.lines.filter((l) => l.kitchen_state === card.kitchen_state).map((l) => ({ lineId: l.id, steps: [targetState] }))
}
