import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProductionForm } from './ProductionForm'
import { ProductionList } from './ProductionList'
import { login } from '../../api/auth'
import { openKitchenSession } from '../../api/kitchen'
import { useAuthStore } from '../../store/authStore'
import { useTenantStore } from '../../store/tenantStore'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'

function renderProduction() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProductionForm />
      <ProductionList />
    </QueryClientProvider>,
  )
}

describe('kitchen production — create (auto-done) and shortage recovery', () => {
  beforeEach(async () => {
    const data = await login('staff@kawahputih.test', 'password123')
    useAuthStore.getState().setTokens(data)
    useTenantStore.setState({ companyId: 'c1', companyName: 'Kawah Putih' })
    const session = await openKitchenSession({ companyId: 'c1', employeeCode: 'F102345', shift: 'Shift 1' })
    useKitchenSessionStore.getState().setSession({
      session,
      employee: { id: 'e1', name: 'Bisma Fauzan', code: 'F102345' },
      companyId: 'c1',
    })
  })

  it('creates a manufacturing order and marks it done automatically', async () => {
    const user = userEvent.setup()
    renderProduction()

    await user.type(screen.getByLabelText(/product to manufacture/i), 'nasi')
    await user.click(await screen.findByText('Nasi Goreng Spesial'))
    await user.type(screen.getByLabelText(/quantity to manufacture/i), '10')
    await user.click(screen.getByRole('button', { name: /create manufacturing order/i }))

    expect(await screen.findByText(/WH\/MO\/00001/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/^done$/i)).toBeInTheDocument())
    expect(screen.getByText(/scrap needed before closing/i)).toBeInTheDocument()
  })

  it('flags a shortage instead of silently failing, and Retry/Cancel resolve it', async () => {
    const user = userEvent.setup()
    renderProduction()

    // "Sate Matang" is seeded with only 3 available — asking for 9 exercises the real 409 done_failed path.
    await user.type(screen.getByLabelText(/product to manufacture/i), 'sate matang')
    await user.click(await screen.findByText('Sate Matang'))
    await user.type(screen.getByLabelText(/quantity to manufacture/i), '9')
    await user.click(screen.getByRole('button', { name: /create manufacturing order/i }))

    expect(await screen.findByText(/couldn't be finished automatically/i)).toBeInTheDocument()
    expect(await screen.findByText(/confirmed/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.getByText(/^cancelled$/i)).toBeInTheDocument())
  })
})
