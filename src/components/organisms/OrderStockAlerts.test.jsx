import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { login } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { mockOrders, toOrderLineCard } from '@/mocks/fixtures'
import { OrderStockAlerts } from './OrderStockAlerts'

const allCards = mockOrders.filter((o) => o.company_id === 'c1').flatMap((o) => o.lines.map((l) => toOrderLineCard(o, l)))

function renderAlerts(cards) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <OrderStockAlerts companyId="c1" cards={cards} />
    </QueryClientProvider>,
  )
}

describe('OrderStockAlerts', () => {
  beforeEach(async () => {
    useAuthStore.getState().setTokens(await login('staff@kawahputih.test', 'password123'))
  })

  it('checks each pending order and lists its stock alerts, worst first', async () => {
    renderAlerts(allCards)
    const items = await screen.findAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^Not enough.*Coffee Beans.*SO0233$/),
      expect.stringMatching(/^Not enough.*Iced Coffee Latte is short by 1.*SO0233$/),
      expect.stringMatching(/^Last portion.*Chicken runs out.*SO0232$/),
      expect.stringMatching(/^Low stock.*Rice is running low.*SO0231$/),
    ])
  })

  it('renders nothing when no order is pending', async () => {
    const { container } = renderAlerts(allCards.filter((c) => c.kitchen_state !== 'pending'))
    await new Promise((r) => setTimeout(r, 50))
    expect(container).toBeEmptyDOMElement()
  })
})
