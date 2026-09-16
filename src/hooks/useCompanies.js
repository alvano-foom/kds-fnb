import { useQuery } from '@tanstack/react-query'
import { getCompanies } from '../api/companies'

export function useCompanies() {
  return useQuery({ queryKey: ['companies'], queryFn: getCompanies })
}
