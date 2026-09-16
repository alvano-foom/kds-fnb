import { apiFetch } from './client'

export function getTenantConfig() {
  return apiFetch('/tenant/config')
}
