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
