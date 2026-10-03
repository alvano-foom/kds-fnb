import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShiftChecklistPanel } from './ShiftChecklistPanel'
import { login } from '../../api/auth'
import { openKitchenSession } from '../../api/kitchen'
import { useAuthStore } from '../../store/authStore'
import { useTenantStore } from '../../store/tenantStore'
import { useKitchenSessionStore } from '../../store/kitchenSessionStore'
import { useShiftChecklistStore } from '../../store/shiftChecklistStore'

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ShiftChecklistPanel />
    </QueryClientProvider>,
  )
}

import { mockShifts } from '../../api/mocks/fixtures'
import { normalizeAttendanceShift } from '../../lib/shifts'

/** Opens a kitchen session and remembers a mock shift for it, the way the gate does. */
async function startSession({ shiftId } = {}) {
  const raw = mockShifts.find((s) => s.id === shiftId)
  const shift = raw ? normalizeAttendanceShift(raw) : null
  const session = await openKitchenSession({ companyId: 'c1', employeeCode: 'F102345', shift: shift?.name ?? 'Shift 1' })
  useKitchenSessionStore.getState().setSession({
    session,
    employee: { id: 'e1', name: 'Bisma Fauzan', code: 'F102345' },
    companyId: 'c1',
  })
  if (shift) useShiftChecklistStore.getState().setShift(session.id, shift)
  return session
}

describe('ShiftChecklistPanel', () => {
  beforeEach(async () => {
    const data = await login('staff@kawahputih.test', 'password123')
    useAuthStore.getState().setTokens(data)
    useTenantStore.setState({ companyId: 'c1', companyName: 'Kawah Putih' })
  })

  it("shows the opened shift's tasks as a tickable checklist with progress", async () => {
    await startSession({ shiftId: 1 })
    const user = userEvent.setup()
    renderPanel()

    const boxes = await screen.findAllByRole('checkbox')
    expect(boxes).toHaveLength(5)
    expect(screen.getByText(/shift checklist · pagi/i)).toBeInTheDocument()
    expect(screen.getByText(/0 of 5 done/i)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /check fridge & freezer temperature/i }))
    expect(screen.getByText(/1 of 5 done/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /check fridge & freezer temperature/i })).toBeChecked()

    await user.click(screen.getByRole('checkbox', { name: /check fridge & freezer temperature/i }))
    expect(screen.getByText(/0 of 5 done/i)).toBeInTheDocument()
  })

  it('ticks survive a remount (e.g. tablet reload) and are stored against the session', async () => {
    const first = await startSession({ shiftId: 2 })
    const user = userEvent.setup()
    const { unmount } = renderPanel()
    await user.click((await screen.findAllByRole('checkbox'))[0])
    expect(useShiftChecklistStore.getState().sessionId).toBe(first.id)
    unmount()

    renderPanel()
    expect(await screen.findByText(/1 of 3 done/i)).toBeInTheDocument()
  })

  it('says so when this tablet does not know the shift (free text, or joined without a PIN)', async () => {
    await startSession({ shift: 'Shift 1' })
    renderPanel()
    expect(await screen.findByText(/no tasks for this shift/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing is set up for shift 1/i)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('says so when the shift has no tasks in Odoo', async () => {
    const session = await startSession()
    useShiftChecklistStore.getState().setShift(session.id, { id: '1', name: 'Pagi', tasks: [] })
    renderPanel()
    expect(await screen.findByText(/nothing is set up for pagi in odoo yet/i)).toBeInTheDocument()
  })

  it('has a progress bar that follows the ticks', async () => {
    await startSession({ shiftId: 3 })
    const user = userEvent.setup()
    renderPanel()
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    for (const box of await screen.findAllByRole('checkbox')) await user.click(box)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })
})
