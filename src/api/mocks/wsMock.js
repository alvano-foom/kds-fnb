import { mockOrders, nextLineId, toOrderLineCard } from './fixtures'

const STATE_CYCLE = ['pending', 'cooking', 'ready', 'served']

/**
 * A drop-in stand-in for the browser `WebSocket` class, matching just the
 * surface `src/ws/kitchenSocket.js` uses (onopen/onmessage/onclose, send,
 * close, readyState). Lets the whole realtime flow — including reconnect
 * and the polling fallback — be exercised with zero backend.
 *
 * Debug hook: `window.__kdsMockWs.forceClose()` from devtools simulates an
 * abrupt disconnect to watch the reconnect/backoff/polling UI kick in.
 */
export class MockKitchenWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  constructor(url) {
    this.url = url
    this.readyState = MockKitchenWebSocket.CONNECTING
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null

    const params = new URL(url, 'ws://mock').searchParams
    this.companyId = params.get('company_id')
    const token = params.get('token')

    this._openTimer = setTimeout(() => {
      if (!token) {
        this._emitClose(4401, 'missing or expired token')
        return
      }
      this.readyState = MockKitchenWebSocket.OPEN
      this.onopen?.(new Event('open'))
      this._scheduleHeartbeat()
      this._scheduleEvent()
    }, 150)

    if (typeof window !== 'undefined') window.__kdsMockWs = this
  }

  send() {
    // v1 contract has no required client -> server messages.
  }

  close() {
    clearTimeout(this._openTimer)
    clearTimeout(this._heartbeatTimer)
    clearTimeout(this._eventTimer)
    this._emitClose(1000, 'client closed')
  }

  /** Debug helper: simulate the network dropping. */
  forceClose() {
    clearTimeout(this._heartbeatTimer)
    clearTimeout(this._eventTimer)
    this._emitClose(1006, 'simulated abnormal closure')
  }

  _emitClose(code, reason) {
    if (this.readyState === MockKitchenWebSocket.CLOSED) return
    this.readyState = MockKitchenWebSocket.CLOSED
    this.onclose?.({ code, reason })
  }

  _send(payload) {
    if (this.readyState !== MockKitchenWebSocket.OPEN) return
    this.onmessage?.({ data: JSON.stringify(payload) })
  }

  _scheduleHeartbeat() {
    this._heartbeatTimer = setTimeout(() => {
      this._send({ type: 'ping', data: { ts: Date.now() } })
      this._scheduleHeartbeat()
    }, 25_000)
  }

  _scheduleEvent() {
    const delay = 4000 + Math.random() * 5000
    this._eventTimer = setTimeout(() => {
      this._emitRandomEvent()
      this._scheduleEvent()
    }, delay)
  }

  _scopedOrders() {
    return mockOrders.filter((o) => o.company_id === this.companyId)
  }

  _emitRandomEvent() {
    const scopedOrders = this._scopedOrders()
    if (scopedOrders.length === 0) return

    const spawnNew = Math.random() < 0.2
    if (spawnNew) {
      const order = scopedOrders[Math.floor(Math.random() * scopedOrders.length)]
      const line = {
        id: nextLineId(),
        product_name: 'Iced Lemon Tea',
        qty: 1,
        kitchen_state: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      order.lines.push(line)
      this._send({ type: 'order_line.created', data: toOrderLineCard(order, line) })
      return
    }

    const candidates = scopedOrders.flatMap((order) => order.lines.map((line) => ({ order, line })))
    if (candidates.length === 0) return
    const { order, line } = candidates[Math.floor(Math.random() * candidates.length)]
    const nextIndex = Math.min(STATE_CYCLE.indexOf(line.kitchen_state) + 1, STATE_CYCLE.length - 1)
    line.kitchen_state = STATE_CYCLE[nextIndex]
    line.updated_at = new Date().toISOString()
    this._send({ type: 'order_line.updated', data: toOrderLineCard(order, line) })
  }
}
