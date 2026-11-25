import { afterEach, describe, expect, it, vi } from 'vitest'
import { listWarehouses } from './wms'

describe('listWarehouses', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads every page with the API key and company header', async () => {
    const list = await listWarehouses('1')
    expect(list.map((w) => w.code)).toEqual(['KP', 'KPK'])
  })

  it('explains a missing API key instead of calling the server', async () => {
    vi.stubEnv('VITE_WMS_API_KEY', '')
    await expect(listWarehouses('1')).rejects.toMatchObject({
      code: 'missing_api_key',
      message: expect.stringMatching(/VITE_WMS_API_KEY is not set/),
    })
  })

  it('surfaces the server message for a wrong key', async () => {
    vi.stubEnv('VITE_WMS_API_KEY', 'wrong')
    await expect(listWarehouses('1')).rejects.toMatchObject({ status: 401, code: 'WMS_UNAUTHORIZED' })
  })
})
