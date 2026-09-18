import { afterEach, describe, expect, it, vi } from 'vitest'
import { printCard } from './printCard'
import { printReceipt } from './receipt'
import { connectTestPrinter, printViaBluetooth } from './printer'
import { printViaNetwork } from './networkPrinter'
import { printViaAndroidBridge } from './androidPrintBridge'
import { usePrinterStore } from '../store/printerStore'
import { useErrorLogStore } from '../store/errorLogStore'

vi.mock('./receipt', () => ({ printReceipt: vi.fn() }))
vi.mock('./printer', async () => {
  const actual = await vi.importActual('./printer')
  return { ...actual, printViaBluetooth: vi.fn() }
})
vi.mock('./networkPrinter', async () => {
  const actual = await vi.importActual('./networkPrinter')
  return { ...actual, printViaNetwork: vi.fn() }
})
vi.mock('./androidPrintBridge', async () => {
  const actual = await vi.importActual('./androidPrintBridge')
  return { ...actual, printViaAndroidBridge: vi.fn() }
})

const card = { id: 'l1', order_name: 'SO0231', product_name: 'Fried Rice', qty: 2 }

describe('printCard', () => {
  it('uses the print dialog when no printer is connected', async () => {
    await printCard(card, { status: 'idle', characteristic: null })
    expect(printReceipt).toHaveBeenCalledWith(card)
    expect(printViaBluetooth).not.toHaveBeenCalled()
  })

  it('prints via Bluetooth when a printer is connected', async () => {
    const characteristic = {}
    printViaBluetooth.mockResolvedValue(undefined)
    await printCard(card, { status: 'connected', characteristic })
    expect(printViaBluetooth).toHaveBeenCalledWith(characteristic, card)
    expect(printReceipt).not.toHaveBeenCalled()
  })

  it('falls back to the print dialog if the Bluetooth write fails, so the ticket still prints', async () => {
    printViaBluetooth.mockRejectedValue(new Error('printer out of range'))
    await printCard(card, { status: 'connected', characteristic: {} })
    expect(printReceipt).toHaveBeenCalledWith(card)
  })

  it('records a Bluetooth write failure in the error log, so a silent fallback still leaves a trace', async () => {
    printViaBluetooth.mockRejectedValue(new Error('printer out of range'))
    await printCard(card, { status: 'connected', characteristic: {} })

    const [entry] = useErrorLogStore.getState().entries
    expect(entry.category).toBe('printer')
    expect(entry.message).toContain('SO0231')
    expect(entry.detail).toBe('printer out of range')
  })

  describe('with a network printer bridge connected', () => {
    const printer = { status: 'connected', connectionType: 'network', networkHost: '192.168.1.50', networkPort: '8008' }

    it('prints via the network bridge, not Bluetooth or the print dialog', async () => {
      printViaNetwork.mockResolvedValue(undefined)
      await printCard(card, printer)
      expect(printViaNetwork).toHaveBeenCalledWith({ host: '192.168.1.50', port: '8008', secure: undefined }, card)
      expect(printViaBluetooth).not.toHaveBeenCalled()
      expect(printReceipt).not.toHaveBeenCalled()
    })

    it('falls back to the print dialog and logs it if the bridge is unreachable', async () => {
      printViaNetwork.mockRejectedValue(new Error('Could not reach the bridge'))
      await printCard(card, printer)

      expect(printReceipt).toHaveBeenCalledWith(card)
      const [entry] = useErrorLogStore.getState().entries
      expect(entry.message).toContain('Network print failed for SO0231')
      expect(entry.detail).toBe('Could not reach the bridge')
    })
  })

  describe('with the Android print helper connected', () => {
    const printer = { status: 'connected', connectionType: 'android', androidTransport: 'bluetooth', androidMac: 'AA:BB:CC:DD:EE:FF' }

    it('hands the ticket to the Android bridge, not Bluetooth, network, or the print dialog', async () => {
      printViaAndroidBridge.mockResolvedValue(undefined)
      await printCard(card, printer)
      expect(printViaAndroidBridge).toHaveBeenCalledWith(
        { transport: 'bluetooth', mac: 'AA:BB:CC:DD:EE:FF', host: undefined, port: undefined },
        card,
      )
      expect(printViaBluetooth).not.toHaveBeenCalled()
      expect(printViaNetwork).not.toHaveBeenCalled()
      expect(printReceipt).not.toHaveBeenCalled()
    })

    it('falls back to the print dialog and logs it if the hand-off is misconfigured', async () => {
      printViaAndroidBridge.mockRejectedValue(new Error('Enter the printer bridge address first.'))
      await printCard(card, printer)

      expect(printReceipt).toHaveBeenCalledWith(card)
      const [entry] = useErrorLogStore.getState().entries
      expect(entry.message).toContain('Android print helper print failed for SO0231')
    })
  })

  describe('with the simulated Test Printer connected', () => {
    afterEach(() => usePrinterStore.setState({ testPrints: [] }))

    it('logs the ticket instead of writing to Bluetooth or opening the print dialog', async () => {
      const { characteristic } = connectTestPrinter()
      await printCard(card, { status: 'connected', characteristic })

      expect(printViaBluetooth).not.toHaveBeenCalled()
      expect(printReceipt).not.toHaveBeenCalled()
      const [logged] = usePrinterStore.getState().testPrints
      expect(logged.preview).toContain('Fried Rice')
    })
  })
})
