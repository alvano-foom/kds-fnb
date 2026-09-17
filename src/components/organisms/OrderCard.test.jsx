import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OrderCard } from './OrderCard'
import { printReceipt } from '../../lib/receipt'
import { printViaBluetooth } from '../../lib/printer'
import { usePrinterStore } from '../../store/printerStore'

vi.mock('../../lib/receipt', () => ({ printReceipt: vi.fn() }))
vi.mock('../../lib/printer', () => ({ printViaBluetooth: vi.fn() }))

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

    expect(printReceipt).toHaveBeenCalledWith(card)
    expect(printViaBluetooth).not.toHaveBeenCalled()
    // The card itself is still in its normal (non-dragging) state — the
    // click didn't get interpreted as a drag start.
    expect(screen.getByText('SO0231')).toBeVisible()
  })

  it('prints via the paired Bluetooth printer instead, once one is connected', async () => {
    const characteristic = {}
    usePrinterStore.setState({ status: 'connected', characteristic })
    printViaBluetooth.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<OrderCard card={card} />)

    await user.click(screen.getByRole('button', { name: /^print$/i }))

    expect(printViaBluetooth).toHaveBeenCalledWith(characteristic, card)
    expect(printReceipt).not.toHaveBeenCalled()
  })

  it('falls back to the print dialog if the Bluetooth write fails, so the ticket still prints', async () => {
    usePrinterStore.setState({ status: 'connected', characteristic: {} })
    printViaBluetooth.mockRejectedValue(new Error('printer out of range'))
    const user = userEvent.setup()
    render(<OrderCard card={card} />)

    await user.click(screen.getByRole('button', { name: /^print$/i }))

    await waitFor(() => expect(printReceipt).toHaveBeenCalledWith(card))
  })
})
