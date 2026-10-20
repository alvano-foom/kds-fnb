import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { login } from '../api/auth'
import { BoardPage } from './BoardPage'
import { useAuthStore } from '../store/authStore'
import { useTenantStore } from '../store/tenantStore'
import { useOrderViewStore } from '../store/orderViewStore'

vi.mock('../ws/useKitchenSocket', () => ({ useKitchenSocket: () => ({ status: 'polling' }) }))

function renderBoard() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <BoardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BoardPage — card granularity', () => {
  beforeEach(async () => {
    useAuthStore.getState().setTokens(await login('staff@kawahputih.test', 'password123'))
    useTenantStore.setState({ companyId: 'c1', companyName: 'Kawah Putih' })
  })

  it('shows one card per order line by default', async () => {
    renderBoard()
    // SO0231 has two lines in the mock data → two cards
    await screen.findByText(/2× Fried Rice/)
    expect(screen.getAllByText('SO0231')).toHaveLength(2)
  })

  it('shows one card per sales order when per-transaction mode is on', async () => {
    useOrderViewStore.setState({ perTransaction: true })
    renderBoard()
    await screen.findByText(/2× Fried Rice/)
    const orderNames = screen.getAllByText('SO0231')
    expect(orderNames).toHaveLength(1)
    const card = orderNames[0].closest('[role="button"]')
    expect(within(card).getByText(/2× Iced Tea/)).toBeInTheDocument() // both lines on the same card
  })
})
