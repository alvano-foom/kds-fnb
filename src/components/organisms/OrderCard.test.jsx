import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OrderCard } from './OrderCard'
import { printCard } from '../../lib/printCard'
import { usePrinterStore } from '../../store/printerStore'

vi.mock('../../lib/printCard', () => ({ printCard: vi.fn() }))

const card = {
  id: 'l1',
  order_id: 'o1',
  order_name: 'SO0231',
  table_number: '7',
  customer_name: 'Alex',
  product_name: 'Fried Rice',
  qty: 2,
  kitchen_state: 'pending',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

describe('OrderCard', () => {
  it('prints a kitchen ticket for this card without starting a drag', async () => {
    const user = userEvent.setup()
    render(<OrderCard card={card} />)

    // Anchored: the card's own outer role="button" wrapper also has
    // "Print" somewhere in its full accessible name, so an unanchored
    // match would find both elements.
    await user.click(screen.getByRole('button', { name: /^print$/i }))

    expect(printCard).toHaveBeenCalledWith(card, {
      status: 'idle',
      connectionType: null,
      characteristic: null,
      activePrinter: null,
    })
    // The card itself is still in its normal (non-dragging) state — the
    // click didn't get interpreted as a drag start.
    expect(screen.getByText('SO0231')).toBeVisible()
  })

  it('passes the currently-connected printer along, so printCard can route to it', async () => {
    const characteristic = {}
    usePrinterStore.setState({ status: 'connected', characteristic })
    const user = userEvent.setup()
    render(<OrderCard card={card} />)

    await user.click(screen.getByRole('button', { name: /^print$/i }))

    expect(printCard).toHaveBeenCalledWith(card, {
      status: 'connected',
      connectionType: null,
      characteristic,
      activePrinter: null,
    })
  })

  it('passes the saved network printer profile along when one is the active connection', async () => {
    const profile = { id: 'p1', name: 'Kitchen 1', type: 'network', host: '192.168.1.30', port: '8008', secure: true, printer: '' }
    usePrinterStore.setState({ status: 'connected', connectionType: 'network', printers: [profile], activePrinterId: 'p1' })
    const user = userEvent.setup()
    render(<OrderCard card={card} />)

    await user.click(screen.getByRole('button', { name: /^print$/i }))

    expect(printCard).toHaveBeenCalledWith(card, {
      status: 'connected',
      connectionType: 'network',
      characteristic: null,
      activePrinter: profile,
    })
  })
})
