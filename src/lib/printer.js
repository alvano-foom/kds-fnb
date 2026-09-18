// Direct-to-printer Bluetooth kitchen tickets, using raw ESC/POS commands
// over Web Bluetooth (BLE/GATT) — no OS print driver, no print dialog.
// This is *additive* to src/lib/receipt.js's window.print() flow: pairing
// here is opt-in (see PrinterConfig.jsx), and OrderCard.jsx falls back to
// the print dialog whenever no Bluetooth printer is connected or a write
// fails, so nothing here can break printing for anyone who hasn't paired
// a printer.
//
// Three real platform constraints worth knowing before touching this file:
//
// 1. Web Bluetooth only reaches Bluetooth LOW ENERGY (BLE/GATT) devices —
//    never classic Bluetooth/SPP, which is what a large share of cheap
//    58mm/80mm receipt printers actually use. A classic-only printer will
//    simply never appear in the pairing chooser; that's not a bug here,
//    it's the browser API's own scope. There's no code-level workaround —
//    the only fixes are a different (BLE) printer, or driving the printer
//    from a native/bridge app instead of the browser.
//
// 2. Web Bluetooth requires a secure context (https:, or http://localhost)
//    and pairPrinter() must be called from a real user gesture (a click),
//    both enforced by Chrome itself.
//
// 3. Chrome can only use a GATT service whose UUID was declared up front
//    in `optionalServices` when pairing — there is no "list everything
//    this device has" API. KNOWN_PRINTER_SERVICES below is the set of
//    service UUIDs most generic/no-name BLE thermal printers and
//    BLE-serial modules (the chips a lot of cheap printers are built on)
//    actually expose in practice. A printer using some other, proprietary
//    UUID won't be found until that UUID is added to this list — if
//    pairing succeeds but printing doesn't, that's the next thing to
//    check (the printer vendor's SDK/app usually documents it).
export const KNOWN_PRINTER_SERVICES = [
  { label: 'Generic printer service (18F0)', service: '000018f0-0000-1000-8000-00805f9b34fb' },
  { label: 'BLE-serial module (FFE0, "HM-10 style")', service: '0000ffe0-0000-1000-8000-00805f9b34fb' },
  { label: 'Nordic UART Service', service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e' },
  { label: 'ISSC transparent UART', service: '49535343-fe7d-4ae5-8fa9-9fafd205e455' },
]

const CHUNK_SIZE = 20 // conservative: default BLE ATT MTU (23 bytes) minus a 3-byte header
const CHUNK_DELAY_MS = 20 // cheap BLE printers reliably drop bytes without a small gap between writes

export class PrinterError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'PrinterError'
    this.code = code
  }
}

export function isBluetoothSupported() {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

/**
 * Opens the browser's device chooser, connects, and finds the first
 * writable characteristic among KNOWN_PRINTER_SERVICES. Must be called
 * from a user gesture (e.g. a button's onClick).
 *
 * Throws the browser's own error unchanged if the person cancels the
 * chooser (err.name === 'NotFoundError') — callers should treat that as
 * "nothing happened", not a failure to surface. Throws PrinterError for
 * everything else this module can identify.
 */
export async function pairPrinter() {
  if (!isBluetoothSupported()) {
    throw new PrinterError(
      'unsupported',
      "This browser doesn't support Web Bluetooth. Use Chrome or Edge on desktop or Android — Safari/iOS can't do this at all.",
    )
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: KNOWN_PRINTER_SERVICES.map((s) => s.service),
  })

  const server = await device.gatt.connect()
  const found = await findWritableCharacteristic(server)
  if (!found) {
    device.gatt.disconnect()
    throw new PrinterError(
      'no_known_service',
      `Paired with "${device.name || 'the device'}", but none of the print services this app ` +
        'knows about were found on it. It may use a different BLE service UUID — check the ' +
        'printer\'s own app/SDK documentation for it.',
    )
  }
  return { device, ...found }
}

async function findWritableCharacteristic(server) {
  for (const { label, service } of KNOWN_PRINTER_SERVICES) {
    let svc
    try {
      svc = await server.getPrimaryService(service)
    } catch {
      continue // this device doesn't expose this candidate service
    }
    const characteristics = await svc.getCharacteristics()
    const characteristic = characteristics.find((c) => c.properties.write || c.properties.writeWithoutResponse)
    if (characteristic) return { serviceLabel: label, serviceUuid: service, characteristic }
  }
  return null
}

const ESC = 0x1b
const GS = 0x1d

function textBytes(str) {
  return Array.from(new TextEncoder().encode(str))
}

/**
 * Formats one OrderLineCard as raw ESC/POS bytes: centered bold order
 * name, table number, the line item, an optional note, then a cut.
 * Plain ASCII only for now — ESC/POS printers default to codepages like
 * CP437, not UTF-8, so non-ASCII characters (beyond what Indonesian menu
 * names typically need) may print as garbled characters until a codepage
 * select command is added for a specific printer model.
 */
export function buildEscPosReceipt(card) {
  const bytes = []
  const push = (...b) => bytes.push(...b)
  const line = (str = '') => {
    push(...textBytes(str))
    push(0x0a)
  }

  push(ESC, 0x40) // initialize
  push(ESC, 0x61, 0x01) // center align
  push(ESC, 0x45, 0x01) // bold on
  line(card.order_name || '')
  push(ESC, 0x45, 0x00) // bold off
  line(`TABLE ${card.table_number ?? '-'}`)
  line('--------------------------------')
  push(ESC, 0x61, 0x00) // left align
  line(`${card.qty}x ${card.product_name}`)
  if (card.note) line(`  Note: ${card.note}`)
  line('--------------------------------')
  line(`Customer: ${card.customer_name ?? '-'}`)
  line(`Printed: ${new Date().toLocaleString()}`)
  push(0x0a, 0x0a, 0x0a)
  push(GS, 0x56, 0x01) // partial cut — ignored harmlessly by printers with no cutter

  return new Uint8Array(bytes)
}

/** Writes bytes to a GATT characteristic in small chunks — full-size writes get silently dropped on a lot of cheap BLE printers. */
export async function writeBytes(characteristic, bytes) {
  const useWithoutResponse = Boolean(characteristic.properties?.writeWithoutResponse)
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE)
    if (useWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk)
    } else {
      await characteristic.writeValueWithResponse(chunk)
    }
    if (i + CHUNK_SIZE < bytes.length) await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS))
  }
}

/** @param {import('../types').OrderLineCard} card */
export function printViaBluetooth(characteristic, card) {
  if (!characteristic) throw new PrinterError('not_connected', 'No Bluetooth printer connected.')
  return writeBytes(characteristic, buildEscPosReceipt(card))
}

export const TEST_CARD = {
  order_name: 'TEST PRINT',
  table_number: '0',
  qty: 1,
  product_name: 'Bluetooth connection OK',
  customer_name: 'KDS Config',
}

/** Used by the "Send test print" button in PrinterConfig — same path as a real ticket, so a successful test means real tickets will work too. */
export function printTestTicket(characteristic) {
  return printViaBluetooth(characteristic, TEST_CARD)
}

// A software-only stand-in for a real printer: verifies the whole
// auto-print/manual-print pipeline (including the PendingOrderAlerts
// wiring) end to end without needing real BLE hardware in the room, and
// — unlike the print-dialog fallback — never opens any popup, since it
// doesn't call window.print() at all. Selected via "Use Test Printer" in
// PrinterConfig; printCard.js checks isTestPrinterCharacteristic() and
// routes here instead of attempting a real GATT write.
const TEST_PRINTER = Symbol('test-printer')

export function connectTestPrinter() {
  return {
    device: { name: 'Test Printer (simulated)' },
    characteristic: TEST_PRINTER,
    serviceLabel: 'Software target — no hardware, no popup',
    connectionType: 'test',
  }
}

export function isTestPrinterCharacteristic(characteristic) {
  return characteristic === TEST_PRINTER
}

/** Same layout as buildEscPosReceipt, as plain readable lines instead of ESC/POS bytes — what the test printer "prints" to its on-screen log. */
export function formatReceiptPreview(card) {
  const lines = [card.order_name || '', `TABLE ${card.table_number ?? '-'}`, '--------------------------------']
  lines.push(`${card.qty}x ${card.product_name}`)
  if (card.note) lines.push(`  Note: ${card.note}`)
  lines.push('--------------------------------', `Customer: ${card.customer_name ?? '-'}`, `Printed: ${new Date().toLocaleString()}`)
  return lines.join('\n')
}
