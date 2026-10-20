import { KITCHEN_STATES } from '../types'

const stateIndex = (state) => KITCHEN_STATES.indexOf(state)

/** True for a "per transaction" card (see groupByOrder), false for a plain one-order-line card. */
export function isOrderCard(card) {
  return Array.isArray(card?.lines)
}

/** The lines a ticket should list: all of an order card's lines, or just the card itself for a single-line card. */
export function ticketLines(card) {
  return isOrderCard(card) && card.lines.length > 0 ? card.lines : [card]
}

/**
 * Builds one per-transaction card out of some of an order's lines.
 *
 * Its `kitchen_state` is the EARLIEST state among the lines — an order sits in
 * Pending while anything in it is still pending, moves to Cooking once every
 * line is at least cooking, and so on — so a half-finished order is never
 * mistaken for a finished one. `qty` is the total quantity across the lines.
 *
 * @param {import('../types').OrderLineCard[]} lines non-empty, all from the same order
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
 * What a drop of a per-transaction card on `targetState` has to do to its
 * lines, as `[{ lineId, steps }]` — `steps` being the states to PATCH that
 * line through, in order.
 *
 *  - Forward (Pending → Cooking → Ready → Served): every line that is still
 *    behind the target moves up to it, one state at a time, so a line is
 *    never asked to skip a step the backend might not allow. Lines already at
 *    or past the target are left alone.
 *  - Backward: only the lines sitting in the card's own column move back (the
 *    same single step the per-line board allows); anything further along
 *    stays put. The API still has the final say — a refused move rolls the
 *    whole drop back.
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
