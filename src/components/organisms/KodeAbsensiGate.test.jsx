import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '../../test/server'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { KodeAbsensiGate } from './KodeAbsensiGate'
import { login } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { useTenantStore } from '../../store/tenantStore'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'
import { openKitchenSession } from '../../api/kitchen'
import { useShiftChecklistStore } from '../../store/shiftChecklistStore'

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

  describe('shift picker (foom_attendance shifts, unlocked by PIN)', () => {
    afterEach(() => vi.useRealTimers())

    async function reachOpenStep(user, { pin = '482913' } = {}) {
      renderGate()
      await user.type(screen.getByLabelText('Kode Absensi'), 'F102345')
      if (pin) await user.type(screen.getByLabelText(/pin absensi/i), pin)
      await user.click(screen.getByRole('button', { name: /continue/i }))
      await screen.findByRole('button', { name: /not you/i })
    }

    it('falls back to the free-text field when no PIN is given (nothing is blocked)', async () => {
      const user = userEvent.setup()
      await reachOpenStep(user, { pin: '' })

      const input = await screen.findByLabelText(/shift \(optional\)/i)
      expect(input.tagName).toBe('INPUT')
      await user.type(input, 'Shift 9')
      await user.click(screen.getByRole('button', { name: /open kitchen/i }))

      expect(await screen.findByText('Production Page')).toBeInTheDocument()
      expect(useKitchenSessionStore.getState().session.shift).toBe('Shift 9')
      expect(useShiftChecklistStore.getState().shift).toBeNull()
    })

    it('lets you add the PIN on the open step to load shifts, then shows the shift list and its tasks', async () => {
      const user = userEvent.setup()
      await reachOpenStep(user, { pin: '' })

      await user.type(await screen.findByLabelText('PIN Absensi'), '482913')
      await user.click(screen.getByRole('button', { name: /load shifts/i }))

      const select = await screen.findByLabelText('Shift')
      expect(select.tagName).toBe('SELECT')
      await user.selectOptions(select, '1')
      expect(screen.getByText(/your tasks this shift \(pagi\)/i)).toBeInTheDocument()
      // the inline PIN prompt is gone once shifts are loaded
      expect(screen.queryByRole('button', { name: /load shifts/i })).not.toBeInTheDocument()
    })

    it('with the PIN, lists the company shifts with their time window', async () => {
      const user = userEvent.setup()
      await reachOpenStep(user)

      const select = await screen.findByLabelText('Shift')
      expect(select.tagName).toBe('SELECT')
      expect(screen.getByRole('option', { name: 'Pagi · 08:00–17:00' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Malam · 22:00–06:00 (+1)' })).toBeInTheDocument()
      // c2's shift (07:00–15:00) must not leak into c1
      expect(screen.queryByRole('option', { name: /07:00–15:00/ })).not.toBeInTheDocument()
    })

    it('opens the kitchen with the shift name and remembers the shift (with tasks) for the checklist', async () => {
      const user = userEvent.setup()
      await reachOpenStep(user)

      await user.selectOptions(await screen.findByLabelText('Shift'), '2')
      await user.click(screen.getByRole('button', { name: /open kitchen/i }))

      expect(await screen.findByText('Production Page')).toBeInTheDocument()
      const { session } = useKitchenSessionStore.getState()
      expect(session.shift).toBe('Siang')
      const stored = useShiftChecklistStore.getState()
      expect(stored.sessionId).toBe(session.id)
      expect(stored.shift.name).toBe('Siang')
      expect(stored.shift.tasks).toHaveLength(3)
    })

    it("lists the picked shift's tasks as a reminder, and swaps them when the shift changes", async () => {
      const user = userEvent.setup()
      await reachOpenStep(user)

      const select = await screen.findByLabelText('Shift')
      await user.selectOptions(select, '1')
      expect(screen.getByText(/your tasks this shift \(pagi\)/i)).toBeInTheDocument()
      expect(screen.getByText(/check fridge & freezer temperature/i)).toBeInTheDocument()
      expect(screen.getByText(/handover note for the siang shift/i)).toBeInTheDocument()

      await user.selectOptions(select, '3')
      expect(screen.getByText(/deep-clean stations/i)).toBeInTheDocument()
      expect(screen.queryByText(/check fridge & freezer temperature/i)).not.toBeInTheDocument()

      await user.selectOptions(select, '')
      expect(screen.queryByText(/your tasks this shift/i)).not.toBeInTheDocument()
    })

    it('a wrong PIN is explained, and the kitchen can still be opened with free text', async () => {
      const user = userEvent.setup()
      await reachOpenStep(user, { pin: '000000' })

      expect(await screen.findByText(/couldn't load shifts/i)).toBeInTheDocument()
      const input = screen.getByLabelText(/shift \(optional\)/i)
      await user.type(input, 'Pagi')
      await user.click(screen.getByRole('button', { name: /open kitchen/i }))
      expect(await screen.findByText('Production Page')).toBeInTheDocument()
    })

    it('falls back to free text when the attendance service is down', async () => {
      server.use(http.post('/foom/attendance/api/shifts', () => HttpResponse.json({ ok: false, error: 'server_error', message: 'Terjadi kesalahan.' }, { status: 500 })))
      const user = userEvent.setup()
      await reachOpenStep(user)

      expect(await screen.findByText(/couldn't load shifts/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/shift \(optional\)/i).tagName).toBe('INPUT')
    })

    it('joining a kitchen someone else opened remembers the matching shift when a PIN was given', async () => {
      const opened = await openKitchenSession({ companyId: 'c1', employeeCode: 'F100120', shift: 'Malam' })
      const user = userEvent.setup()
      await reachOpenStep(user)

      await user.click(await screen.findByRole('button', { name: /continue as bisma fauzan/i }))
      expect(await screen.findByText('Production Page')).toBeInTheDocument()
      const stored = useShiftChecklistStore.getState()
      expect(stored.sessionId).toBe(opened.id)
      expect(stored.shift.name).toBe('Malam')
    })

    it('does not leave the PIN on screen after continuing', async () => {
      const user = userEvent.setup()
      await reachOpenStep(user)
      expect(screen.queryByLabelText(/pin absensi/i)).not.toBeInTheDocument()
    })
  })
})
