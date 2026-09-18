import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrinterConfig } from './PrinterConfig'
import { usePrinterStore } from '../../store/printerStore'
import * as printer from '../../lib/printer'
import * as networkPrinter from '../../lib/networkPrinter'
import * as androidPrintBridge from '../../lib/androidPrintBridge'

vi.mock('../../lib/printer', async () => {
  const actual = await vi.importActual('../../lib/printer')
  return { ...actual, pairPrinter: vi.fn(), printTestTicket: vi.fn() }
})
vi.mock('../../lib/networkPrinter', async () => {
  const actual = await vi.importActual('../../lib/networkPrinter')
  return { ...actual, checkNetworkBridge: vi.fn(), testNetworkConnection: vi.fn() }
})
vi.mock('../../lib/androidPrintBridge', async () => {
  const actual = await vi.importActual('../../lib/androidPrintBridge')
  return { ...actual, printViaAndroidBridge: vi.fn() }
})

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

  describe('Network Printer (IP address)', () => {
    it('connects after a successful reachability check, without sending a print job', async () => {
      networkPrinter.checkNetworkBridge.mockResolvedValue(undefined)
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await user.type(screen.getByLabelText(/printer bridge ip address/i), '192.168.1.50')
      await user.click(screen.getByRole('button', { name: /^connect$/i }))

      await waitFor(() => expect(screen.getByText(/connected: 192\.168\.1\.50:8008/i)).toBeInTheDocument())
      expect(networkPrinter.checkNetworkBridge).toHaveBeenCalledWith({ host: '192.168.1.50', port: '8008', secure: false })
      expect(networkPrinter.testNetworkConnection).not.toHaveBeenCalled()
    })

    it('shows an error and stays disconnected when the bridge is unreachable', async () => {
      networkPrinter.checkNetworkBridge.mockRejectedValue(new Error('Could not reach the bridge.'))
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await user.type(screen.getByLabelText(/printer bridge ip address/i), '192.168.1.50')
      await user.click(screen.getByRole('button', { name: /^connect$/i }))

      await waitFor(() => expect(screen.getByText(/could not reach the bridge/i)).toBeInTheDocument())
      expect(screen.queryByText(/connected:/i)).not.toBeInTheDocument()
    })

    it('disables Connect until a host is entered', () => {
      render(<PrinterConfig />)
      expect(screen.getByRole('button', { name: /^connect$/i })).toBeDisabled()
    })

    it('sends a test print over the network path once connected', async () => {
      networkPrinter.testNetworkConnection.mockResolvedValue(undefined)
      usePrinterStore.setState({
        status: 'connected',
        connectionType: 'network',
        networkHost: '192.168.1.50',
        networkPort: '8008',
      })
      const user = userEvent.setup()

      render(<PrinterConfig />)
      await user.click(screen.getByRole('button', { name: /send test print/i }))

      expect(networkPrinter.testNetworkConnection).toHaveBeenCalledWith({ host: '192.168.1.50', port: '8008', secure: false })
    })
  })

  describe('Android Print Helper', () => {
    it('connects instantly to a Bluetooth address, with no handshake', async () => {
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await user.type(screen.getByLabelText(/printer bluetooth address/i), 'AA:BB:CC:DD:EE:FF')
      await user.click(screen.getByRole('button', { name: /use android print helper/i }))

      expect(screen.getByText(/connected: android print helper.*bluetooth aa:bb:cc:dd:ee:ff/i)).toBeInTheDocument()
    })

    it('switches to network fields and connects to a host/port', async () => {
      const user = userEvent.setup()
      render(<PrinterConfig />)

      await user.click(screen.getByRole('radio', { name: /^network$/i }))
      await user.type(screen.getByLabelText(/android print helper printer ip address/i), '192.168.1.60')
      await user.click(screen.getByRole('button', { name: /use android print helper/i }))

      expect(screen.getByText(/connected: android print helper.*192\.168\.1\.60:9100/i)).toBeInTheDocument()
    })

    it('disables the connect button until an address is entered', () => {
      render(<PrinterConfig />)
      expect(screen.getByRole('button', { name: /use android print helper/i })).toBeDisabled()
    })

    it('sends a test print through the Android bridge once connected', async () => {
      androidPrintBridge.printViaAndroidBridge.mockResolvedValue(undefined)
      usePrinterStore.setState({
        status: 'connected',
        connectionType: 'android',
        androidTransport: 'bluetooth',
        androidMac: 'AA:BB:CC:DD:EE:FF',
      })
      const user = userEvent.setup()

      render(<PrinterConfig />)
      await user.click(screen.getByRole('button', { name: /send test print/i }))

      expect(androidPrintBridge.printViaAndroidBridge).toHaveBeenCalledWith(
        { transport: 'bluetooth', mac: 'AA:BB:CC:DD:EE:FF', host: '', port: '9100' },
        expect.objectContaining({ order_name: 'TEST PRINT' }),
      )
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
