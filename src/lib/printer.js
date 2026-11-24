// ESC/POS tickets over Web Bluetooth. Platform limits: BLE/GATT only (classic SPP printers never show
// up), needs a secure context + user gesture, and only services listed in optionalServices are usable.

import { ticketLines } from './orderGroups'

// Chrome cannot enumerate GATT services; a printer with another UUID needs it added here.
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
 * Opens the device chooser and finds a writable characteristic. Must run from a user gesture.
 * A cancelled chooser rethrows the browser's NotFoundError unchanged; treat it as a no-op.
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

/** ESC/POS bytes for one ticket. Printers default to CP437, so non-ASCII text may print garbled. */
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
  for (const item of ticketLines(card)) {
    line(`${item.qty}x ${item.product_name}`)
    if (item.note) line(`  Note: ${item.note}`)
  }
  line('--------------------------------')
  line(`Customer: ${card.customer_name ?? '-'}`)
  line(`Printed: ${new Date().toLocaleString()}`)
  push(0x0a, 0x0a, 0x0a)
  push(GS, 0x56, 0x01) // partial cut — ignored harmlessly by printers with no cutter

  return new Uint8Array(bytes)
}

/** Chunked writes: full-size writes get silently dropped by many cheap BLE printers. */
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

/** @param {import('@/types').OrderLineCard} card */
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

/** Same path as a real ticket, so a successful test means real tickets work too. */
export function printTestTicket(characteristic) {
  return printViaBluetooth(characteristic, TEST_CARD)
}

// Simulated printer: exercises the whole print pipeline without hardware or a print popup.
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

/** Plain-text version of buildEscPosReceipt, shown in the test printer's log. */
export function formatReceiptPreview(card) {
  const lines = [card.order_name || '', `TABLE ${card.table_number ?? '-'}`, '--------------------------------']
  for (const item of ticketLines(card)) {
    lines.push(`${item.qty}x ${item.product_name}`)
    if (item.note) lines.push(`  Note: ${item.note}`)
  }
  lines.push('--------------------------------', `Customer: ${card.customer_name ?? '-'}`, `Printed: ${new Date().toLocaleString()}`)
  return lines.join('\n')
}
