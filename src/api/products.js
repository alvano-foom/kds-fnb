import { apiFetch } from './client'

/** @returns {Promise<import('../types').Product[]>} */
export function searchProducts(search = '', { limit = 20 } = {}) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  return apiFetch(`/products${qs ? `?${qs}` : ''}`)
}
