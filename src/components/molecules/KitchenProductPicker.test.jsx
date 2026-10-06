import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '../../test/server'
import { useTenantStore } from '../../store/tenantStore'
import { KitchenProductPicker } from './KitchenProductPicker'

describe('KitchenProductPicker', () => {
  it('lets the operator pick a product that has 0 on hand', async () => {
    server.use(
      http.get('*/api/kds/stock', () =>
        HttpResponse.json({ products: [{ product_id: '9', name: 'MIE KUAH', uom: 'Units', available_qty: 0, is_available: false }] }),
      ),
      http.get('*/api/stock', () =>
        HttpResponse.json({ products: [{ product_id: '9', name: 'MIE KUAH', uom: 'Units', available_qty: 0, is_available: false }] }),
      ),
    )
    useTenantStore.setState({ companyId: 'c1', companyName: 'Kawah Putih' })
    const onSelect = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <KitchenProductPicker selected={null} onSelect={onSelect} />
      </QueryClientProvider>,
    )
    const option = await screen.findByRole('button', { name: /MIE KUAH/ })
    expect(option).toBeEnabled()
    await userEvent.click(option)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ product_id: '9' }))
  })
})
