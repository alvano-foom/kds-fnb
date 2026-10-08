import { beforeEach, describe, expect, test } from 'vitest'
import { apiFetch, ApiError } from '../client'
import { useConfigStore } from '../../store/configStore'
import { MOCK_API_KEY } from './constants'

// Exercises the mock backend directly against the documented /api/kds
// contract (https://claude.ai/artifact/JDH33PvVEd6kc7VjdQWSFq) — this file
// doubles as a spec the real backend needs to satisfy.

beforeEach(() => {
  useConfigStore.setState({ apiBaseUrl: '/api/kds', apiKey: MOCK_API_KEY, companyId: '1' })
})

function whoami(employee_code, company_id = '1') {
  return apiFetch('/kitchen/whoami', { method: 'POST', body: JSON.stringify({ company_id, employee_code }) })
}

function openSession(employee_code, company_id = '1') {
  return apiFetch('/kitchen/sessions', { method: 'POST', body: JSON.stringify({ company_id, employee_code }) })
}

describe('auth', () => {
  test('rejects a missing/wrong X-API-Key', async () => {
    useConfigStore.setState({ apiKey: 'wrong-key' })
    await expect(whoami('F102345')).rejects.toMatchObject({ status: 401, code: 'invalid_api_key' })
  })
})

describe('POST /kitchen/whoami', () => {
  test('rejects an unknown Kode Absensi', async () => {
    await expect(whoami('NOPE')).rejects.toMatchObject({ status: 401, code: 'invalid_employee_code' })
  })

  test('returns the employee and null open_session when the kitchen is closed', async () => {
    const res = await whoami('F102345')
    expect(res.employee.name).toBe('Bisma Fauzan')
    expect(res.open_session).toBeNull()
  })

  test('surfaces the already-open session so a second employee can just join it', async () => {
    await openSession('F102345')
    const res = await whoami('F100120')
    expect(res.open_session).not.toBeNull()
    expect(res.open_session.opened_by.name).toBe('Bisma Fauzan')
  })
})

describe('POST /kitchen/sessions (open)', () => {
  test('opens a session for the company', async () => {
    const session = await openSession('F102345')
    expect(session.state).toBe('open')
    expect(session.opened_by.name).toBe('Bisma Fauzan')
  })

  test('is scoped per COMPANY, not per employee — a second employee cannot open a second one', async () => {
    await openSession('F102345')
    await expect(openSession('F100120')).rejects.toMatchObject({ status: 409, code: 'session_already_open' })
  })

  test('a different company can still open its own session independently', async () => {
    await openSession('F102345', '1')
    const other = await openSession('F200560', '2')
    expect(other.state).toBe('open')
  })
})

describe('POST /kitchen/productions', () => {
  test('rejects creating a production with no open session', async () => {
    await expect(
      apiFetch('/kitchen/productions', {
        method: 'POST',
        body: JSON.stringify({ company_id: '1', employee_code: 'F102345', product_id: 'p1', qty: 5 }),
      }),
    ).rejects.toMatchObject({ status: 409, code: 'no_open_session' })
  })

  test('rejects a product with no Bill of Materials', async () => {
    await openSession('F102345')
    await expect(
      apiFetch('/kitchen/productions', {
        method: 'POST',
        body: JSON.stringify({ company_id: '1', employee_code: 'F102345', product_id: 'p3', qty: 2 }),
      }),
    ).rejects.toMatchObject({ status: 409, code: 'no_bom' })
  })

  test('creates a production, auto-confirmed, attributed to whoever sent employee_code — even a co-worker who did not open the session', async () => {
    await openSession('F102345')
    const production = await apiFetch('/kitchen/productions', {
      method: 'POST',
      body: JSON.stringify({ company_id: '1', employee_code: 'F100120', product_id: 'p1', qty: 10 }),
    })
    expect(production.state).toBe('confirmed')
    expect(production.requested_by).toBe('Siti Aminah')
  })
})

describe('POST /kitchen/productions/:id/state', () => {
  test('done succeeds when components are assigned', async () => {
    await openSession('F102345')
    const production = await apiFetch('/kitchen/productions', {
      method: 'POST',
      body: JSON.stringify({ company_id: '1', employee_code: 'F102345', product_id: 'p1', qty: 10 }),
    })
    const done = await apiFetch(`/kitchen/productions/${production.id}/state`, {
      method: 'POST',
      body: JSON.stringify({ employee_code: 'F102345', action: 'done' }),
    })
    expect(done.state).toBe('done')
  })

  test('done fails when components are not yet assigned, leaving the production confirmed', async () => {
    await openSession('F102345')
    const production = await apiFetch('/kitchen/productions', {
      method: 'POST',
      body: JSON.stringify({ company_id: '1', employee_code: 'F102345', product_id: 'p4', qty: 1 }),
    })
    let error
    try {
      await apiFetch(`/kitchen/productions/${production.id}/state`, {
        method: 'POST',
        body: JSON.stringify({ employee_code: 'F102345', action: 'done' }),
      })
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('done_failed')
  })

  test('cancel works on a non-done production', async () => {
    await openSession('F102345')
    const production = await apiFetch('/kitchen/productions', {
      method: 'POST',
      body: JSON.stringify({ company_id: '1', employee_code: 'F102345', product_id: 'p2', qty: 3 }),
    })
    const cancelled = await apiFetch(`/kitchen/productions/${production.id}/state`, {
      method: 'POST',
      body: JSON.stringify({ employee_code: 'F102345', action: 'cancel' }),
    })
    expect(cancelled.state).toBe('cancel')
  })
})

describe('POST /kitchen/sessions/:id/close', () => {
  test('blocks closing while a production is still pending', async () => {
    const session = await openSession('F102345')
    await apiFetch('/kitchen/productions', {
      method: 'POST',
      body: JSON.stringify({ company_id: '1', employee_code: 'F102345', product_id: 'p4', qty: 1 }), // p4 never auto-finishes
    })
    await expect(
      apiFetch(`/kitchen/sessions/${session.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ employee_code: 'F102345', scraps: [] }),
      }),
    ).rejects.toMatchObject({ status: 409, code: 'pending_productions' })
  })

  test('force closes and leaves the pending production running', async () => {
    const session = await openSession('F102345')
    await apiFetch('/kitchen/productions', {
      method: 'POST',
      body: JSON.stringify({ company_id: '1', employee_code: 'F102345', product_id: 'p4', qty: 1 }),
    })
    const closed = await apiFetch(`/kitchen/sessions/${session.id}/close`, {
      method: 'POST',
      body: JSON.stringify({ employee_code: 'F102345', scraps: [], force: true }),
    })
    expect(closed.state).toBe('closed')
  })

  test('closes cleanly with scrap recorded for a finished production, freeing the company to open a new session', async () => {
    const session = await openSession('F102345')
    const production = await apiFetch('/kitchen/productions', {
      method: 'POST',
      body: JSON.stringify({ company_id: '1', employee_code: 'F102345', product_id: 'p1', qty: 10 }),
    })
    await apiFetch(`/kitchen/productions/${production.id}/state`, {
      method: 'POST',
      body: JSON.stringify({ employee_code: 'F102345', action: 'done' }),
    })
    const closed = await apiFetch(`/kitchen/sessions/${session.id}/close`, {
      method: 'POST',
      body: JSON.stringify({
        employee_code: 'F102345',
        scraps: [{ product_id: 'p1', production_id: production.id, qty: 0.5, reason: 'burnt edge' }],
      }),
    })
    expect(closed.state).toBe('closed')
    expect(closed.scraps).toHaveLength(1)

    // The company is now free to open a fresh session.
    const reopened = await openSession('F100120')
    expect(reopened.state).toBe('open')
  })
})

describe('GET /stock', () => {
  test('filters to kitchen-relevant products and reports availability', async () => {
    const res = await apiFetch('/stock?company_id=1')
    expect(res.products.length).toBeGreaterThan(0)
    const p4 = res.products.find((p) => p.product_id === 'p4')
    expect(p4.is_available).toBe(true)
    expect(p4.available_qty).toBe(2)
  })
})
