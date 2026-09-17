import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrinterConfig } from './PrinterConfig'
import { usePrinterStore } from '../../store/printerStore'
import * as printer from '../../lib/printer'

vi.mock('../../lib/printer', async () => {
  const actual = await vi.importActual('../../lib/printer')
  return { ...actual, pairPrinter: vi.fn(), printTestTicket: vi.fn() }
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
