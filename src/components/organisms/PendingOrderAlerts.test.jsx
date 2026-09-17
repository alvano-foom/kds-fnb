import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PendingOrderAlerts } from './PendingOrderAlerts'
import { useTtsStore } from '../../store/ttsStore'
import { usePrinterStore } from '../../store/printerStore'
import { printCard } from '../../lib/printCard'

vi.mock('../../lib/printCard', () => ({ printCard: vi.fn() }))

const baseCard = {
  id: 'l9',
  order_id: 'so7',
  order_name: 'SO0233',
  table_number: '2',
  customer_name: 'Grace',
  product_name: 'Iced Coffee Latte',
  qty: 4,
  kitchen_state: 'cooking',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('PendingOrderAlerts', () => {
  beforeEach(() => {
    window.speechSynthesis.speak = vi.fn()
  })

  it('does not alert on the initial snapshot, only once a line newly enters pending', () => {
    const { rerender } = render(<PendingOrderAlerts cards={[baseCard]} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled()

    const nowPending = { ...baseCard, kitchen_state: 'pending', updated_at: '2026-01-01T00:05:00Z' }
    rerender(<PendingOrderAlerts cards={[nowPending]} />)

    expect(screen.getByText('New Order')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('4 Iced Coffee Latte for table 2')
    expect(window.speechSynthesis.speak).toHaveBeenCalledOnce()
  })

  it('follows the configured announcement template, not a hardcoded format', () => {
    useTtsStore.getState().setText('{qty}x {product_name} for table {table_number}!')
    const { rerender } = render(<PendingOrderAlerts cards={[baseCard]} />)

    const nowPending = { ...baseCard, kitchen_state: 'pending', updated_at: '2026-01-01T00:05:00Z' }
    rerender(<PendingOrderAlerts cards={[nowPending]} />)

    expect(screen.getByRole('status')).toHaveTextContent('4x Iced Coffee Latte for table 2!')
  })

  it('does not re-alert on a re-render where the card is still pending', () => {
    const pending = { ...baseCard, kitchen_state: 'pending' }
    const { rerender } = render(<PendingOrderAlerts cards={[]} />)
    rerender(<PendingOrderAlerts cards={[pending]} />)
    expect(screen.getAllByRole('status')).toHaveLength(1)

    rerender(<PendingOrderAlerts cards={[pending]} />)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it.each(['ready', 'served'])(
    'does not announce or print when a %s card flashes back to pending (an optimistic drag the API is about to reject)',
    (fromState) => {
      usePrinterStore.setState({ autoPrint: true })
      const wasInState = { ...baseCard, kitchen_state: fromState }
      const { rerender } = render(<PendingOrderAlerts cards={[wasInState]} />)

      const optimisticallyPending = { ...baseCard, kitchen_state: 'pending', updated_at: '2026-01-01T00:05:00Z' }
      rerender(<PendingOrderAlerts cards={[optimisticallyPending]} />)

      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(window.speechSynthesis.speak).not.toHaveBeenCalled()
      expect(printCard).not.toHaveBeenCalled()
    },
  )

  it('still announces and prints a legitimate Cooking -> Pending reversion (the one the API allows)', () => {
    usePrinterStore.setState({ autoPrint: true, status: 'connected', characteristic: {} })
    const { rerender } = render(<PendingOrderAlerts cards={[baseCard]} />) // baseCard is 'cooking'

    const nowPending = { ...baseCard, kitchen_state: 'pending', updated_at: '2026-01-01T00:05:00Z' }
    rerender(<PendingOrderAlerts cards={[nowPending]} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(printCard).toHaveBeenCalledWith(nowPending, { status: 'connected', characteristic: {} })
  })
})
