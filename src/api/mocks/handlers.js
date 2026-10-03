import { http, HttpResponse } from 'msw'
import {
  mockUser,
  mockCompanies,
  mockTenantConfig,
  mockOrders,
  toOrderLineCard,
  findLine,
  mockKitchenProducts,
  mockShifts,
  mockBoms,
  previewBom,
  productionComponents,
  MOCK_ATTENDANCE_PIN,
  kitchenSessions,
  openSessionByCompany,
  productionIndex,
  findEmployeeByCode,
  findKitchenProduct,
  nextKitchenSessionId,
  nextKitchenSessionName,
  nextProductionId,
  nextProductionName,
} from './fixtures'

/** attendance token -> employee, for the mock /foom/attendance/api endpoints */
const attendanceTokens = new Map()

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

  // -------------------------------------------------------------------
  // Kitchen session / production / scrap (foom_fnb_api's /kitchen, /stock)
  // -------------------------------------------------------------------

  http.post('/api/kitchen/whoami', async ({ request }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const { company_id, employee_code } = await request.json()
    const employee = findEmployeeByCode(employee_code)
    if (!employee) return errorResponse(401, 'invalid_employee_code', 'Kode absensi tidak dikenal.')
    const openId = openSessionByCompany.get(company_id)
    const open = openId ? kitchenSessions.get(openId) : null
    return HttpResponse.json({
      employee: { id: employee.id, name: employee.name, job_title: employee.job_title, department: employee.department },
      company_id,
      open_session: open || null,
    })
  }),

  http.post('/api/kitchen/sessions', async ({ request }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const { company_id, employee_code, shift } = await request.json()
    const employee = findEmployeeByCode(employee_code)
    if (!employee) return errorResponse(401, 'invalid_employee_code', 'Kode absensi tidak dikenal.')

    const existingId = openSessionByCompany.get(company_id)
    if (existingId) {
      return errorResponse(409, 'session_already_open', 'Dapur sudah dibuka oleh sesi lain.', {
        session: kitchenSessions.get(existingId),
      })
    }

    const id = nextKitchenSessionId()
    const session = {
      id,
      name: nextKitchenSessionName(),
      state: 'open',
      shift: shift || '', // free text, like the real kitchen API — the shift list lives in foom_attendance
      warehouse_id: 'w1',
      company_id,
      opened_by: { id: employee.id, name: employee.name },
      opened_at: new Date().toISOString(),
      closed_by: null,
      closed_at: null,
      production_count: 0,
      scrap_count: 0,
      productions: [],
      scraps: [],
      logs: [{ action: 'open', employee: employee.name, at: new Date().toISOString() }],
    }
    kitchenSessions.set(id, session)
    openSessionByCompany.set(company_id, id)
    return HttpResponse.json(session, { status: 201 })
  }),

  http.get('/api/kitchen/sessions/:id', ({ params }) => {
    const session = kitchenSessions.get(params.id)
    if (!session) return errorResponse(404, 'not_found', 'Session not found.')
    return HttpResponse.json(session)
  }),

  http.get('/api/kitchen/sessions', ({ request }) => {
    const url = new URL(request.url)
    const companyId = url.searchParams.get('company_id')
    const state = url.searchParams.get('state')
    let results = [...kitchenSessions.values()]
    if (companyId) results = results.filter((s) => s.company_id === companyId)
    if (state) results = results.filter((s) => s.state === state)
    return HttpResponse.json(results)
  }),

  http.post('/api/kitchen/productions', async ({ request }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const { company_id, employee_code, product_id, qty } = await request.json()
    const employee = findEmployeeByCode(employee_code)
    if (!employee) return errorResponse(401, 'invalid_employee_code', 'Kode absensi tidak dikenal.')
    const openId = openSessionByCompany.get(company_id)
    const session = openId ? kitchenSessions.get(openId) : null
    if (!session) return errorResponse(409, 'no_open_session', 'Tidak ada sesi dapur yang terbuka.')
    const product = findKitchenProduct(product_id)
    if (!product) return errorResponse(409, 'no_bom', 'Produk tidak punya Bill of Materials.')
    if (typeof qty !== 'number' || qty <= 0) {
      return errorResponse(400, 'bad_request', 'qty must be a number > 0.')
    }

    const id = nextProductionId()
    const production = {
      id,
      name: nextProductionName(),
      state: 'confirmed',
      product_id: product.product_id,
      product_name: product.name,
      qty,
      qty_producing: 0,
      uom: product.uom,
      session_id: session.id,
      requested_by: employee.name,
      components: [],
    }
    session.productions.push(production)
    session.production_count = session.productions.length
    session.logs.push({ action: 'mo_create', employee: employee.name, at: new Date().toISOString(), record: production.name })
    productionIndex.set(id, { sessionId: session.id })
    return HttpResponse.json(production, { status: 201 })
  }),

  http.post('/api/kitchen/productions/:id/state', async ({ request, params }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const entry = productionIndex.get(params.id)
    if (!entry) return errorResponse(404, 'not_found', 'Production not found.')
    const session = kitchenSessions.get(entry.sessionId)
    const production = session.productions.find((p) => p.id === params.id)
    const { employee_code, action, qty } = await request.json()
    const employee = findEmployeeByCode(employee_code)
    if (!employee) return errorResponse(401, 'invalid_employee_code', 'Kode absensi tidak dikenal.')

    if (action === 'confirm') {
      // no-op in this mock — productions are already created confirmed, matching the real backend's default.
    } else if (action === 'start') {
      production.state = 'in_progress'
      production.qty_producing = qty ?? production.qty
    } else if (action === 'done') {
      const product = findKitchenProduct(production.product_id)
      const requestedQty = qty ?? production.qty
      if (product?.available_qty != null && requestedQty > product.available_qty) {
        return errorResponse(409, 'done_failed', `Not enough components available for ${product.name}.`)
      }
      production.state = 'done'
      production.qty_producing = requestedQty
    } else if (action === 'cancel') {
      production.state = 'cancelled'
    } else {
      return errorResponse(400, 'bad_request', `Unknown action "${action}".`)
    }
    session.logs.push({ action: `mo_${action}`, employee: employee.name, at: new Date().toISOString(), record: production.name })
    return HttpResponse.json(production)
  }),

  http.post('/api/kitchen/sessions/:id/close', async ({ request, params }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const session = kitchenSessions.get(params.id)
    if (!session) return errorResponse(404, 'not_found', 'Session not found.')
    if (session.state === 'closed') return errorResponse(409, 'session_already_closed', 'Session already closed.')

    const { employee_code, scraps, cancel_pending, force } = await request.json()
    const employee = findEmployeeByCode(employee_code)
    if (!employee) return errorResponse(401, 'invalid_employee_code', 'Kode absensi tidak dikenal.')

    const pending = session.productions.filter((p) => !['done', 'cancelled'].includes(p.state))
    if (pending.length > 0 && !force) {
      if (cancel_pending) {
        for (const p of pending) p.state = 'cancelled'
      } else {
        return errorResponse(409, 'pending_productions', 'Masih ada MO yang belum done atau cancel.', {
          productions: pending,
        })
      }
    }

    for (const entry of scraps || []) {
      if (entry.production_id && !session.productions.some((p) => p.id === entry.production_id)) {
        return errorResponse(400, 'bad_request', `Production ${entry.production_id} does not belong to this session.`)
      }
      session.scraps.push({
        product_id: entry.product_id,
        qty: entry.qty,
        production_id: entry.production_id || null,
        reason: entry.reason || '',
        recorded_at: new Date().toISOString(),
      })
    }
    session.scrap_count = session.scraps.length
    session.state = 'closed'
    session.closed_by = { id: employee.id, name: employee.name }
    session.closed_at = new Date().toISOString()
    session.logs.push({ action: 'close', employee: employee.name, at: session.closed_at })
    openSessionByCompany.delete(session.company_id)
    return HttpResponse.json(session)
  }),

  http.get('/api/kitchen/boms', ({ request }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const url = new URL(request.url)
    if (!url.searchParams.get('company_id')) return errorResponse(400, 'bad_request', 'company_id is required.')
    const productId = url.searchParams.get('product_id')
    const barcode = url.searchParams.get('barcode')
    if (!productId && !barcode) return errorResponse(400, 'bad_request', 'barcode or product_id is required.')
    const qtyParam = url.searchParams.get('qty')
    const qty = qtyParam == null ? undefined : Number(qtyParam)
    if (qty !== undefined && !(qty > 0)) return errorResponse(400, 'bad_request', 'qty must be a number > 0.')
    const known = mockKitchenProducts.find((p) => p.product_id === productId) || null
    if (productId && !known) return errorResponse(404, 'not_found', 'Product not found.')
    const bom = Object.values(mockBoms).find((b) => b.product_id === productId || b.barcode === barcode)
    if (!bom) return errorResponse(409, 'no_bom', 'Produk tidak punya Bill of Materials.')
    return HttpResponse.json(previewBom(bom, qty))
  }),

  http.get('/api/kitchen/productions/:id/components', ({ request, params }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const entry = productionIndex.get(params.id)
    if (!entry) return errorResponse(404, 'not_found', 'Production not found.')
    const session = kitchenSessions.get(entry.sessionId)
    const production = session.productions.find((p) => p.id === params.id)
    return HttpResponse.json({
      production_id: production.id,
      name: production.name,
      state: production.state,
      product_id: production.product_id,
      product_name: production.product_name,
      qty: production.qty,
      uom: production.uom,
      components: productionComponents(production, session.scraps),
    })
  }),

  http.get('/api/kitchen/productions/:id/scraps', ({ request, params }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const entry = productionIndex.get(params.id)
    if (!entry) return errorResponse(404, 'not_found', 'Production not found.')
    const session = kitchenSessions.get(entry.sessionId)
    const production = session.productions.find((p) => p.id === params.id)
    const scraps = session.scraps.filter((x) => x.production_id === params.id).reverse()
    return HttpResponse.json({ production_id: production.id, name: production.name, scraps })
  }),

  http.post('/api/kitchen/productions/:id/scraps', async ({ request, params }) => {
    const userId = requireAuth(request)
    if (!userId) return errorResponse(401, 'unauthorized', 'Missing or expired access token.')
    const entry = productionIndex.get(params.id)
    if (!entry) return errorResponse(404, 'not_found', 'Production not found.')
    const session = kitchenSessions.get(entry.sessionId)
    const production = session.productions.find((p) => p.id === params.id)
    const { employee_code, items } = await request.json()
    const employee = findEmployeeByCode(employee_code)
    if (!employee) return errorResponse(401, 'invalid_employee_code', 'Kode absensi tidak dikenal.')
    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(400, 'bad_request', 'items must be a non-empty list.')
    }

    // Validate everything before writing anything — the real endpoint is all-or-nothing per request.
    const components = productionComponents(production, session.scraps)
    const accepted = []
    for (const item of items) {
      if (!(Number(item.qty) > 0)) return errorResponse(400, 'bad_request', 'qty must be a number > 0.')
      const comp = components.find((c) => c.product_id === item.product_id || (item.barcode && c.barcode === item.barcode))
      if (!comp) {
        const finished = item.product_id === production.product_id
        return errorResponse(
          400,
          'not_a_component',
          finished
            ? `${production.product_name} is what ${production.name} produces, not one of its ingredients. Scrap a component instead, or send "allow_finished": true if the finished goods really are being thrown away.`
            : `${item.product_id ?? item.barcode} is not a component of ${production.name}. Call GET /kitchen/productions/${production.id}/components for the list.`,
        )
      }
      if (Number(item.qty) > comp.available_qty) {
        return errorResponse(409, 'scrap_failed', `Not enough ${comp.name} in stock to scrap ${item.qty} ${comp.uom}.`)
      }
      accepted.push({ comp, item })
    }

    const created = accepted.map(({ comp, item }, i) => {
      const n = session.scraps.length + i + 1
      const record = {
        id: `sp${n}`,
        name: `SP/${String(n).padStart(5, '0')}`,
        product_id: comp.product_id,
        barcode: comp.barcode,
        product_name: comp.name,
        qty: Number(item.qty),
        uom: comp.uom,
        reason: item.reason || '',
        state: 'done',
        production_id: production.id,
        date_done: new Date().toISOString(),
        scrapped_by: employee.name,
      }
      return record
    })
    session.scraps.push(...created)
    session.scrap_count = session.scraps.length
    session.logs.push({ action: 'scrap', employee: employee.name, at: new Date().toISOString(), record: production.name })
    return HttpResponse.json(
      {
        production_id: production.id,
        name: production.name,
        scraps: created,
        components: productionComponents(production, session.scraps),
      },
      { status: 201 },
    )
  }),

  http.get('/api/stock', ({ request }) => {
    const url = new URL(request.url)
    const companyId = url.searchParams.get('company_id')
    if (!companyId) return errorResponse(400, 'bad_request', 'company_id is required.')
    const productIds = url.searchParams.get('product_ids')?.split(',').filter(Boolean)
    // kitchen_only=1 is accepted (matching the real contract) but is a
    // no-op here — every seeded mock product is already a kitchen item.
    let products = mockKitchenProducts
    if (productIds?.length) products = products.filter((p) => productIds.includes(p.product_id))
    return HttpResponse.json({
      company_id: companyId,
      warehouse_id: 'w1',
      warehouse_name: 'Main Warehouse',
      products,
    })
  }),
  // -------------------------------------------------------------------
  // foom_attendance public API (separate from /api/kds): token login with
  // Kode Absensi + PIN, then POST /shifts. Plain JSON, {ok, error, message}.
  // -------------------------------------------------------------------

  http.post('/foom/attendance/api/login', async ({ request }) => {
    const { code, pin } = await request.json()
    const employee = findEmployeeByCode(code)
    if (!employee || pin !== MOCK_ATTENDANCE_PIN) {
      return HttpResponse.json(
        { ok: false, error: 'invalid_credentials', message: 'Kode atau PIN salah.' },
        { status: 401 },
      )
    }
    const token = `att-${employee.id}-${Math.random().toString(36).slice(2, 10)}`
    attendanceTokens.set(token, employee)
    return HttpResponse.json({
      ok: true,
      token,
      expire_at: new Date(Date.now() + 12 * 3600_000).toISOString().slice(0, 19).replace('T', ' '),
      employee: { name: employee.name, code: employee.code },
    })
  }),

  http.post('/foom/attendance/api/shifts', async ({ request }) => {
    const { token } = await request.json()
    const employee = attendanceTokens.get(token)
    if (!employee) {
      return HttpResponse.json(
        { ok: false, error: 'unauthorized', message: 'Sesi berakhir. Silakan masuk lagi.' },
        { status: 401 },
      )
    }
    const shifts = mockShifts.filter((x) => x.company_id === employee.company_id).map(({ company_id: _omit, ...rest }) => rest)
    return HttpResponse.json({ ok: true, timezone: 'Asia/Jakarta', shifts })
  }),
]
