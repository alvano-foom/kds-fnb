import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { OrderViewConfig } from './OrderViewConfig'
import { useOrderViewStore } from '../../store/orderViewStore'

describe('OrderViewConfig', () => {
  it('is off by default (one card / ticket per order line, as before)', () => {
    render(<OrderViewConfig />)
    expect(screen.getByLabelText(/one card and one ticket per transaction/i)).not.toBeChecked()
    expect(screen.getByText(/one card and one ticket per order line/i)).toBeInTheDocument()
  })

  it('switches per-transaction mode on and off, and remembers it in the store', async () => {
    const user = userEvent.setup()
    render(<OrderViewConfig />)
    const box = screen.getByLabelText(/one card and one ticket per transaction/i)

    await user.click(box)
    expect(useOrderViewStore.getState().perTransaction).toBe(true)
    expect(box).toBeChecked()
    expect(screen.getByText(/one card per sales order with all its lines/i)).toBeInTheDocument()

    await user.click(box)
    expect(useOrderViewStore.getState().perTransaction).toBe(false)
  })
})
