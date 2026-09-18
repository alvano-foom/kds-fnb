// Hands a print job off to a native Android companion app (see
// printer-service-main, alongside this repo) via a custom URL-scheme
// intent, instead of talking to the printer over Web Bluetooth or the
// network directly. This exists specifically for the case neither of
// those can reach at all: a classic-Bluetooth-only printer (like the
// iWare RPP02N) never shows up in Web Bluetooth's BLE-only pairing
// chooser, but a native Android app has no such restriction. It also
// lets a network printer be reached with zero separate bridge computer,
// since the printing happens on the very same Android tablet the KDS
// board's browser is already running on.
//
// Two constraints worth knowing before touching this file:
//
// 1. This only works when the KDS page and the companion app are on the
//    SAME Android device — nothing crosses the network here at all,
//    unlike networkPrinter.js's HTTP bridge. A Windows PC (e.g. the
//    board display) has no equivalent and must keep using Bluetooth or
//    the network bridge instead.
// 2. Chrome on Android generally requires navigating to a non-http(s)
//    URL like this to originate from a real user gesture (a click).
//    This should reliably work from the manual Print button (its click
//    handler calls straight into this). Whether it also fires reliably
//    for the automatic "print the moment an order goes pending" path —
//    which runs from a data-change effect, not a click — has NOT been
//    verified on a real device; Chrome's gesture requirements for
//    intent:// navigation have tightened over the years. Test both
//    paths on the actual tablet before relying on auto-print with this
//    connection type.
import { buildEscPosReceipt } from './printer'

// Must match applicationId in printer-service-main/app/build.gradle.kts.
const ANDROID_PACKAGE = 'com.surahman.pos.support'

export class AndroidPrintBridgeError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AndroidPrintBridgeError'
    this.code = code
  }
}

export function isProbablyAndroid() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '')
}

function base64FromBytes(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/**
 * Builds the `intent://` URL Chrome-on-Android hands off to the
 * companion app. Using the `intent://...#Intent;...;end` form (rather
 * than a bare `kdsprint://...` URL) rather than a bare custom-scheme
 * navigation is what lets a `browser_fallback_url` be given — if the
 * companion app isn't installed on this tablet, Chrome returns to that
 * URL (here, the KDS page itself) instead of showing a raw
 * "can't find app" error page in place of the board.
 */
function buildIntentUrl(payload) {
  const encodedData = encodeURIComponent(JSON.stringify(payload))
  const fallback = encodeURIComponent(window.location.href)
  return (
    `intent://print?data=${encodedData}#Intent;scheme=kdsprint;package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`
  )
}

/**
 * @param {{ transport: 'bluetooth'|'network', mac?: string, host?: string, port?: string|number }} config
 * @param {import('../types').OrderLineCard} card
 */
export function printViaAndroidBridge(config, card) {
  if (config?.transport === 'bluetooth' && !config.mac?.trim()) {
    return Promise.reject(new AndroidPrintBridgeError('invalid_config', "Enter the printer's Bluetooth address first."))
  }
  if (config?.transport === 'network' && !config.host?.trim()) {
    return Promise.reject(new AndroidPrintBridgeError('invalid_config', "Enter the printer's IP address first."))
  }

  const bytes = buildEscPosReceipt(card)
  const payload = {
    type: 'raw_escpos',
    transport: config.transport,
    mac: config.transport === 'bluetooth' ? config.mac : undefined,
    host: config.transport === 'network' ? config.host : undefined,
    port: config.transport === 'network' ? Number(config.port) || 9100 : undefined,
    dataBase64: base64FromBytes(bytes),
  }

  // Fire-and-forget by nature: an intent hand-off has no promise/callback
  // path back into the page (the companion app is designed to print then
  // background itself — see MainActivity.kt's scheduleReturnToKds — but
  // that result never reaches this JS). So unlike printViaBluetooth/
  // printViaNetwork, this always resolves once the navigation is issued;
  // it cannot report success or failure of the actual print.
  window.location.href = buildIntentUrl(payload)
  return Promise.resolve()
}
