import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildEscPosReceipt, isBluetoothSupported, pairPrinter, printViaBluetooth, writeBytes } from './printer'

const card = {
  order_name: 'SO0229',
  table_number: '12',
  customer_name: 'Claire',
  product_name: 'Chicken Satay',
  qty: 3,
}

function textFromBytes(bytes) {
  return new TextDecoder().decode(bytes)
}

describe('isBluetoothSupported', () => {
  afterEach(() => {
    delete navigator.bluetooth
  })

  it('is false when navigator.bluetooth is absent (e.g. Safari)', () => {
    expect(isBluetoothSupported()).toBe(false)
  })

  it('is true when navigator.bluetooth exists', () => {
    navigator.bluetooth = {}
    expect(isBluetoothSupported()).toBe(true)
  })
})

describe('buildEscPosReceipt', () => {
  it('starts with the ESC/POS init sequence and ends with a cut command', () => {
    const bytes = buildEscPosReceipt(card)
    expect(bytes[0]).toBe(0x1b) // ESC
    expect(bytes[1]).toBe(0x40) // @
    expect(bytes.slice(-3)).toEqual(new Uint8Array([0x1d, 0x56, 0x01])) // GS V 1 (partial cut)
  })

  it('includes the order name, table, and line item as readable text', () => {
    const text = textFromBytes(buildEscPosReceipt(card))
    expect(text).toContain('SO0229')
    expect(text).toContain('TABLE 12')
    expect(text).toContain('3x Chicken Satay')
    expect(text).toContain('Claire')
  })

  it('includes a note line only when the card has one', () => {
    expect(textFromBytes(buildEscPosReceipt(card))).not.toContain('Note:')
    expect(textFromBytes(buildEscPosReceipt({ ...card, note: 'No peanuts' }))).toContain('Note: No peanuts')
  })
})

describe('writeBytes', () => {
  it('splits a long payload into MTU-safe chunks and writes them in order', async () => {
    vi.useFakeTimers()
    const written = []
    const characteristic = {
      properties: { writeWithoutResponse: true },
      writeValueWithoutResponse: vi.fn((chunk) => {
        written.push(...chunk)
        return Promise.resolve()
      }),
    }
    const bytes = new Uint8Array(45).map((_, i) => i) // > one 20-byte chunk

    const promise = writeBytes(characteristic, bytes)
    await vi.runAllTimersAsync()
    await promise

    expect(characteristic.writeValueWithoutResponse).toHaveBeenCalledTimes(3) // 20 + 20 + 5
    expect(written).toEqual(Array.from(bytes)) // nothing dropped or reordered
    vi.useRealTimers()
  })

  it('uses writeValueWithResponse when writeWithoutResponse is not supported', async () => {
    const characteristic = {
      properties: { writeWithoutResponse: false, write: true },
      writeValueWithResponse: vi.fn().mockResolvedValue(undefined),
    }
    await writeBytes(characteristic, new Uint8Array([1, 2, 3]))
    expect(characteristic.writeValueWithResponse).toHaveBeenCalledOnce()
  })
})

describe('printViaBluetooth', () => {
  it('throws when no characteristic is connected', () => {
    expect(() => printViaBluetooth(null, card)).toThrow(/no bluetooth printer connected/i)
  })

  it('writes the receipt bytes to the given characteristic', async () => {
    const characteristic = {
      properties: { writeWithoutResponse: true },
      writeValueWithoutResponse: vi.fn().mockResolvedValue(undefined),
    }
    await printViaBluetooth(characteristic, card)
    expect(characteristic.writeValueWithoutResponse).toHaveBeenCalled()
  })
})

describe('pairPrinter', () => {
  afterEach(() => {
    delete navigator.bluetooth
  })

  it('rejects with PrinterError when Web Bluetooth is unsupported', async () => {
    await expect(pairPrinter()).rejects.toThrow(/doesn't support web bluetooth/i)
  })

  it('finds the first known service with a writable characteristic', async () => {
    const writableChar = { properties: { write: true } }
    const service = { getCharacteristics: vi.fn().mockResolvedValue([{ properties: {} }, writableChar]) }
    const server = {
      // Only the second known service (FFE0) exists on this fake device —
      // the first lookup should be tried and fail before this one is found.
      getPrimaryService: vi.fn((uuid) =>
        uuid === '0000ffe0-0000-1000-8000-00805f9b34fb' ? Promise.resolve(service) : Promise.reject(new Error('not found')),
      ),
    }
    const device = { name: 'Cheap Printer', gatt: { connect: vi.fn().mockResolvedValue(server) } }
    navigator.bluetooth = { requestDevice: vi.fn().mockResolvedValue(device) }

    const result = await pairPrinter()

    expect(result.device).toBe(device)
    expect(result.characteristic).toBe(writableChar)
    expect(result.serviceLabel).toMatch(/ffe0/i)
  })

  it('disconnects and throws a descriptive PrinterError when no known service matches', async () => {
    const server = { getPrimaryService: vi.fn().mockRejectedValue(new Error('nope')) }
    const gatt = { connect: vi.fn().mockResolvedValue(server), disconnect: vi.fn() }
    const device = { name: 'Mystery Printer', gatt }
    navigator.bluetooth = { requestDevice: vi.fn().mockResolvedValue(device) }

    await expect(pairPrinter()).rejects.toThrow(/mystery printer/i)
    expect(gatt.disconnect).toHaveBeenCalledOnce()
  })

  it('propagates the browser\'s own cancellation error unchanged, for the caller to treat as a no-op', async () => {
    const cancelled = Object.assign(new Error('cancelled'), { name: 'NotFoundError' })
    navigator.bluetooth = { requestDevice: vi.fn().mockRejectedValue(cancelled) }

    await expect(pairPrinter()).rejects.toBe(cancelled)
  })
})
