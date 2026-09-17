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
})
