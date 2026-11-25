import { describe, expect, it } from 'vitest'
import { mergeStockAlerts, pendingOrderBaskets } from './stockCheck'

const card = (over) => ({ order_id: 'o1', order_name: 'SO1', kitchen_state: 'pending', qty: 1, ...over })

describe('pendingOrderBaskets', () => {
  it('sends each pending line with its order_line_id, grouped per order', () => {
    const baskets = pendingOrderBaskets([
      card({ id: 'a', barcode: 'NG001', qty: 2 }),
      card({ id: 'b', barcode: 'NG001', qty: 1 }),
      card({ id: 'c', barcode: 'NU001' }),
      card({ id: 'd', order_id: 'o2', order_name: 'SO2', barcode: 'NG001', qty: 4 }),
    ])
    expect(baskets).toEqual([
      {
        orderId: 'o1',
        orderName: 'SO1',
        lines: [
          { order_line_id: 'a', barcode: 'NG001', qty: 2 },
          { order_line_id: 'b', barcode: 'NG001', qty: 1 },
          { order_line_id: 'c', barcode: 'NU001', qty: 1 },
        ],
      },
      { orderId: 'o2', orderName: 'SO2', lines: [{ order_line_id: 'd', barcode: 'NG001', qty: 4 }] },
    ])
  })

  it('skips lines that are not pending or have no barcode or product_id, and falls back to product_id', () => {
    const baskets = pendingOrderBaskets([
      card({ id: 'a', barcode: 'NG001', kitchen_state: 'cooking' }),
      card({ id: 'b' }),
      card({ id: 'c', product_id: '7', qty: 2 }),
    ])
    expect(baskets).toEqual([{ orderId: 'o1', orderName: 'SO1', lines: [{ order_line_id: 'c', product_id: '7', qty: 2 }] }])
  })
})

describe('mergeStockAlerts', () => {
  const alert = (level, message, product_id = 'i1') => ({ level, message, product_id, name: 'Rice' })

  it('keeps one row per ingredient with the worst level and every order that uses it', () => {
    const rows = mergeStockAlerts([
      { orderName: 'SO1', result: { ok: true, lines: [], stock_alerts: [alert('low', 'Rice low')] } },
      { orderName: 'SO2', result: { ok: true, lines: [], stock_alerts: [alert('out', 'Rice out')] } },
    ])
    expect(rows).toEqual([{ key: 'component:i1', scope: 'component', level: 'out', message: 'Rice out', orders: ['SO1', 'SO2'] }])
  })

  it('treats an alert about a product in the basket as a prep alert, anything else as an ingredient', () => {
    const rows = mergeStockAlerts([
      {
        orderName: 'SO1',
        result: {
          ok: true,
          lines: [{ product_id: 'm1', name: 'Nasi', uom: 'Units', is_available: true, shortage_qty: 0 }],
          stock_alerts: [alert('low', 'Rice low'), alert('low', 'Nasi: only 3 prepped left', 'm1')],
        },
      },
    ])
    expect(rows.map((r) => [r.key, r.scope])).toEqual([
      ['component:i1', 'component'],
      ['product:m1', 'product'],
    ])
  })

  it('merges a short product line into its prep alert, worst first', () => {
    const rows = mergeStockAlerts([
      {
        orderName: 'SO1',
        result: {
          ok: false,
          stock_alerts: [alert('low', 'Rice low'), alert('out', 'Latte: prep 1 more', 'm1')],
          lines: [
            { product_id: 'm1', name: 'Latte', uom: 'Units', is_available: false, shortage_qty: 1 },
            { product_id: 'm2', name: 'Tea', uom: 'Units', is_available: true, shortage_qty: 0 },
          ],
        },
      },
    ])
    expect(rows.map((r) => [r.key, r.level, r.message])).toEqual([
      ['product:m1', 'insufficient', 'Latte is short by 1 Units.'],
      ['component:i1', 'low', 'Rice low'],
    ])
  })
})
