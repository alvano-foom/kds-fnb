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

  async function pickProduct(user, search, label, qty) {
    await user.type(screen.getByLabelText(/product to manufacture/i), search)
    await user.click(await screen.findByText(label))
    await user.type(screen.getByLabelText(/quantity to manufacture/i), qty)
    await user.click(screen.getByRole('button', { name: /process manufacture order/i }))
  }

  async function tickAll(user) {
    for (const box of await screen.findAllByRole('checkbox')) await user.click(box)
  }

  const createButton = () => screen.getByRole('button', { name: /create manufacturing order \/ prep meal/i })

  it('creates a manufacturing order / prep meal and marks it done automatically', async () => {
    const user = userEvent.setup()
    renderProduction()

    await pickProduct(user, 'nasi', 'Nasi Goreng Spesial', '10')
    await tickAll(user)
    await user.click(createButton())

    expect(await screen.findByText(/WH\/MO\/00001/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/^done$/i)).toBeInTheDocument())
    expect(screen.getByText(/scrap needed before closing/i)).toBeInTheDocument()
  })

  it('previews the BoM with consumed qty scaled to the requested qty', async () => {
    const user = userEvent.setup()
    renderProduction()

    await pickProduct(user, 'nasi', 'Nasi Goreng Spesial', '10')

    // Nasi Putih: 200 g per 1 → 2000 g for 10; Telur: 1 pcs per 1 → 10 pcs
    expect(await screen.findByLabelText(/nasi putih — consumed 2000 g/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/telur ayam — consumed 10 pcs/i)).toBeInTheDocument()
  })

  it('keeps Create disabled until every ingredient is ticked, and un-ticking disables it again', async () => {
    const user = userEvent.setup()
    renderProduction()

    await pickProduct(user, 'nasi', 'Nasi Goreng Spesial', '10')
    const boxes = await screen.findAllByRole('checkbox')
    expect(createButton()).toBeDisabled()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')

    for (const box of boxes.slice(0, -1)) await user.click(box)
    expect(createButton()).toBeDisabled()

    await user.click(boxes[boxes.length - 1])
    expect(createButton()).toBeEnabled()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')

    await user.click(boxes[0])
    expect(createButton()).toBeDisabled()
  })

  it('does not create anything just by processing — nothing hits Odoo until Create', async () => {
    const user = userEvent.setup()
    renderProduction()

    await pickProduct(user, 'nasi', 'Nasi Goreng Spesial', '10')
    await screen.findAllByRole('checkbox')
    expect(screen.getByText(/no manufacturing orders \/ prep meals created yet/i)).toBeInTheDocument()
  })

  it('"Edit" goes back to step 1 and a new run starts with a fresh, unticked checklist', async () => {
    const user = userEvent.setup()
    renderProduction()

    await pickProduct(user, 'nasi', 'Nasi Goreng Spesial', '10')
    await user.click((await screen.findAllByRole('checkbox'))[0])
    await user.click(screen.getByRole('button', { name: /^edit$/i }))

    await user.click(screen.getByRole('button', { name: /process manufacture order/i }))
    for (const box of await screen.findAllByRole('checkbox')) expect(box).not.toBeChecked()
  })

  it('explains when the product has no Bill of Materials', async () => {
    const user = userEvent.setup()
    renderProduction()

    await pickProduct(user, 'es teh', 'Es Teh Manis', '5')
    expect(await screen.findByText(/bill of materials/i)).toBeInTheDocument()
    expect(createButton()).toBeDisabled()
  })

  it('flags a shortage instead of silently failing, and Retry/Cancel resolve it', async () => {
    const user = userEvent.setup()
    renderProduction()

    // "Sate Matang" is seeded with only 3 available — asking for 9 exercises the real 409 done_failed path.
    await pickProduct(user, 'sate matang', 'Sate Matang', '9')
    expect(await screen.findByText(/short — only/i)).toBeInTheDocument()
    await tickAll(user)
    await user.click(createButton())

    expect(await screen.findByText(/couldn't be finished automatically/i)).toBeInTheDocument()
    expect(await screen.findByText(/confirmed/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(screen.getByText(/^cancelled$/i)).toBeInTheDocument())
  })
})
