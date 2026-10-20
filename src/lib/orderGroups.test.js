import { describe, expect, it } from 'vitest'
import { buildOrderCard, groupByOrder, isOrderCard, planOrderMove, ticketLines } from './orderGroups'

const t0 = '2026-01-01T00:00:00Z'
const t1 = '2026-01-01T00:05:00Z'
const line = (id, orderId, state, extra = {}) => ({
  id,
  order_id: orderId,
  order_name: `SO${orderId}`,
  table_number: '7',
  customer_name: 'Alex',
  product_name: `Item ${id}`,
  qty: 2,
  kitchen_state: state,
  created_at: t0,
  updated_at: t0,
  ...extra,
})

describe('groupByOrder', () => {
  it('makes one card per sale order, keeping every line, in order of first appearance', () => {
    const cards = groupByOrder([line('l1', 'a', 'pending'), line('l2', 'b', 'pending'), line('l3', 'a', 'pending')])
    expect(cards.map((c) => c.id)).toEqual(['order:a', 'order:b'])
    expect(cards[0].lines.map((l) => l.id)).toEqual(['l1', 'l3'])
    expect(cards[0]).toMatchObject({ order_name: 'SOa', table_number: '7', customer_name: 'Alex', qty: 4 })
  })

  it('puts an order in its earliest line state, so half-done orders are never shown as done', () => {
    expect(groupByOrder([line('l1', 'a', 'ready'), line('l2', 'a', 'pending')])[0].kitchen_state).toBe('pending')
    expect(groupByOrder([line('l1', 'a', 'ready'), line('l2', 'a', 'cooking')])[0].kitchen_state).toBe('cooking')
    expect(groupByOrder([line('l1', 'a', 'served'), line('l2', 'a', 'ready')])[0].kitchen_state).toBe('ready')
  })

  it('uses the oldest created_at and the newest updated_at', () => {
    const [card] = groupByOrder([line('l1', 'a', 'pending', { created_at: t1, updated_at: t0 }), line('l2', 'a', 'pending', { created_at: t0, updated_at: t1 })])
    expect(card.created_at).toBe(t0)
    expect(card.updated_at).toBe(t1)
  })
})

describe('ticketLines / isOrderCard', () => {
  it('lists all lines of an order card, or just the card for a single-line card', () => {
    const l = line('l1', 'a', 'pending')
    expect(isOrderCard(l)).toBe(false)
    expect(ticketLines(l)).toEqual([l])
    const order = buildOrderCard([l, line('l2', 'a', 'pending')])
    expect(isOrderCard(order)).toBe(true)
    expect(ticketLines(order)).toHaveLength(2)
  })
})

describe('planOrderMove', () => {
  it('moves every line that is behind the target, one state at a time', () => {
    const card = buildOrderCard([line('l1', 'a', 'pending'), line('l2', 'a', 'cooking'), line('l3', 'a', 'ready')])
    expect(planOrderMove(card, 'ready')).toEqual([
      { lineId: 'l1', steps: ['cooking', 'ready'] },
      { lineId: 'l2', steps: ['ready'] },
    ])
  })

  it('moves a whole pending order to Cooking in a single step per line', () => {
    const card = buildOrderCard([line('l1', 'a', 'pending'), line('l2', 'a', 'pending')])
    expect(planOrderMove(card, 'cooking')).toEqual([
      { lineId: 'l1', steps: ['cooking'] },
      { lineId: 'l2', steps: ['cooking'] },
    ])
  })

  it('moving back only touches the lines in the card’s own column', () => {
    const card = buildOrderCard([line('l1', 'a', 'cooking'), line('l2', 'a', 'ready')])
    expect(planOrderMove(card, 'pending')).toEqual([{ lineId: 'l1', steps: ['pending'] }])
  })

  it('does nothing when dropped on its own column', () => {
    const card = buildOrderCard([line('l1', 'a', 'cooking')])
    expect(planOrderMove(card, 'cooking')).toEqual([])
  })
})
