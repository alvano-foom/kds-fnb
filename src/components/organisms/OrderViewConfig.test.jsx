import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { OrderViewConfig } from './OrderViewConfig'
import { useOrderViewStore } from '@/store/orderViewStore'

describe('OrderViewConfig', () => {
  it('is off by default (one card / ticket per order line, as before)', () => {
    render(<OrderViewConfig />)
    expect(screen.getByLabelText(/one card board per transaction/i)).not.toBeChecked()
  })

  it('switches per-transaction mode on and off, and remembers it in the store', async () => {
    const user = userEvent.setup()
    render(<OrderViewConfig />)
    const box = screen.getByLabelText(/one card board per transaction/i)

    await user.click(box)
    expect(useOrderViewStore.getState().perTransaction).toBe(true)
    expect(box).toBeChecked()

    await user.click(box)
    expect(useOrderViewStore.getState().perTransaction).toBe(false)
  })
})
