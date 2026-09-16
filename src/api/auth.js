import { apiFetch } from './client'

export function login(email, password) {
  return apiFetch(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    { retryOn401: false },
  )
}

export function logout(refreshToken) {
  if (!refreshToken) return Promise.resolve(null)
  return apiFetch(
    '/auth/logout',
    { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) },
    { retryOn401: false },
  )
}
