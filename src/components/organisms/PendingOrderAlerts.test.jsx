import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PendingOrderAlerts } from './PendingOrderAlerts'
import { useTtsStore } from '../../store/ttsStore'
import { usePrinterStore } from '../../store/printerStore'
import { useOrderViewStore } from '../../store/orderViewStore'
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
    expect(printCard).toHaveBeenCalledWith(nowPending, {
      status: 'connected',
      connectionType: null,
      characteristic: {},
      activePrinter: null,
    })
  })
})

describe('PendingOrderAlerts — one per transaction', () => {
  const line = (id, orderId, extra = {}) => ({
    ...baseCard,
    id,
    order_id: orderId,
    order_name: `SO${orderId}`,
    kitchen_state: 'pending',
    ...extra,
  })

  beforeEach(() => {
    vi.useFakeTimers()
    window.speechSynthesis.speak = vi.fn()
    printCard.mockClear()
    useOrderViewStore.setState({ perTransaction: true })
    usePrinterStore.setState({ autoPrint: true })
  })

  afterEach(() => vi.useRealTimers())

  it('raises one alert and prints one ticket for an order whose lines arrive a moment apart', () => {
    const { rerender } = render(<PendingOrderAlerts cards={[]} />)
    rerender(<PendingOrderAlerts cards={[line('a1', 'A', { product_name: 'Fried Rice', qty: 2 })]} />)
    act(() => vi.advanceTimersByTime(300))
    rerender(
      <PendingOrderAlerts
        cards={[line('a1', 'A', { product_name: 'Fried Rice', qty: 2 }), line('a2', 'A', { product_name: 'Iced Tea', qty: 1 })]}
      />,
    )
    // nothing yet — still waiting to see if more lines of the order arrive
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(printCard).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1100))

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('2 Fried Rice, 1 Iced Tea for table 2')
    expect(printCard).toHaveBeenCalledTimes(1)
    const [ticket] = printCard.mock.calls[0]
    expect(ticket.order_name).toBe('SOA')
    expect(ticket.lines.map((l) => l.product_name)).toEqual(['Fried Rice', 'Iced Tea'])
  })

  it('still gives separate orders separate alerts and tickets', () => {
    const { rerender } = render(<PendingOrderAlerts cards={[]} />)
    rerender(<PendingOrderAlerts cards={[line('a1', 'A'), line('b1', 'B')]} />)
    act(() => vi.advanceTimersByTime(1100))

    expect(screen.getAllByRole('status')).toHaveLength(2)
    expect(printCard).toHaveBeenCalledTimes(2)
  })

  it('does not batch in the default per-line mode — each line alerts and prints on its own, right away', () => {
    useOrderViewStore.setState({ perTransaction: false })
    const { rerender } = render(<PendingOrderAlerts cards={[]} />)
    rerender(<PendingOrderAlerts cards={[line('a1', 'A'), line('a2', 'A')]} />)

    expect(screen.getAllByRole('status')).toHaveLength(2)
    expect(printCard).toHaveBeenCalledTimes(2)
  })
})
