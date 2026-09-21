import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrinterConfig } from './PrinterConfig'
import { usePrinterStore } from '../../store/printerStore'
import * as printer from '../../lib/printer'
import * as networkPrinter from '../../lib/networkPrinter'

vi.mock('../../lib/printer', async () => {
  const actual = await vi.importActual('../../lib/printer')
  return { ...actual, pairPrinter: vi.fn(), printTestTicket: vi.fn() }
})
vi.mock('../../lib/networkPrinter', async () => {
  const actual = await vi.importActual('../../lib/networkPrinter')
  return {
    ...actual,
    checkNetworkBridge: vi.fn(),
    testNetworkConnection: vi.fn(),
    listBridgePrinters: vi.fn().mockResolvedValue([]),
  }
})

async function addNetworkPrinter(user, { name = 'Kitchen 1', host = '192.168.1.50', port } = {}) {
  await user.click(screen.getByRole('button', { name: /\+ add a network printer/i }))
  if (name) await user.type(screen.getByLabelText(/printer name$/i), name)
  if (host) await user.type(screen.getByLabelText(/printer bridge ip address/i), host)
  if (port) {
    const portInput = screen.getByLabelText(/printer bridge port/i)
    await user.clear(portInput)
    await user.type(portInput, port)
  }
  await user.click(screen.getByRole('button', { name: /^add printer$/i }))
}

describe('PrinterConfig', () => {
  afterEach(() => {
    delete navigator.bluetooth
  })

  it("tells the person Bluetooth printing isn't available when the browser lacks Web Bluetooth", () => {
    render(<PrinterConfig />)
    expect(screen.getByText(/doesn't support bluetooth printing/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pair printer/i })).not.toBeInTheDocument()
  })

  it('pairs a printer and shows it as connected', async () => {
    navigator.bluetooth = {}
    const user = userEvent.setup()
    const device = {
      name: 'Rongta Printer',
      addEventListener: vi.fn(),
      gatt: { disconnect: vi.fn() },
    }
    printer.pairPrinter.mockResolvedValue({ device, characteristic: {}, serviceLabel: 'Nordic UART Service' })

    render(<PrinterConfig />)
    await user.click(screen.getByRole('button', { name: /pair printer/i }))

    await waitFor(() => expect(screen.getByText(/connected: rongta printer/i)).toBeInTheDocument())
    expect(screen.getByText(/nordic uart service/i)).toBeInTheDocument()
  })

  it('treats the person cancelling the device chooser as a no-op, not an error', async () => {
    navigator.bluetooth = {}
    const user = userEvent.setup()
    printer.pairPrinter.mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'NotFoundError' }))

    render(<PrinterConfig />)
    await user.click(screen.getByRole('button', { name: /pair printer/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /pair printer/i })).not.toBeDisabled())
    expect(screen.queryByText(/could not connect/i)).not.toBeInTheDocument()
  })

  it('shows a real pairing failure as an error message', async () => {
    navigator.bluetooth = {}
    const user = userEvent.setup()
    printer.pairPrinter.mockRejectedValue(new Error('Paired with "Mystery Printer", but none of the print services...'))

    render(<PrinterConfig />)
    await user.click(screen.getByRole('button', { name: /pair printer/i }))

    await waitFor(() => expect(screen.getByText(/mystery printer/i)).toBeInTheDocument())
  })

  it('sends a test print once connected', async () => {
    navigator.bluetooth = {}
    const characteristic = {}
    usePrinterStore.setState({
      status: 'connected',
      deviceName: 'Rongta Printer',
      serviceLabel: 'Nordic UART Service',
      characteristic,
    })
    printer.printTestTicket.mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<PrinterConfig />)
    await user.click(screen.getByRole('button', { name: /send test print/i }))

    expect(printer.printTestTicket).toHaveBeenCalledWith(characteristic)
  })

  it('defaults to manual printing, and switching the toggle on persists autoPrint', async () => {
    const user = userEvent.setup()
    render(<PrinterConfig />)

    const toggle = screen.getByRole('checkbox', { name: /automatically print each new order/i })
    expect(toggle).not.toBeChecked()
    expect(screen.getByText(/tickets only print when someone clicks/i)).toBeInTheDocument()

    await user.click(toggle)

    expect(usePrinterStore.getState().autoPrint).toBe(true)
    expect(screen.getByText(/no need to click print/i)).toBeInTheDocument()
  })

  it('offers the auto-print toggle even without Web Bluetooth support, since it falls back to the print dialog', () => {
    render(<PrinterConfig />)
    expect(screen.getByRole('checkbox', { name: /automatically print each new order/i })).toBeInTheDocument()
  })

  describe('Network Printers', () => {
    it('adds a printer profile and connects to it after a successful reachability check', async () => {
      networkPrinter.checkNetworkBridge.mockResolvedValue(undefined)
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await addNetworkPrinter(user)
      await user.click(screen.getByRole('button', { name: /^use$/i }))

      await waitFor(() => expect(screen.getByText(/connected: kitchen 1 \(192\.168\.1\.50:8008\)/i)).toBeInTheDocument())
      expect(networkPrinter.checkNetworkBridge).toHaveBeenCalledWith({ host: '192.168.1.50', port: '8008', secure: true })
      expect(networkPrinter.testNetworkConnection).not.toHaveBeenCalled()
    })

    it('shows an error and stays disconnected when the bridge is unreachable', async () => {
      networkPrinter.checkNetworkBridge.mockRejectedValue(new Error('Could not reach the bridge.'))
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await addNetworkPrinter(user)
      await user.click(screen.getByRole('button', { name: /^use$/i }))

      await waitFor(() => expect(screen.getByText(/could not reach the bridge/i)).toBeInTheDocument())
      expect(screen.queryByText(/connected:/i)).not.toBeInTheDocument()
    })

    it('shows a validation message instead of saving when no host is entered', async () => {
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await user.click(screen.getByRole('button', { name: /\+ add a network printer/i }))
      await user.click(screen.getByRole('button', { name: /^add printer$/i }))

      expect(screen.getByText(/enter the printer bridge's ip address/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^use$/i })).not.toBeInTheDocument()
    })

    it('sends a test print over the network path once connected, including the saved printer name for a multi-printer bridge', async () => {
      networkPrinter.testNetworkConnection.mockResolvedValue(undefined)
      const profile = { id: 'p1', name: 'Kitchen 1', type: 'network', host: '192.168.1.17', port: '8008', secure: true, printer: 'kitchen1' }
      usePrinterStore.setState({ status: 'connected', connectionType: 'network', printers: [profile], activePrinterId: 'p1' })
      const user = userEvent.setup()

      render(<PrinterConfig />)
      await user.click(screen.getByRole('button', { name: /send test print/i }))

      expect(networkPrinter.testNetworkConnection).toHaveBeenCalledWith({
        host: '192.168.1.17',
        port: '8008',
        secure: true,
        printer: 'kitchen1',
      })
    })

    it('lets a station switch between two saved printers', async () => {
      networkPrinter.checkNetworkBridge.mockResolvedValue(undefined)
      usePrinterStore.setState({
        printers: [
          { id: 'p1', name: 'Kitchen 1', type: 'network', host: '192.168.1.30', port: '8008', secure: true, printer: '' },
          { id: 'p2', name: 'Kitchen 2', type: 'network', host: '192.168.1.32', port: '8009', secure: true, printer: '' },
        ],
      })
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await user.click(screen.getAllByRole('button', { name: /^use$/i })[1])

      await waitFor(() => expect(screen.getByText(/connected: kitchen 2 \(192\.168\.1\.32:8009\)/i)).toBeInTheDocument())
    })

    it('edits a saved printer in place', async () => {
      usePrinterStore.setState({
        printers: [{ id: 'p1', name: 'Kitchen 1', type: 'network', host: '192.168.1.30', port: '8008', secure: true, printer: '' }],
      })
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await user.click(screen.getByRole('button', { name: /^edit$/i }))
      const hostInput = screen.getByLabelText(/printer bridge ip address/i)
      await user.clear(hostInput)
      await user.type(hostInput, '192.168.1.99')
      await user.click(screen.getByRole('button', { name: /save changes/i }))

      expect(screen.getByText(/192\.168\.1\.99:8008/i)).toBeInTheDocument()
      expect(usePrinterStore.getState().printers).toHaveLength(1)
    })

    it('removes a saved printer, disconnecting first if it was the active one', async () => {
      const profile = { id: 'p1', name: 'Kitchen 1', type: 'network', host: '192.168.1.30', port: '8008', secure: true, printer: '' }
      usePrinterStore.setState({ status: 'connected', connectionType: 'network', printers: [profile], activePrinterId: 'p1' })
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await user.click(screen.getByRole('button', { name: /disconnect/i }))
      await user.click(screen.getByRole('button', { name: /^remove$/i }))

      expect(usePrinterStore.getState().printers).toHaveLength(0)
      expect(screen.queryByText('Kitchen 1')).not.toBeInTheDocument()
    })

    it('fetches printer names from a multi-printer bridge and offers them as suggestions', async () => {
      networkPrinter.listBridgePrinters.mockResolvedValue(['kitchen1', 'kitchen2'])
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await user.click(screen.getByRole('button', { name: /\+ add a network printer/i }))
      await user.type(screen.getByLabelText(/printer bridge ip address/i), '192.168.1.17')
      await user.click(screen.getByRole('button', { name: /fetch printer list from bridge/i }))

      await waitFor(() =>
        expect(networkPrinter.listBridgePrinters).toHaveBeenCalledWith({ host: '192.168.1.17', port: '8008', secure: true }),
      )
      expect(document.querySelector('#bridge-printer-options')).toContainHTML('kitchen1')
      expect(document.querySelector('#bridge-printer-options')).toContainHTML('kitchen2')
    })
  })

  describe('Test Printer', () => {
    it('is offered even when the browser has no Web Bluetooth support at all', () => {
      render(<PrinterConfig />)
      expect(screen.getByRole('button', { name: /use test printer/i })).toBeInTheDocument()
    })

    it('connects instantly (no device chooser, no async pairing) and shows an empty log', async () => {
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await user.click(screen.getByRole('button', { name: /use test printer/i }))

      expect(screen.getByText(/connected: test printer/i)).toBeInTheDocument()
      expect(screen.getByText(/test printer output/i)).toBeInTheDocument()
      expect(screen.getByText(/nothing printed yet/i)).toBeInTheDocument()
    })

    it('logs a ticket, with no popup and no real Bluetooth write, via "Send test print"', async () => {
      const user = userEvent.setup()
      render(<PrinterConfig />)
      await user.click(screen.getByRole('button', { name: /use test printer/i }))

      await user.click(screen.getByRole('button', { name: /send test print/i }))

      expect(printer.printTestTicket).not.toHaveBeenCalled()
      expect(screen.getByText(/bluetooth connection ok/i)).toBeInTheDocument()
    })

    it('clears the log', async () => {
      const user = userEvent.setup()
      render(<PrinterConfig />)
      await user.click(screen.getByRole('button', { name: /use test printer/i }))
      await user.click(screen.getByRole('button', { name: /send test print/i }))
      expect(screen.getByText(/bluetooth connection ok/i)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /^clear$/i }))

      expect(screen.queryByText(/bluetooth connection ok/i)).not.toBeInTheDocument()
      expect(screen.getByText(/nothing printed yet/i)).toBeInTheDocument()
    })
  })
})
