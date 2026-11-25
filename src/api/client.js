import { useAuthStore } from '@/store/authStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Dedupes concurrent refreshes: parallel 401s share one /auth/refresh call.
let refreshPromise = null

async function tryRefresh() {
  const { refreshToken, setTokens } = useAuthStore.getState()
  if (!refreshToken) return false
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false
        setTokens(await res.json())
        return true
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

/** Same-origin routes served by this app's own backend (server/handlers.js). */
export const SERVER_BASE_URL = '/api'

/**
 * @param {string} path            e.g. '/order-lines'
 * @param {RequestInit} [options]
 * @param {{retryOn401?: boolean, baseUrl?: string}} [config]
 */
export async function apiFetch(path, options = {}, { retryOn401 = true, baseUrl = BASE_URL } = {}) {
  const { accessToken } = useAuthStore.getState()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(`${baseUrl}${path}`, { ...options, headers })

  if (res.status === 401 && retryOn401) {
    const refreshed = await tryRefresh()
    if (refreshed) return apiFetch(path, options, { retryOn401: false, baseUrl })
    useAuthStore.getState().signOut()
    throw new ApiError(401, 'unauthorized', 'Session expired')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error?.code ?? 'unknown', body?.error?.message ?? res.statusText)
  }

  if (res.status === 204) return null
  return res.json()
}
