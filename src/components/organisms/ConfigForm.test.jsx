import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigForm } from './ConfigForm'
import { login } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { useTenantStore } from '@/store/tenantStore'

function renderWithClient(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('ConfigForm', () => {
  beforeEach(async () => {
    // Real login against the mock handlers so the token the rest of the
    // form sends is one requireAuth() actually accepts.
    const data = await login('staff@kawahputih.test', 'password123')
    useAuthStore.getState().setTokens(data)
  })

  it("only lists the user's companies, and enables save once company, warehouse and location are picked", async () => {
    const user = userEvent.setup()
    renderWithClient(<ConfigForm onSaved={vi.fn()} />)

    const companySelect = await screen.findByLabelText('Company')
    expect(screen.queryByText('Not Mine Corp')).not.toBeInTheDocument()

    const saveButton = screen.getByRole('button', { name: /save configuration/i })
    expect(saveButton).toBeDisabled()
    expect(screen.getByLabelText('Warehouse')).toBeDisabled()

    await user.selectOptions(companySelect, 'Kawah Putih')
    expect(saveButton).toBeDisabled()

    await screen.findByRole('option', { name: 'KP · Kawah Putih Main' })
    await user.selectOptions(screen.getByLabelText('Warehouse'), 'KP · Kawah Putih Main')
    expect(screen.queryByText('Ciwidey Valley Main', { exact: false })).not.toBeInTheDocument()
    expect(saveButton).toBeDisabled()

    await screen.findByRole('option', { name: 'KP/Stock/Kitchen' })
    await user.selectOptions(screen.getByLabelText('Location'), 'KP/Stock/Kitchen')

    expect(saveButton).not.toBeDisabled()
    expect(useTenantStore.getState()).toMatchObject({
      companyId: '1',
      warehouseId: '1',
      warehouseName: 'KP · Kawah Putih Main',
      locationId: '12',
      locationName: 'KP/Stock/Kitchen',
    })
  })

  it('clears warehouse and location when the company changes', async () => {
    const user = userEvent.setup()
    useTenantStore.setState({ companyId: '1', warehouseId: '1', locationId: '12' })
    renderWithClient(<ConfigForm onSaved={vi.fn()} />)

    await user.selectOptions(await screen.findByLabelText('Company'), 'Ciwidey Valley')

    expect(useTenantStore.getState()).toMatchObject({ companyId: '2', warehouseId: null, locationId: null })
    expect(await screen.findByRole('option', { name: 'CV · Ciwidey Valley Main' })).toBeInTheDocument()
  })

  it('persists picked colors to the local theme store, not the API', async () => {
    renderWithClient(<ConfigForm onSaved={vi.fn()} />)
    await screen.findByLabelText('Company')

    const primaryInput = screen.getByLabelText('Primary Color')
    fireEvent.change(primaryInput, { target: { value: '#123456' } })

    expect(useThemeStore.getState().primaryColor).toBe('#123456')
    expect(JSON.parse(localStorage.getItem('kds_theme')).state.primaryColor).toBe('#123456')
  })
})
