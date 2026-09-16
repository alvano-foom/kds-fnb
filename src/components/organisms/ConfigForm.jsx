import { useCompanies } from '../../hooks/useCompanies'
import { useTenantStore } from '../../store/tenantStore'
import { useThemeStore } from '../../store/themeStore'
import { Select } from '../molecules/Select'
import { Button } from '../atoms/Button'
import { Spinner } from '../atoms/Spinner'

export function ConfigForm({ onSaved }) {
  const companies = useCompanies()
  const tenant = useTenantStore()
  const theme = useThemeStore()

  function handleCompanyChange(companyId) {
    const company = companies.data?.find((c) => c.id === companyId)
    tenant.setConfig({ companyId, companyName: company?.name ?? null })
  }

  function handleSave(event) {
    event.preventDefault()
    onSaved?.()
  }

  if (companies.isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="h-6 w-6 text-brand" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="company-select">
          Company
        </label>
        <Select
          id="company-select"
          value={tenant.companyId}
          onChange={handleCompanyChange}
          options={companies.data ?? []}
          placeholder="Select a company"
        />
      </div>

      {/* Theme colors are a frontend-only setting (persisted to this
          browser's localStorage via useThemeStore) — not part of
          /tenant/config, so picking a color here never touches the API. */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="primary-color">
            Primary Color
          </label>
          <div className="flex items-center gap-2">
            <input
              id="primary-color"
              type="color"
              value={theme.primaryColor}
              onChange={(e) => theme.setColors({ primaryColor: e.target.value })}
              className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-gray-200 p-0.5"
            />
            <span className="text-sm text-gray-500">{theme.primaryColor}</span>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="secondary-color">
            Secondary Color
          </label>
          <div className="flex items-center gap-2">
            <input
              id="secondary-color"
              type="color"
              value={theme.secondaryColor}
              onChange={(e) => theme.setColors({ secondaryColor: e.target.value })}
              className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-gray-200 p-0.5"
            />
            <span className="text-sm text-gray-500">{theme.secondaryColor}</span>
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={!tenant.companyId}>
        Save Configuration
      </Button>
    </form>
  )
}
