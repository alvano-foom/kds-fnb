import { useAuthStore } from '../store/authStore'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

// Refresh calls are deduped: if five requests 401 at once, only one
// /auth/refresh call goes out and the rest await the same promise.
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

/**
 * @param {string} path            e.g. '/order-lines'
 * @param {RequestInit} [options]
 * @param {{retryOn401?: boolean}} [config]
 */
export async function apiFetch(path, options = {}, { retryOn401 = true } = {}) {
  const { accessToken } = useAuthStore.getState()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401 && retryOn401) {
    const refreshed = await tryRefresh()
    if (refreshed) return apiFetch(path, options, { retryOn401: false })
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
