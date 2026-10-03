import { beforeEach, describe, expect, it } from 'vitest'
import { login } from './auth'
import {
  openKitchenSession,
  createProduction,
  setProductionState,
  getBomPreview,
  getProductionComponents,
  createProductionScraps,
  listProductionScraps,
} from './kitchen'
import { useAuthStore } from '../store/authStore'

async function setUp() {
  useAuthStore.getState().setTokens(await login('staff@kawahputih.test', 'password123'))
  await openKitchenSession({ companyId: 'c1', employeeCode: 'F102345', shift: 'Pagi' })
}

async function doneMo(productId, qty) {
  const mo = await createProduction({ companyId: 'c1', employeeCode: 'F102345', productId, qty })
  await setProductionState(mo.id, { employeeCode: 'F102345', action: 'done', qty })
  return mo
}

describe('GET /kitchen/boms', () => {
  beforeEach(setUp)

  it('scales components to the requested qty and flags shortages (read-only hint)', async () => {
    const bom = await getBomPreview({ companyId: 'c1', productId: 'p3', qty: 9 })
    expect(bom.qty).toBe(9)
    expect(bom.factor).toBe(9)
    expect(bom.ok).toBe(false)
    const daging = bom.components.find((c) => c.name === 'Daging Sate')
    expect(daging).toMatchObject({ qty_per_bom: 150, required_qty: 1350, available_qty: 450, shortage_qty: 900, ok: false })
    expect(bom.components.find((c) => c.name === 'Tusuk Sate')).toMatchObject({ required_qty: 45, ok: true })
  })

  it("divides by the BoM's batch size (BoM makes 2, ask for 6 → 3 batches)", async () => {
    const bom = await getBomPreview({ companyId: 'c1', productId: 'p2', qty: 6 })
    expect(bom.components.find((c) => c.name === 'Ayam Potong').required_qty).toBe(1800)
  })

  it('defaults to one batch when qty is omitted', async () => {
    const bom = await getBomPreview({ companyId: 'c1', productId: 'p2' })
    expect(bom.qty).toBe(2)
    expect(bom.components.find((c) => c.name === 'Ayam Potong').required_qty).toBe(600)
  })

  it('409 no_bom for a product without a BoM, 400 for qty ≤ 0', async () => {
    await expect(getBomPreview({ companyId: 'c1', productId: 'p4', qty: 1 })).rejects.toMatchObject({ status: 409, code: 'no_bom' })
    await expect(getBomPreview({ companyId: 'c1', productId: 'p1', qty: 0 })).rejects.toMatchObject({ status: 400 })
  })
})

describe('MO components + scraps', () => {
  beforeEach(setUp)

  it('lists only the ingredients, scaled to the MO qty', async () => {
    const mo = await doneMo('p2', 4) // BoM makes 2 → 2 batches
    const res = await getProductionComponents(mo.id)
    expect(res.components.map((c) => c.name)).toEqual(['Ayam Potong', 'Bumbu Bakar'])
    expect(res.components[0]).toMatchObject({ to_consume_qty: 1200, scrapped_qty: 0 })
    expect(res.components.some((c) => c.name === 'Ayam Bakar')).toBe(false)
  })

  it('records scrap and returns refreshed components', async () => {
    const mo = await doneMo('p1', 5)
    const res = await createProductionScraps(mo.id, {
      employeeCode: 'F102345',
      items: [{ product_id: 'c1', qty: 50, reason: 'gosong' }],
    })
    expect(res.scraps[0]).toMatchObject({ product_name: 'Nasi Putih', qty: 50, state: 'done', reason: 'gosong', production_id: mo.id })
    expect(res.components.find((c) => c.name === 'Nasi Putih').scrapped_qty).toBe(50)
    expect((await listProductionScraps(mo.id)).scraps).toHaveLength(1)
  })

  it('rejects the finished good and anything outside the BoM with 400 not_a_component', async () => {
    const mo = await doneMo('p1', 5)
    await expect(
      createProductionScraps(mo.id, { employeeCode: 'F102345', items: [{ product_id: 'p1', qty: 1 }] }),
    ).rejects.toMatchObject({ status: 400, code: 'not_a_component' })
    await expect(
      createProductionScraps(mo.id, { employeeCode: 'F102345', items: [{ product_id: 'c6', qty: 1 }] }),
    ).rejects.toMatchObject({ status: 400, code: 'not_a_component' })
  })

  it('is all-or-nothing: one bad item means nothing is recorded', async () => {
    const mo = await doneMo('p1', 5)
    await expect(
      createProductionScraps(mo.id, {
        employeeCode: 'F102345',
        items: [{ product_id: 'c1', qty: 10 }, { product_id: 'p1', qty: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'not_a_component' })
    expect((await listProductionScraps(mo.id)).scraps).toHaveLength(0)
  })

  it('409 scrap_failed when stock is insufficient; 401 for a bad Kode Absensi; 400 for empty items', async () => {
    const mo = await doneMo('p3', 2)
    await expect(
      createProductionScraps(mo.id, { employeeCode: 'F102345', items: [{ product_id: 'c6', qty: 9999 }] }),
    ).rejects.toMatchObject({ status: 409, code: 'scrap_failed' })
    await expect(createProductionScraps(mo.id, { employeeCode: 'NOPE', items: [{ product_id: 'c6', qty: 1 }] })).rejects.toMatchObject({
      status: 401,
      code: 'invalid_employee_code',
    })
    await expect(createProductionScraps(mo.id, { employeeCode: 'F102345', items: [] })).rejects.toMatchObject({ status: 400 })
  })

  it('404 for an unknown MO', async () => {
    await expect(getProductionComponents('nope')).rejects.toMatchObject({ status: 404 })
  })
})
