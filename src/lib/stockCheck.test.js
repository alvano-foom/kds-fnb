import { describe, expect, it } from 'vitest'
import { mergeStockAlerts, pendingOrderBaskets } from './stockCheck'

const card = (over) => ({ order_id: 'o1', order_name: 'SO1', kitchen_state: 'pending', qty: 1, ...over })

describe('pendingOrderBaskets', () => {
  it('groups pending lines per order and sums the same barcode', () => {
    const baskets = pendingOrderBaskets([
      card({ id: 'a', barcode: 'NG001', qty: 2 }),
      card({ id: 'b', barcode: 'NG001', qty: 1 }),
      card({ id: 'c', barcode: 'NU001' }),
      card({ id: 'd', order_id: 'o2', order_name: 'SO2', barcode: 'NG001', qty: 4 }),
    ])
    expect(baskets).toEqual([
      { orderId: 'o1', orderName: 'SO1', lines: [{ barcode: 'NG001', qty: 3 }, { barcode: 'NU001', qty: 1 }] },
      { orderId: 'o2', orderName: 'SO2', lines: [{ barcode: 'NG001', qty: 4 }] },
    ])
  })

  it('skips lines that are not pending or have no barcode or product_id, and falls back to product_id', () => {
    const baskets = pendingOrderBaskets([
      card({ id: 'a', barcode: 'NG001', kitchen_state: 'cooking' }),
      card({ id: 'b' }),
      card({ id: 'c', product_id: '7', qty: 2 }),
    ])
    expect(baskets).toEqual([{ orderId: 'o1', orderName: 'SO1', lines: [{ product_id: '7', qty: 2 }] }])
  })
})

describe('mergeStockAlerts', () => {
  const alert = (level, message, product_id = 'i1') => ({ level, message, product_id, name: 'Rice' })

  it('keeps one row per ingredient with the worst level and every order that uses it', () => {
    const rows = mergeStockAlerts([
      { orderName: 'SO1', result: { ok: true, lines: [], stock_alerts: [alert('low', 'Rice low')] } },
      { orderName: 'SO2', result: { ok: true, lines: [], stock_alerts: [alert('out', 'Rice out')] } },
    ])
    expect(rows).toEqual([{ key: 'ingredient:i1', level: 'out', message: 'Rice out', orders: ['SO1', 'SO2'] }])
  })

  it('adds unavailable products and sorts worst first', () => {
    const rows = mergeStockAlerts([
      {
        orderName: 'SO1',
        result: {
          ok: false,
          stock_alerts: [alert('low', 'Rice low')],
          lines: [
            { product_id: 'm1', name: 'Latte', uom: 'Units', is_available: false, shortage_qty: 1 },
            { product_id: 'm2', name: 'Tea', uom: 'Units', is_available: true, shortage_qty: 0 },
          ],
        },
      },
    ])
    expect(rows.map((r) => [r.level, r.message])).toEqual([
      ['insufficient', 'Latte is short by 1 Units.'],
      ['low', 'Rice low'],
    ])
  })
})
