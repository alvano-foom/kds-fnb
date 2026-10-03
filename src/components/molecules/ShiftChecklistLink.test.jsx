import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ShiftChecklistLink } from './ShiftChecklistLink'
import { login } from '../../api/auth'
import { openKitchenSession } from '../../api/kitchen'
import { useAuthStore } from '../../store/authStore'
import { useTenantStore } from '../../store/tenantStore'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'
import { useShiftChecklistStore } from '../../store/shiftChecklistStore'

function renderLink() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/production']}>
        <Routes>
          <Route path="/production" element={<ShiftChecklistLink />} />
          <Route path="/shift-checklist" element={<div>Checklist Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function startSession(opts) {
  const session = await openKitchenSession({ companyId: 'c1', employeeCode: 'F102345', ...opts })
  useKitchenSessionStore.getState().setSession({
    session,
    employee: { id: 'e1', name: 'Bisma Fauzan', code: 'F102345' },
    companyId: 'c1',
  })
  return session
}

describe('ShiftChecklistLink', () => {
  beforeEach(async () => {
    const data = await login('staff@kawahputih.test', 'password123')
    useAuthStore.getState().setTokens(data)
    useTenantStore.setState({ companyId: 'c1', companyName: 'Kawah Putih' })
  })

  it('shows done/total and opens the checklist page', async () => {
    const session = await startSession({ shiftId: 's3' })
    useShiftChecklistStore.getState().toggle(session.id, 's3t1')
    const user = userEvent.setup()
    renderLink()

    const button = await screen.findByRole('button', { name: /shift checklist/i })
    expect(button).toHaveTextContent('1/3')
    await user.click(button)
    expect(await screen.findByText('Checklist Page')).toBeInTheDocument()
  })

  it('is hidden when the kitchen has no shift tasks', async () => {
    await startSession({ shift: 'Shift 1' })
    renderLink()
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: /shift checklist/i })).not.toBeInTheDocument()
  })
})
