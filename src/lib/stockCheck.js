/**
 * @typedef {'insufficient'|'out'|'low'} AlertLevel
 * @typedef {'component'|'product'} AlertScope  product = the dish's own (prepped) stock
 * @typedef {{scope?: AlertScope, level: AlertLevel, message: string, product_id: string, name: string}} StockAlert
 * @typedef {{barcode: string, product_id: string, name: string, uom: string, is_available: boolean, shortage_qty: number}} StockCheckLine
 * @typedef {{ok: boolean, lines: StockCheckLine[], stock_alerts?: StockAlert[]}} StockCheckResult
 * @typedef {{key: string, scope: AlertScope, level: AlertLevel, message: string, orders: string[]}} BoardStockAlert
 */

export const ALERT_LEVELS = /** @type {const} */ (['insufficient', 'out', 'low'])

/**
 * Pending lines grouped per order, each as a /stock/check basket. Every line carries
 * its order_line_id so Odoo counts only the part it has not reserved yet.
 * Lines without barcode or product_id are skipped.
 */
export function pendingOrderBaskets(cards) {
  const byOrder = new Map()
  for (const card of cards) {
    if (card.kitchen_state !== 'pending' || !(Number(card.qty) > 0)) continue
    if (!card.barcode && !card.product_id) continue
    if (!byOrder.has(card.order_id)) {
      byOrder.set(card.order_id, { orderId: card.order_id, orderName: card.order_name, lines: [] })
    }
    byOrder.get(card.order_id).lines.push({
      order_line_id: card.id,
      ...(card.barcode ? { barcode: card.barcode } : { product_id: card.product_id }),
      qty: Number(card.qty),
    })
  }
  return [...byOrder.values()]
}

/**
 * Merge per-order results into one list: one row per ingredient (worst level wins),
 * plus a row for each finished product that is short. Worst first.
 * @param {{orderName: string, result: StockCheckResult}[]} checks
 * @returns {BoardStockAlert[]}
 */
export function mergeStockAlerts(checks) {
  const rows = new Map()
  const add = (scope, productId, level, message, orderName) => {
    const key = `${scope}:${productId}`
    const row = rows.get(key)
    if (!row) {
      rows.set(key, { key, scope, level, message, orders: [orderName] })
      return
    }
    if (ALERT_LEVELS.indexOf(level) < ALERT_LEVELS.indexOf(row.level)) Object.assign(row, { level, message })
    if (!row.orders.includes(orderName)) row.orders.push(orderName)
  }

  for (const { orderName, result } of checks) {
    for (const alert of result.stock_alerts ?? []) {
      add(alert.scope === 'product' ? 'product' : 'component', alert.product_id, alert.level, alert.message, orderName)
    }
    for (const line of result.lines ?? []) {
      if (line.is_available) continue
      const short = `${line.shortage_qty} ${line.uom}`.trim()
      add('product', line.product_id, 'insufficient', `${line.name} is short by ${short}.`, orderName)
    }
  }
  return [...rows.values()].sort((a, b) => ALERT_LEVELS.indexOf(a.level) - ALERT_LEVELS.indexOf(b.level))
}
