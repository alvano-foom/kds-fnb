import { beforeEach, describe, expect, it } from 'vitest'
import { login } from '@/api/auth'
import { openKitchenSession, createProduction, setProductionState } from '@/api/kitchen'
import { useAuthStore } from '@/store/authStore'
import { useTenantStore } from '@/store/tenantStore'
import { useErrorLogStore } from '@/store/errorLogStore'
import { storeConnectRequests } from '@/mocks/fixtures'
import { syncStoreStock } from './storeStockSync'

describe('syncStoreStock', () => {
  beforeEach(async () => {
    useAuthStore.getState().setTokens(await login('staff@kawahputih.test', 'password123'))
    useTenantStore.setState({ companyId: '1', warehouseId: '1', locationId: '12' })
  })

  it('after a prep, sends the product on-hand at the configured location to Store Connect', async () => {
    await openKitchenSession({ companyId: '1', employeeCode: 'F102345', shift: 'Pagi' })
    const mo = await createProduction({ companyId: '1', employeeCode: 'F102345', productId: 'p1', qty: 3 })
    const done = await setProductionState(mo.id, { employeeCode: 'F102345', action: 'done', qty: 3 })

    const result = await syncStoreStock(done)

    // 4 seeded on hand + 3 just made
    expect(result).toEqual({ barcode: 'NASGOR-01', qty: 7, apiId: expect.any(String) })
    expect(storeConnectRequests).toEqual([
      { company_id: 1, location_id: 12, warehouse_id: 1, items: [{ barcode: 'NASGOR-01', qty: 7 }] },
    ])
    expect(useErrorLogStore.getState().entries).toEqual([])
  })

  it('logs to the Error Log instead of throwing when Store Connect rejects the barcode', async () => {
    const result = await syncStoreStock({ barcode: 'RENDANG-01', product_name: 'Rendang Daging' })

    expect(result).toBeNull()
    expect(useErrorLogStore.getState().entries[0]).toMatchObject({
      category: 'store-connect',
      message: 'Store Connect stock not updated for Rendang Daging.',
      detail: expect.stringMatching(/^Store Connect: Barcode not found: RENDANG-01 \(api_id \w+\)$/),
    })
  })

  it('logs and skips when the product has no barcode or the device has no location', async () => {
    expect(await syncStoreStock({ product_name: 'Mystery' })).toBeNull()
    useTenantStore.setState({ locationId: null })
    expect(await syncStoreStock({ barcode: 'AYAM-01', product_name: 'Ayam Bakar' })).toBeNull()

    expect(useErrorLogStore.getState().entries.map((e) => e.message)).toEqual([
      'Store Connect stock not sent for Ayam Bakar: pick a warehouse and location in Settings.',
      'Store Connect stock not sent for Mystery: the product has no barcode.',
    ])
    expect(storeConnectRequests).toHaveLength(0)
  })
})
