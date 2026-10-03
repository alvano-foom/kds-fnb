// Single source of truth for demo data. Used by both the MSW handlers
// (dev + tests) and the fake WebSocket, so what you see on the board and
// what the "backend" thinks match.
//
// Kitchen state lives on the order LINE (sale.order.line), not the order
// (sale.order) — an order can have some lines cooking and others already
// served. `client_order_ref` on the order is reused as a table number tag.

/** @type {import('../../types').User & { password: string, company_ids: string[] }} */
export const mockUser = {
  id: 'u1',
  email: 'staff@kawahputih.test',
  password: 'password123',
  name: 'Kawah Putih Staff',
  company_ids: ['c1', 'c2'],
}

/** @type {import('../../types').Company[]} */
export const mockCompanies = [
  { id: 'c1', name: 'Kawah Putih', logo_url: '' },
  { id: 'c2', name: 'Ciwidey Valley', logo_url: '' },
  { id: 'c3', name: 'Not Mine Corp', logo_url: '' }, // deliberately NOT in mockUser.company_ids
]

// Outlet name and logo are configurable per tenant via this endpoint —
// never hardcoded in the frontend. Brand color is NOT here: it's a
// frontend-only theme setting stored in the browser (see
// src/store/themeStore.js), not part of the API contract.
export const mockTenantConfig = {
  name: 'FOOM Outlet',
  logo_url: '',
}

const now = Date.now()
const minutesAgo = (m) => new Date(now - m * 60_000).toISOString()

/**
 * sale.order records, each with its own order_line children. `kitchen_state`
 * lives on each line; `client_order_ref` (table number) lives on the order.
 */
const mockSaleOrders = [
  {
    id: 'so1', name: 'SO0231', client_order_ref: '7', customer_name: 'Alex',
    company_id: 'c1',
    lines: [
      { id: 'l1', product_name: 'Fried Rice', qty: 2, kitchen_state: 'pending', created_at: minutesAgo(2), updated_at: minutesAgo(2) },
      { id: 'l2', product_name: 'Iced Tea', qty: 2, kitchen_state: 'pending', created_at: minutesAgo(2), updated_at: minutesAgo(2) },
    ],
  },
  {
    id: 'so2', name: 'SO0232', client_order_ref: '3', customer_name: 'Ben',
    company_id: 'c1',
    lines: [
      { id: 'l3', product_name: 'Chicken Noodle Soup', qty: 1, kitchen_state: 'pending', created_at: minutesAgo(4), updated_at: minutesAgo(4) },
    ],
  },
  {
    id: 'so3', name: 'SO0229', client_order_ref: '12', customer_name: 'Claire',
    company_id: 'c1',
    lines: [
      { id: 'l4', product_name: 'Chicken Satay', qty: 3, kitchen_state: 'cooking', created_at: minutesAgo(9), updated_at: minutesAgo(3) },
      { id: 'l5', product_name: 'Rice Cake', qty: 1, kitchen_state: 'ready', created_at: minutesAgo(9), updated_at: minutesAgo(1) },
    ],
  },
  {
    id: 'so4', name: 'SO0227', client_order_ref: '5', customer_name: 'Diana',
    company_id: 'c1',
    lines: [
      { id: 'l6', product_name: 'Vegetable Salad', qty: 1, kitchen_state: 'cooking', created_at: minutesAgo(12), updated_at: minutesAgo(5) },
    ],
  },
  {
    id: 'so5', name: 'SO0224', client_order_ref: '9', customer_name: 'Ethan',
    company_id: 'c1',
    lines: [
      { id: 'l7', product_name: 'Meatball Soup', qty: 2, kitchen_state: 'ready', created_at: minutesAgo(18), updated_at: minutesAgo(2) },
    ],
  },
  {
    id: 'so6', name: 'SO0220', client_order_ref: '1', customer_name: 'Fiona',
    company_id: 'c1',
    lines: [
      { id: 'l8', product_name: 'Crispy Fried Chicken', qty: 1, kitchen_state: 'served', created_at: minutesAgo(30), updated_at: minutesAgo(10) },
    ],
  },
  {
    id: 'so7', name: 'SO0233', client_order_ref: '2', customer_name: 'Grace',
    company_id: 'c1',
    lines: [
      { id: 'l9', product_name: 'Iced Coffee Latte', qty: 4, kitchen_state: 'pending', created_at: minutesAgo(1), updated_at: minutesAgo(1) },
    ],
  },
  {
    id: 'so8', name: 'SO0198', client_order_ref: '14', customer_name: 'Henry',
    company_id: 'c2',
    lines: [
      { id: 'l10', product_name: 'Steamed Rice Bundle', qty: 2, kitchen_state: 'ready', created_at: minutesAgo(20), updated_at: minutesAgo(4) },
    ],
  },
]

export const mockOrders = mockSaleOrders

let idCounter = 100
export function nextLineId() {
  idCounter += 1
  return `l${idCounter}`
}

/** Flatten sale.order + order_line records into the board's card shape. */
export function toOrderLineCard(order, line) {
  return {
    id: line.id,
    order_id: order.id,
    order_name: order.name,
    table_number: order.client_order_ref,
    customer_name: order.customer_name,
    product_name: line.product_name,
    qty: line.qty,
    note: line.note,
    kitchen_state: line.kitchen_state,
    created_at: line.created_at,
    updated_at: line.updated_at,
  }
}

export function findLine(lineId) {
  for (const order of mockOrders) {
    const line = order.lines.find((l) => l.id === lineId)
    if (line) return { order, line }
  }
  return null
}

// ---------------------------------------------------------------------------
// Kitchen session / production / scrap — mocks the real foom_fnb_api
// endpoints under /kitchen and /stock (see the API docs shared 2026-09-30).
// Kept in the same fixtures file as the order-board data above so a dev
// touching this file sees both halves of the mock backend together.
// ---------------------------------------------------------------------------

/** Stand-in for hr.employee + its Kode Absensi field (the real field name is configurable — see foom_fnb_api.employee_code_field). */
export const mockKitchenEmployees = [
  { id: 'e1', name: 'Bisma Fauzan', job_title: 'Line Cook', department: 'Kitchen', code: 'F102345', company_id: 'c1' },
  { id: 'e2', name: 'Siti Aminah', job_title: 'Head Cook', department: 'Kitchen', code: 'F100120', company_id: 'c1' },
  { id: 'e3', name: 'Rudi Hartono', job_title: 'Line Cook', department: 'Kitchen', code: 'F200560', company_id: 'c2' },
]

/**
 * Stand-in for GET /stock's product list. `available_qty` deliberately
 * limits "Sate Matang" to exercise the real 409 done_failed path (not
 * enough components) so the Production page's "needs attention" recovery
 * flow — retry / cancel — actually gets tested, not just the happy path.
 */
export const mockKitchenProducts = [
  { product_id: 'p1', name: 'Nasi Goreng Spesial', uom: 'Portion', kind: 'manufacture', available_qty: 50, is_available: true },
  { product_id: 'p2', name: 'Ayam Bakar', uom: 'Portion', kind: 'manufacture', available_qty: 30, is_available: true },
  { product_id: 'p3', name: 'Sate Matang', uom: 'Portion', kind: 'manufacture', available_qty: 3, is_available: true },
  { product_id: 'p4', name: 'Es Teh Manis', uom: 'Cup', kind: 'stock', available_qty: 100, is_available: true },
  { product_id: 'p5', name: 'Rendang Daging', uom: 'Portion', kind: 'manufacture', available_qty: 0, is_available: false },
]

/** @type {Map<string, object>} sessions keyed by id */
export let kitchenSessions = new Map()
/** company_id -> currently open session id (at most one, per the real API's rule) */
export let openSessionByCompany = new Map()
/** production_id -> { sessionId } for O(1) lookup by /kitchen/productions/:id/state */
export let productionIndex = new Map()

let kitchenSessionCounter = 0
let productionCounter = 0

export function resetKitchenMockData() {
  kitchenSessions = new Map()
  openSessionByCompany = new Map()
  productionIndex = new Map()
  kitchenSessionCounter = 0
  productionCounter = 0
}

export function findEmployeeByCode(code) {
  return mockKitchenEmployees.find((e) => e.code === code) || null
}

export function findKitchenProduct(productId) {
  return mockKitchenProducts.find((p) => p.product_id === productId) || null
}

export function nextKitchenSessionId() {
  kitchenSessionCounter += 1
  return `ks${kitchenSessionCounter}`
}

export function nextKitchenSessionName() {
  return `KIT/202609/${String(kitchenSessionCounter).padStart(4, '0')}`
}

export function nextProductionId() {
  productionCounter += 1
  return `mo${productionCounter}`
}

export function nextProductionName() {
  return `WH/MO/${String(productionCounter).padStart(5, '0')}`
}

/** Trims the full session record down to what /kitchen/whoami and list endpoints show — same shape either way, just without forcing every caller to know which fields exist. */
export function summarizeKitchenSession(session) {
  return session
}

// ---------------------------------------------------------------------------
// Shift master data (foom_attendance's POST /foom/attendance/api/shifts) and
// the kitchen BoM preview / MO components (foom_fnb_api, 2026-10-03/04).
// ---------------------------------------------------------------------------

/** Test PIN accepted by the mock attendance /login for every mock employee. */
export const MOCK_ATTENDANCE_PIN = '482913'

/**
 * Stand-in for foom.attendance.shift, in the real API's exact shape (integer
 * ids, time_from/time_to, is_overnight, tasks[] ordered by sequence).
 * `company_id` is mock-only bookkeeping — the real API scopes by the
 * employee behind the token and never returns it. The overnight (Lintas
 * Hari) shift and the second company exist so "pick the shift matching right
 * now" and company scoping are exercised with more than one candidate.
 */
function mockShift(id, name, code, from, to, overnight, hours, companyId, isDefault, tasks) {
  return {
    id,
    name,
    code,
    time_from: from,
    time_to: to,
    time_from_float: Number(from.slice(0, 2)) + Number(from.slice(3)) / 60,
    time_to_float: Number(to.slice(0, 2)) + Number(to.slice(3)) / 60,
    is_overnight: overnight,
    duration_hours: hours,
    grace_in_minutes: 10,
    grace_out_minutes: 0,
    early_in_window_minutes: 60,
    late_out_window_minutes: 240,
    enforce_window: false,
    is_default: isDefault,
    locations: [{ id: 1, name: 'Kantor Pusat' }],
    tasks: tasks.map(([tname, description], i) => ({
      id: id * 10 + i + 1,
      sequence: i + 1,
      name: tname,
      description: description ?? '',
    })),
    company_id: companyId,
  }
}

export const mockShifts = [
  mockShift(1, 'Pagi', 'P1', '08:00', '17:00', false, 9, 'c1', true, [
    ['Check fridge & freezer temperature, log it', 'Chiller 0–4 °C, freezer ≤ −18 °C'],
    ['Prep base sauces and marinades'],
    ['Cook a batch of rice for lunch service'],
    ['Label and date every prep container'],
    ['Handover note for the Siang shift'],
  ]),
  mockShift(2, 'Siang', 'S1', '14:00', '22:00', false, 8, 'c1', false, [
    ['Restock mise en place for dinner rush'],
    ['Check stock of fast-moving items (eggs, chicken, rice)'],
    ['Clean the grill and fryer between services'],
  ]),
  mockShift(3, 'Malam', 'M1', '22:00', '06:00', true, 8, 'c1', false, [
    ['Deep-clean stations and equipment'],
    ['Count remaining stock and record scrap'],
    ['Turn off gas and equipment, lock the storage'],
  ]),
  mockShift(4, 'Pagi', 'P1', '07:00', '15:00', false, 8, 'c2', true, [
    ['Check fridge temperature, log it'],
    ['Prep the morning mise en place'],
  ]),
]

/**
 * Stand-in for the default mrp.bom per finished product, per the real
 * /kitchen/boms contract: `qty_per_bom` is per `bom_qty` of finished product
 * (Odoo's product_qty); the handler scales it to the requested qty to give
 * `required_qty` / `shortage_qty` / `ok`. Es Teh Manis (kind 'stock') and
 * Rendang Daging deliberately have no BoM, to exercise 409 no_bom.
 */
export const mockBoms = {
  p1: {
    bom_id: '1', bom_code: 'BOM-NGS', bom_type: 'normal', product_id: 'p1', barcode: 'NASGOR-01',
    product_name: 'Nasi Goreng Spesial', bom_qty: 1, bom_uom: 'Portion',
    components: [
      { product_id: 'c1', barcode: 'NASI-01', name: 'Nasi Putih', uom: 'g', qty_per_bom: 200, available_qty: 12000 },
      { product_id: 'c2', barcode: 'TELUR-01', name: 'Telur Ayam', uom: 'pcs', qty_per_bom: 1, available_qty: 90 },
      { product_id: 'c3', barcode: 'BUMBU-01', name: 'Bumbu Nasi Goreng', uom: 'g', qty_per_bom: 15, available_qty: 2000 },
    ],
  },
  p2: {
    bom_id: '2', bom_code: 'BOM-AB', bom_type: 'normal', product_id: 'p2', barcode: 'AYAM-01',
    product_name: 'Ayam Bakar', bom_qty: 2, bom_uom: 'Portion',
    components: [
      { product_id: 'c4', barcode: 'AYAMP-01', name: 'Ayam Potong', uom: 'g', qty_per_bom: 600, available_qty: 8000 },
      { product_id: 'c5', barcode: 'BUMBUB-01', name: 'Bumbu Bakar', uom: 'g', qty_per_bom: 50, available_qty: 1500 },
    ],
  },
  p3: {
    bom_id: '3', bom_code: 'BOM-SM', bom_type: 'normal', product_id: 'p3', barcode: 'SATE-01',
    product_name: 'Sate Matang', bom_qty: 1, bom_uom: 'Portion',
    components: [
      { product_id: 'c6', barcode: 'DAGING-01', name: 'Daging Sate', uom: 'g', qty_per_bom: 150, available_qty: 450 },
      { product_id: 'c7', barcode: 'TUSUK-01', name: 'Tusuk Sate', uom: 'pcs', qty_per_bom: 5, available_qty: 400 },
    ],
  },
}

/** Mirrors /kitchen/boms for a requested qty (default: one batch). */
export function previewBom(bom, qty) {
  const requested = qty ?? bom.bom_qty
  const factor = requested / bom.bom_qty
  const components = bom.components.map((c) => {
    const required = Math.round(c.qty_per_bom * factor * 1000) / 1000
    const shortage = Math.max(0, Math.round((required - c.available_qty) * 1000) / 1000)
    return { ...c, required_qty: required, shortage_qty: shortage, ok: shortage === 0 }
  })
  return {
    ...bom,
    qty: requested,
    uom: bom.bom_uom,
    factor,
    warehouse_id: '1',
    warehouse_name: 'FOOM Pusat',
    location_id: null,
    location_name: '',
    ok: components.every((c) => c.ok),
    components,
  }
}

/** /kitchen/productions/{id}/components for a mock MO: its BoM scaled to the MO qty, minus what has already been scrapped. */
export function productionComponents(production, scraps) {
  const bom = mockBoms[production.product_id]
  if (!bom) return []
  const factor = production.qty / bom.bom_qty
  return bom.components.map((c, i) => {
    const scrapped = scraps
      .filter((s) => s.production_id === production.id && s.product_id === c.product_id)
      .reduce((sum, s) => sum + s.qty, 0)
    const toConsume = Math.round(c.qty_per_bom * factor * 1000) / 1000
    return {
      move_id: `${production.id}-${i + 1}`,
      product_id: c.product_id,
      barcode: c.barcode,
      name: c.name,
      uom: c.uom,
      uom_id: '1',
      to_consume_qty: toConsume,
      reserved_qty: production.state === 'done' ? toConsume : 0,
      picked: production.state === 'done',
      available_qty: Math.max(0, c.available_qty - toConsume - scrapped),
      scrapped_qty: scrapped,
      state: production.state === 'done' ? 'done' : 'assigned',
    }
  })
}
