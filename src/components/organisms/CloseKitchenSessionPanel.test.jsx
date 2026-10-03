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

async function doneMo(productId, qty) {
  const mo = await createProduction({ companyId: 'c1', employeeCode: 'F102345', productId, qty })
  await setProductionState(mo.id, { employeeCode: 'F102345', action: 'done', qty })
  return mo
}

const closeButton = () => screen.findByRole('button', { name: /confirm & close kitchen/i })

describe('CloseKitchenSessionPanel', () => {
  it('lists the done manufacturing orders first, collapsed, each flagged as needing review', async () => {
    await setUpSession()
    const first = await doneMo('p1', 5)
    const second = await doneMo('p2', 2)
    renderPanel()

    const rows = await screen.findAllByRole('button', { expanded: false })
    expect(rows.map((r) => r.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining(first.name), expect.stringContaining(second.name)]),
    )
    expect(screen.getAllByText(/needs review/i)).toHaveLength(2)
    // nothing expanded → no ingredient inputs yet
    expect(screen.queryByLabelText(/scrap qty for/i)).not.toBeInTheDocument()
    expect(await closeButton()).toBeDisabled()
  })

  it('tapping an MO expands its ingredients with a scrap qty + reason per ingredient', async () => {
    await setUpSession()
    const mo = await doneMo('p1', 5)
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: new RegExp(mo.name) }))
    // Nasi Goreng ×5 → 1000 g rice, 5 pcs eggs, 75 g seasoning
    expect(await screen.findByLabelText('Scrap qty for Nasi Putih')).toBeInTheDocument()
    expect(screen.getByLabelText('Scrap reason for Nasi Putih')).toBeInTheDocument()
    expect(screen.getByText(/to consume 1000 g/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Scrap qty for Telur Ayam')).toBeInTheDocument()
    // the finished good is never offered
    expect(screen.queryByLabelText(/scrap qty for nasi goreng/i)).not.toBeInTheDocument()
  })

  it('records scrap for an ingredient, shows it as already scrapped, and unblocks closing', async () => {
    await setUpSession()
    const mo = await doneMo('p1', 5)
    const onClosed = vi.fn()
    const user = userEvent.setup()
    renderPanel({ onClosed })

    await user.click(await screen.findByRole('button', { name: new RegExp(mo.name) }))
    await user.type(await screen.findByLabelText('Scrap qty for Nasi Putih'), '50')
    await user.type(screen.getByLabelText('Scrap reason for Nasi Putih'), 'gosong')
    await user.click(screen.getByRole('button', { name: /record scrap/i }))

    expect(await screen.findByText(/already scrapped 50 g/i)).toBeInTheDocument()
    expect(await screen.findByText(/scrap recorded/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Scrap qty for Nasi Putih')).toHaveValue(null) // inputs cleared

    const close = await closeButton()
    await waitFor(() => expect(close).not.toBeDisabled())
    await user.click(close)
    await waitFor(() => expect(onClosed).toHaveBeenCalled())
  })

  it('"Record scrap" stays disabled until a qty is entered', async () => {
    await setUpSession()
    const mo = await doneMo('p1', 5)
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: new RegExp(mo.name) }))
    const record = await screen.findByRole('button', { name: /record scrap/i })
    expect(record).toBeDisabled()
    await user.type(screen.getByLabelText('Scrap qty for Telur Ayam'), '1')
    expect(record).toBeEnabled()
  })

  it('"No scrap for this one" counts as reviewed without sending anything', async () => {
    await setUpSession()
    const mo = await doneMo('p1', 5)
    const user = userEvent.setup()
    renderPanel()

    expect(await closeButton()).toBeDisabled()
    await user.click(await screen.findByRole('button', { name: new RegExp(mo.name) }))
    await user.click(await screen.findByRole('button', { name: /no scrap for this one/i }))

    expect(await screen.findByText(/^no scrap$/i)).toBeInTheDocument()
    expect(await closeButton()).toBeEnabled()
  })

  it("shows Odoo's refusal when there isn't enough stock to scrap", async () => {
    await setUpSession()
    const mo = await doneMo('p3', 2) // Daging Sate: 300 g used, 150 g left on hand
    const user = userEvent.setup()
    renderPanel()

    await user.click(await screen.findByRole('button', { name: new RegExp(mo.name) }))
    await user.type(await screen.findByLabelText('Scrap qty for Daging Sate'), '200')
    await user.click(screen.getByRole('button', { name: /record scrap/i }))

    expect(await screen.findByText(/not enough daging sate/i)).toBeInTheDocument()
    expect(screen.queryByText(/scrap recorded/i)).not.toBeInTheDocument()
    expect(await closeButton()).toBeDisabled()
  })

  it('closes immediately when there is nothing to manufacture yet', async () => {
    await setUpSession()
    const onClosed = vi.fn()
    const user = userEvent.setup()
    renderPanel({ onClosed })

    const close = await closeButton()
    expect(close).not.toBeDisabled()
    expect(screen.getByText(/nothing to scrap/i)).toBeInTheDocument()
    await user.click(close)
    await waitFor(() => expect(onClosed).toHaveBeenCalled())
  })

  it('requires cancelling or forcing past a still-pending manufacturing order', async () => {
    await setUpSession()
    // Left confirmed on purpose — never marked done, simulating an MO nobody resolved.
    await createProduction({ companyId: 'c1', employeeCode: 'F102345', productId: 'p2', qty: 2 })

    const user = userEvent.setup()
    renderPanel()

    const close = await closeButton()
    expect(await screen.findByText(/still not done or cancelled/i)).toBeInTheDocument()
    expect(close).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /cancel all of them automatically/i }))
    expect(close).not.toBeDisabled()
  })
})
