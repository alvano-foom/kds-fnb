import { MockKitchenWebSocket } from '../api/mocks/wsMock'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8787/ws'

const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30_000
const ATTEMPTS_BEFORE_POLLING = 3

/**
 * Thin reconnect/backoff wrapper around WebSocket, per docs/websocket-events.md.
 * Swaps in the in-browser mock when VITE_USE_MOCKS=true — everything else
 * about this class is identical against the real gateway.
 */
export class KitchenSocket {
  constructor({ companyId, getToken, onEvent, onStatusChange }) {
    this.companyId = companyId
    this.getToken = getToken
    this.onEvent = onEvent
    this.onStatusChange = onStatusChange
    this.attempts = 0
    this.socket = null
    this.closedByClient = false
  }

  connect() {
    this.closedByClient = false
    if (this.attempts <= ATTEMPTS_BEFORE_POLLING) {
      this._setStatus(this.attempts === 0 ? 'connecting' : 'reconnecting')
    }

    const token = this.getToken()
    const url = `${WS_URL}?company_id=${this.companyId}&token=${encodeURIComponent(token ?? '')}`
    const Impl = USE_MOCKS ? MockKitchenWebSocket : WebSocket
    this.socket = new Impl(url)

    this.socket.onopen = () => {
      this.attempts = 0
      this._setStatus('connected')
    }

    this.socket.onmessage = (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        return // malformed frame, ignore
      }
      if (message.type !== 'ping') this.onEvent?.(message)
    }

    this.socket.onclose = (event) => {
      if (this.closedByClient) return
      if (event?.code === 4401) this.onEvent?.({ type: '__token_expired__' })
      this._scheduleReconnect()
    }
  }

  close() {
    this.closedByClient = true
    this.socket?.close()
  }

  _scheduleReconnect() {
    this.attempts += 1
    if (this.attempts > ATTEMPTS_BEFORE_POLLING) this._setStatus('polling')
    const delay = Math.min(BACKOFF_BASE_MS * 2 ** (this.attempts - 1), BACKOFF_MAX_MS)
    const withJitter = delay * (0.8 + Math.random() * 0.4)
    setTimeout(() => {
      if (!this.closedByClient) this.connect()
    }, withJitter)
  }

  _setStatus(status) {
    this.onStatusChange?.(status)
  }
}
