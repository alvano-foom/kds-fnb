import { http, HttpResponse } from 'msw'
import {
  mockUser,
  mockCompanies,
  mockTenantConfig,
  mockOrders,
  toOrderLineCard,
  findLine,
} from './fixtures'

// Access tokens expire fast on purpose (60s) so the silent-refresh flow in
// useAuth actually gets exercised during normal dev use, not just in tests.
const ACCESS_TTL_MS = 60_000

function encode(obj) {
  return btoa(JSON.stringify(obj))
}
function decode(token) {
  try {
    return JSON.parse(atob(token))
  } catch {
    return null
  }
}

function issueTokens(userId) {
  return {
    access_token: encode({ type: 'access', userId, exp: Date.now() + ACCESS_TTL_MS }),
    refresh_token: encode({ type: 'refresh', userId, exp: Date.now() + 1000 * 60 * 60 * 24 }),
    expires_in: ACCESS_TTL_MS / 1000,
  }
}

function requireAuth(request) {
  const header = request.headers.get('authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '')
  const payload = decode(token)
  if (!payload || payload.type !== 'access' || payload.exp < Date.now()) return null
  return payload.userId
}

function errorResponse(status, code, message) {
  return HttpResponse.json({ error: { code, message } }, { status })
}

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const { email, password } = await request.json()
    if (email !== mockUser.email || password !== mockUser.password) {
      return errorResponse(401, 'invalid_credentials', 'Email or password is incorrect.')
    }
    return HttpResponse.json({
      ...issueTokens(mockUser.id),
      user: { id: mockUser.id, email: mockUser.email, name: mockUser.name },
    })
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    const { refresh_token } = await request.json()
    const payload = decode(refresh_token)
    if (!payload || payload.type !== 'refresh' || payload.exp < Date.now()) {
      return errorResponse(401, 'invalid_refresh_token', 'Refresh token is invalid or expired.')
    }
    return HttpResponse.json(issueTokens(payload.userId))
  }),

  http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/tenant/config', () => HttpResponse.json(mockTenantConfig)),

  http.get('/api/companies', ({ request }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const allowed = new Set(mockUser.company_ids)
    return HttpResponse.json(mockCompanies.filter((c) => allowed.has(c.id)))
  }),

  // One card per order LINE — kitchen_state lives on sale.order.line, not
  // sale.order, so an order with 3 lines can show up in 3 different columns.
  // Scoped by company_id only (no Point of Sale scoping).
  http.get('/api/order-lines', ({ request }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const url = new URL(request.url)
    const companyId = url.searchParams.get('company_id')
    const since = url.searchParams.get('since')

    const scopedOrders = mockOrders.filter((o) => o.company_id === companyId)
    let cards = scopedOrders.flatMap((order) => order.lines.map((line) => toOrderLineCard(order, line)))
    if (since) cards = cards.filter((c) => new Date(c.updated_at) > new Date(since))
    return HttpResponse.json(cards)
  }),

  http.patch('/api/order-lines/:lineId/state', async ({ request, params }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const found = findLine(params.lineId)
    if (!found) return errorResponse(404, 'not_found', 'Order line not found.')
    const { kitchen_state } = await request.json()

    // Demo of a server-enforced transition rule so the frontend's 409/rollback
    // path is exercisable without a real backend: once "served", a line can
    // only be reopened to "ready", never straight back to "pending".
    if (found.line.kitchen_state === 'served' && kitchen_state === 'pending') {
      return errorResponse(409, 'invalid_transition', 'Cannot move a served line back to pending.')
    }

    found.line.kitchen_state = kitchen_state
    found.line.updated_at = new Date().toISOString()
    return HttpResponse.json(toOrderLineCard(found.order, found.line))
  }),
]
