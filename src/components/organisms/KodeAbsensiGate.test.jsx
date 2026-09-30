import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { KodeAbsensiGate } from './KodeAbsensiGate'
import { login } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { useTenantStore } from '../../store/tenantStore'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'
import { openKitchenSession } from '../../api/kitchen'

function renderGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/kitchen-session']}>
        <Routes>
          <Route path="/kitchen-session" element={<KodeAbsensiGate />} />
          <Route path="/production" element={<div>Production Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('KodeAbsensiGate', () => {
  beforeEach(async () => {
    const data = await login('staff@kawahputih.test', 'password123')
    useAuthStore.getState().setTokens(data)
    useTenantStore.setState({ companyId: 'c1', companyName: 'Kawah Putih' })
  })

  it('rejects an unknown Kode Absensi', async () => {
    const user = userEvent.setup()
    renderGate()
    await user.type(screen.getByLabelText('Kode Absensi'), 'BADCODE')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/tidak dikenal/i)).toBeInTheDocument()
  })

  it('opens the kitchen and lands on Production when nothing is open yet', async () => {
    const user = userEvent.setup()
    renderGate()
    await user.type(screen.getByLabelText('Kode Absensi'), 'F102345')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/Bisma Fauzan/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /open kitchen/i }))

    expect(await screen.findByText('Production Page')).toBeInTheDocument()
    const state = useKitchenSessionStore.getState()
    expect(state.session.state).toBe('open')
    expect(state.employee.code).toBe('F102345')
    expect(state.companyId).toBe('c1')
  })

  it('offers to continue an already-open session instead of erroring', async () => {
    const opened = await openKitchenSession({ companyId: 'c1', employeeCode: 'F100120', shift: 'Shift 1' })

    const user = userEvent.setup()
    renderGate()
    await user.type(screen.getByLabelText('Kode Absensi'), 'F102345')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/kitchen is already open/i)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(opened.name))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /continue as bisma fauzan/i }))

    expect(await screen.findByText('Production Page')).toBeInTheDocument()
    expect(useKitchenSessionStore.getState().session.id).toBe(opened.id)
    expect(useKitchenSessionStore.getState().employee.code).toBe('F102345')
  })
})
