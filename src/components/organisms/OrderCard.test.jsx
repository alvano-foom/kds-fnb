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
      networkHost: '',
      networkPort: '8008',
      networkSecure: false,
      androidTransport: 'bluetooth',
      androidMac: '',
      androidHost: '',
      androidPort: '9100',
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
      networkHost: '',
      networkPort: '8008',
      networkSecure: false,
      androidTransport: 'bluetooth',
      androidMac: '',
      androidHost: '',
      androidPort: '9100',
    })
  })
})
