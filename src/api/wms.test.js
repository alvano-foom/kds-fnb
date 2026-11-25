import { beforeEach, describe, expect, it } from 'vitest'
import { login } from './auth'
import { useAuthStore } from '@/store/authStore'
import { listLocations, listWarehouses } from './wms'

describe('wms (via this app backend)', () => {
  beforeEach(async () => {
    useAuthStore.getState().setTokens(await login('staff@kawahputih.test', 'password123'))
  })

  it('lists warehouses and locations without the browser holding any WMS key', async () => {
    expect((await listWarehouses('1')).map((w) => w.code)).toEqual(['KP', 'KPK'])
    expect((await listLocations('1', '1')).map((l) => l.complete_name)).toEqual(['KP/Stock', 'KP/Stock/Kitchen'])
  })

  it("surfaces the backend's message for a company the user can't access", async () => {
    await expect(listWarehouses('3')).rejects.toMatchObject({ status: 403, message: 'You do not have access to this company.' })
  })
})
