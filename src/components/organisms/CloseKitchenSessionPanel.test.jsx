import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CloseKitchenSessionPanel } from './CloseKitchenSessionPanel'
import { login } from '../../api/auth'
import { openKitchenSession, createProduction, setProductionState } from '../../api/kitchen'
import { useAuthStore } from '../../store/authStore'
import { useTenantStore } from '../../store/tenantStore'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'

function renderPanel(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CloseKitchenSessionPanel onCancel={vi.fn()} onClosed={vi.fn()} {...props} />
    </QueryClientProvider>,
  )
}

async function setUpSession() {
  const data = await login('staff@kawahputih.test', 'password123')
  useAuthStore.getState().setTokens(data)
  useTenantStore.setState({ companyId: 'c1', companyName: 'Kawah Putih' })
  const session = await openKitchenSession({ companyId: 'c1', employeeCode: 'F102345', shift: 'Shift 1' })
  useKitchenSessionStore.getState().setSession({
    session,
    employee: { id: 'e1', name: 'Bisma Fauzan', code: 'F102345' },
    companyId: 'c1',
  })
  return session
}

describe('CloseKitchenSessionPanel', () => {
  it('blocks closing until scrap is entered for a done manufacturing order', async () => {
    await setUpSession()
    const mo = await createProduction({ companyId: 'c1', employeeCode: 'F102345', productId: 'p1', qty: 5 })
    await setProductionState(mo.id, { employeeCode: 'F102345', action: 'done', qty: 5 })

    const user = userEvent.setup()
    renderPanel()

    const closeButton = await screen.findByRole('button', { name: /confirm & close kitchen/i })
    expect(closeButton).toBeDisabled()

    await user.type(screen.getByLabelText(new RegExp(`scrap qty for ${mo.name}`, 'i')), '1')
    expect(closeButton).not.toBeDisabled()
  })

  it('closes immediately when there is nothing to manufacture yet', async () => {
    await setUpSession()
    const onClosed = vi.fn()
    const user = userEvent.setup()
    renderPanel({ onClosed })

    const closeButton = await screen.findByRole('button', { name: /confirm & close kitchen/i })
    expect(closeButton).not.toBeDisabled()
    await user.click(closeButton)
    await waitFor(() => expect(onClosed).toHaveBeenCalled())
  })

  it('requires cancelling or forcing past a still-pending manufacturing order', async () => {
    await setUpSession()
    // Left confirmed on purpose — never marked done, simulating an MO nobody resolved.
    await createProduction({ companyId: 'c1', employeeCode: 'F102345', productId: 'p2', qty: 2 })

    const user = userEvent.setup()
    renderPanel()

    const closeButton = await screen.findByRole('button', { name: /confirm & close kitchen/i })
    expect(await screen.findByText(/still not done or cancelled/i)).toBeInTheDocument()
    expect(closeButton).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /cancel all of them automatically/i }))
    expect(closeButton).not.toBeDisabled()
  })
})
