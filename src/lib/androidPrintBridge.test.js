import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AndroidPrintBridgeError, isProbablyAndroid, printViaAndroidBridge } from './androidPrintBridge'

const card = { id: 'l1', order_name: 'SO0231', product_name: 'Fried Rice', qty: 2 }

// jsdom doesn't actually perform navigation for unrecognized schemes like
// intent:// — assigning window.location.href silently no-ops instead of
// reflecting the value (confirmed: it logs "Not implemented: navigation to
// another Document" and leaves location unchanged). Swapping in a plain
// mutable object for the duration of this file is the standard workaround,
// letting the module under test do a completely ordinary `location.href =`
// assignment while the test can still read back what was written.
let realLocation

beforeEach(() => {
  realLocation = window.location
  delete window.location
  window.location = { href: 'https://kds-omega.vercel.app/board' }
})

afterEach(() => {
  window.location = realLocation
})

function decodePayload() {
  const match = window.location.href.match(/data=([^#]+)/)
  return JSON.parse(decodeURIComponent(match[1]))
}

describe('printViaAndroidBridge', () => {
  it('rejects without navigating when a Bluetooth transport has no mac configured', async () => {
    const before = window.location.href
    await expect(printViaAndroidBridge({ transport: 'bluetooth', mac: '' }, card)).rejects.toBeInstanceOf(AndroidPrintBridgeError)
    expect(window.location.href).toBe(before)
  })

  it('rejects without navigating when a network transport has no host configured', async () => {
    const before = window.location.href
    await expect(printViaAndroidBridge({ transport: 'network', host: '' }, card)).rejects.toBeInstanceOf(AndroidPrintBridgeError)
    expect(window.location.href).toBe(before)
  })

  it('navigates to an intent:// URL naming the companion app and scheme', async () => {
    await printViaAndroidBridge({ transport: 'bluetooth', mac: 'AA:BB:CC:DD:EE:FF' }, card)

    expect(window.location.href).toMatch(/^intent:\/\/print\?data=/)
    expect(window.location.href).toContain('scheme=kdsprint')
    expect(window.location.href).toContain('package=com.surahman.pos.support')
    expect(window.location.href).toContain('browser_fallback_url=')
  })

  it('encodes the Bluetooth transport, mac, and base64 ESC/POS bytes in the payload', async () => {
    await printViaAndroidBridge({ transport: 'bluetooth', mac: 'AA:BB:CC:DD:EE:FF' }, card)

    const payload = decodePayload()
    expect(payload.type).toBe('raw_escpos')
    expect(payload.transport).toBe('bluetooth')
    expect(payload.mac).toBe('AA:BB:CC:DD:EE:FF')
    expect(payload.host).toBeUndefined()
    expect(typeof payload.dataBase64).toBe('string')
    expect(atob(payload.dataBase64)).toContain('SO0231')
  })

  it('encodes the network transport, host, and port in the payload', async () => {
    await printViaAndroidBridge({ transport: 'network', host: '192.168.1.50', port: '9100' }, card)

    const payload = decodePayload()
    expect(payload.transport).toBe('network')
    expect(payload.host).toBe('192.168.1.50')
    expect(payload.port).toBe(9100)
    expect(payload.mac).toBeUndefined()
  })

  it('defaults a missing/invalid network port to 9100', async () => {
    await printViaAndroidBridge({ transport: 'network', host: '192.168.1.50', port: '' }, card)
    expect(decodePayload().port).toBe(9100)
  })
})

describe('isProbablyAndroid', () => {
  it('reflects the user agent string', () => {
    const original = navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 13) Chrome', configurable: true })
    expect(isProbablyAndroid()).toBe(true)
    Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true })
  })
})
