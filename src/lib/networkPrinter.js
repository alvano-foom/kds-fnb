// Network printing via printer-bridge/: browsers can't open raw TCP (port 9100), so a LAN bridge
// relays HTTP to the printer. An https page can't call an http bridge (mixed content), so it needs https too.
import { buildEscPosReceipt, TEST_CARD } from './printer'

export class NetworkPrinterError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'NetworkPrinterError'
    this.code = code
  }
}

const PRINT_PATH = '/print'
const STATUS_PATH = '/status'
const PRINTERS_PATH = '/printers'
const TIMEOUT_MS = 5000

const MIXED_CONTENT_HINT =
  'If this app is loaded over https, the bridge needs to serve https too — a plain http bridge is ' +
  'blocked as "mixed content" no matter how local its IP is (see printer-bridge/README.md for a free ' +
  'self-signed certificate). Otherwise check the bridge is running, the IP/port are correct, and this ' +
  'device is on the same network as it.'

// A self-signed cert must be trusted via a direct browser visit; fetch() can't show that prompt.
function certTrustHint({ host, port }) {
  const url = `https://${(host || '').trim()}${port ? `:${port}` : ''}/status`
  return (
    `If this bridge uses a self-signed certificate, this device likely hasn't trusted it yet — open ` +
    `${url} directly in this browser first, click through the "connection isn't private" warning, and ` +
    `confirm it just says ok. That one-time visit is what lets this app's own connection attempts to ` +
    `the same address succeed afterward.`
  )
}

// Permissive on purpose: accepts IPs and hostnames, rejects only things that can't be a host.
export function isLikelyValidHost(host) {
  if (!host || typeof host !== 'string') return false
  const trimmed = host.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  if (/^[a-z]+:\/\//i.test(trimmed)) return false
  return true
}

// `printer` selects one printer on a multi-printer bridge (/print/<name>); blank targets its default.
function buildUrl({ host, port, secure, printer }, path) {
  const scheme = secure ? 'https' : 'http'
  const portPart = port ? `:${port}` : ''
  const printerSegment = path === PRINT_PATH && printer ? `/${encodeURIComponent(printer)}` : ''
  return `${scheme}://${host.trim()}${portPart}${path}${printerSegment}`
}

function requireHost(config) {
  if (!isLikelyValidHost(config?.host)) {
    throw new NetworkPrinterError('invalid_host', "Enter the printer bridge's IP address or hostname first.")
  }
}

async function request(url, options, config) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    if (!res.ok) {
      throw new NetworkPrinterError('http_error', `The bridge at ${url} responded with ${res.status} ${res.statusText}.`)
    }
  } catch (err) {
    if (err instanceof NetworkPrinterError) throw err
    if (err.name === 'AbortError') {
      throw new NetworkPrinterError(
        'timeout',
        `No response from ${url} within ${TIMEOUT_MS / 1000}s — check the bridge is running and the IP/port are correct.`,
      )
    }
    // Mixed content, CORS and an untrusted cert all surface as the same "Failed to fetch".
    const hint = config?.secure ? `${certTrustHint(config)} ${MIXED_CONTENT_HINT}` : MIXED_CONTENT_HINT
    throw new NetworkPrinterError('unreachable', `Could not reach ${url}. ${hint}`)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @param {{host: string, port?: number|string, secure?: boolean, printer?: string}} config
 * @param {import('@/types').OrderLineCard} card
 */
export async function printViaNetwork(config, card) {
  requireHost(config)
  return request(
    buildUrl(config, PRINT_PATH),
    {
      method: 'POST',
      body: buildEscPosReceipt(card),
      headers: { 'Content-Type': 'application/octet-stream' },
    },
    config,
  )
}

/** Reachability check against the bridge's /status; prints nothing. */
export async function checkNetworkBridge(config) {
  requireHost(config)
  return request(buildUrl(config, STATUS_PATH), { method: 'GET' }, config)
}

export function testNetworkConnection(config) {
  return printViaNetwork(config, TEST_CARD)
}

/**
 * Printer names the bridge knows (GET /printers). Best effort: any failure returns [].
 * @param {{host: string, port?: number|string, secure?: boolean}} config
 * @returns {Promise<string[]>}
 */
export async function listBridgePrinters(config) {
  requireHost(config)
  const url = buildUrl(config, PRINTERS_PATH)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return []
    const data = await res.json().catch(() => null)
    return Array.isArray(data?.printers) ? data.printers : []
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}
