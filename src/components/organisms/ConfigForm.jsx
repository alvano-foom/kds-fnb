import { useCompanies } from '@/hooks/useCompanies'
import { useLocations, useWarehouses } from '@/hooks/useWarehouses'
import { useTenantStore } from '@/store/tenantStore'
import { useThemeStore } from '@/store/themeStore'
import { Select } from '@/components/molecules/Select'
import { Button } from '@/components/atoms/Button'
import { Spinner } from '@/components/atoms/Spinner'

const NO_WAREHOUSE = { warehouseId: null, warehouseName: null }
const NO_LOCATION = { locationId: null, locationName: null }

function PickerError({ query, what }) {
  if (!query.isError) return null
  return (
    <p className="mt-1.5 text-xs text-red-600">
      Could not load {what}: {query.error?.message}
    </p>
  )
}

export function ConfigForm({ onSaved }) {
  const companies = useCompanies()
  const tenant = useTenantStore()
  const theme = useThemeStore()
  const warehouses = useWarehouses(tenant.companyId)
  const locations = useLocations(tenant.companyId, tenant.warehouseId)

  const warehouseOptions = (warehouses.data ?? []).map((w) => ({
    id: String(w.id),
    name: w.code ? `${w.code} · ${w.name}` : w.name,
  }))
  const locationOptions = (locations.data ?? []).map((l) => ({ id: String(l.id), name: l.complete_name || l.name }))

  function handleCompanyChange(companyId) {
    const company = companies.data?.find((c) => c.id === companyId)
    tenant.setConfig({ companyId, companyName: company?.name ?? null, ...NO_WAREHOUSE, ...NO_LOCATION })
  }

  function handleWarehouseChange(warehouseId) {
    const warehouse = warehouseOptions.find((w) => w.id === warehouseId)
    tenant.setConfig({ warehouseId, warehouseName: warehouse?.name ?? null, ...NO_LOCATION })
  }

  function handleLocationChange(locationId) {
    const location = locationOptions.find((l) => l.id === locationId)
    tenant.setConfig({ locationId, locationName: location?.name ?? null })
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

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="warehouse-select">
          Warehouse
        </label>
        <Select
          id="warehouse-select"
          value={tenant.warehouseId}
          onChange={handleWarehouseChange}
          options={warehouseOptions}
          placeholder={warehouses.isLoading ? 'Loading warehouses…' : 'Select a warehouse'}
          disabled={!tenant.companyId || warehouses.isLoading}
        />
        <PickerError query={warehouses} what="warehouses" />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="location-select">
          Location
        </label>
        <Select
          id="location-select"
          value={tenant.locationId}
          onChange={handleLocationChange}
          options={locationOptions}
          placeholder={locations.isLoading ? 'Loading locations…' : 'Select a location'}
          disabled={!tenant.warehouseId || locations.isLoading}
        />
        <PickerError query={locations} what="locations" />
      </div>

      {/* Theme colors are stored locally only, never sent to the API. */}
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

      <Button
        type="submit"
        className="w-full"
        disabled={!tenant.companyId || !tenant.warehouseId || !tenant.locationId}
      >
        Save Configuration
      </Button>
    </form>
  )
}
