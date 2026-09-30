// Network (Wi-Fi/Ethernet) thermal printing over HTTP, via a small local
// "print bridge" program — see printer-bridge/ at the project root for
// that bridge's own code and setup steps.
//
// Two real platform constraints worth knowing before touching this file
// (the same shape of limitation already documented in printer.js for
// Bluetooth — a browser API boundary, not a bug):
//
// 1. Browsers cannot open a raw TCP socket. Network ESC/POS printers
//    (and basically every "JetDirect"/raw-socket network printer)
//    expect bytes on a raw TCP port — almost always 9100 — and there is
//    no browser API, ever, on any page, that can connect to a TCP port
//    directly. The only way to reach one of these printers from a web
//    page is a small bridge process, on the same network as the printer,
//    that accepts an HTTP request and relays it to the printer's TCP
//    socket. That's what printer-bridge/bridge.js is.
//
// 2. This app is served over https (Vercel, or any real domain). A page
//    loaded over https cannot fetch() a plain http:// URL — Chrome blocks
//    it outright as mixed content, no matter how "local" the target IP
//    is. So the bridge itself needs to serve https too (a free
//    self-signed certificate is enough — see printer-bridge/README.md
//    for how to generate one and accept it once per browser/device).
//    There's no way around this from application code on either side.
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

// Same underlying cause the generic hint above already covers, but this is
// specifically the single most common reason a *secure* bridge fails on a
// device that hasn't been used with it before: a self-signed certificate's
// trust exception has to be granted by a direct browser visit — a page's
// own fetch() can't trigger or pass through that "unsafe, proceed anyway"
// prompt the way a real navigation can. Surfaced separately (only when
// secure=true) since it's the answer often enough to be worth naming
// outright rather than leaving it as one clause inside the general hint.
function certTrustHint({ host, port }) {
  const url = `https://${(host || '').trim()}${port ? `:${port}` : ''}/status`
  return (
    `If this bridge uses a self-signed certificate, this device likely hasn't trusted it yet — open ` +
    `${url} directly in this browser first, click through the "connection isn't private" warning, and ` +
    `confirm it just says ok. That one-time visit is what lets this app's own connection attempts to ` +
    `the same address succeed afterward.`
  )
}

// Deliberately permissive — a bridge on a LAN is commonly addressed by a
// bare IPv4 address, but nothing stops someone running it behind a
// hostname (a router's local DNS, a Tailscale name, etc.), so this only
// rejects strings with no chance of being a host at all.
export function isLikelyValidHost(host) {
  if (!host || typeof host !== 'string') return false
  const trimmed = host.trim()
  if (!trimmed || /\s/.test(trimmed)) return false
  if (/^[a-z]+:\/\//i.test(trimmed)) return false
  return true
}

// A bridge process can relay to more than one physical printer at once
// (see printer-bridge/README.md's "Multiple printers" section) —
// `printer`, when set, picks which one by appending it to the print path
// as `/print/<name>`. Left blank, `/print` targets the bridge's single
// printer (or its "default" one, for a bridge still started the old,
// single-printer way) — this is what keeps existing saved profiles
// working unchanged.
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
    // A generic "Failed to fetch" TypeError is what mixed-content blocking,
    // a CORS rejection, and an untrusted self-signed certificate all look
    // like from here — the browser deliberately hides which one actually
    // happened. When this was an https request, lead with the cert-trust
    // explanation specifically, since it's the single most common cause on
    // a device that hasn't used this bridge before; keep the general hint
    // too, since it's still one of the other two possible causes.
    const hint = config?.secure ? `${certTrustHint(config)} ${MIXED_CONTENT_HINT}` : MIXED_CONTENT_HINT
    throw new NetworkPrinterError('unreachable', `Could not reach ${url}. ${hint}`)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Sends one ticket's raw ESC/POS bytes to the print bridge over HTTP.
 * @param {{host: string, port?: number|string, secure?: boolean, printer?: string}} config
 *   `printer` selects which physical printer on a multi-printer bridge —
 *   see buildUrl() above. Omit it for a bridge with just one printer.
 * @param {import('../types').OrderLineCard} card
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

/** Lightweight reachability check for the "Connect" button (and the settings form's automatic check as you type — see PrinterConfig.jsx) — hits the bridge's own /status, doesn't print anything or touch the printer. Bridge-level (not printer-specific) even when the bridge relays to several printers. */
export async function checkNetworkBridge(config) {
  requireHost(config)
  return request(buildUrl(config, STATUS_PATH), { method: 'GET' }, config)
}

/** Same ticket the Bluetooth/Test Printer "Send test print" buttons use, sent over the network path instead. */
export function testNetworkConnection(config) {
  return printViaNetwork(config, TEST_CARD)
}

/**
 * Asks a bridge which printer names it knows about (its `GET /printers`
 * endpoint — see printer-bridge/bridge.js), so the "Printer name on this
 * bridge" field in Settings can offer them instead of making someone type
 * (and possibly mistype) a name they set up on the bridge computer.
 * Returns an empty array for an older bridge with no /printers route, or
 * one that genuinely has nothing configured — this is a convenience, not
 * something callers should treat as authoritative or required to succeed.
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
    // Timeout, unreachable, old bridge with no /printers route, bad JSON —
    // all the same "can't offer suggestions right now" outcome here.
    return []
  } finally {
    clearTimeout(timer)
  }
}
