import { apiFetch } from './client'

export function getCompanies() {
  return apiFetch('/companies')
}
